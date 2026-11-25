alter table public.teams add column if not exists artifacts integer not null default 0 check(artifacts>=0);
create table public.game_control(id boolean primary key default true check(id),title text not null default '',phase text not null default 'off' check(phase in ('off','teams','guess','perform','toasts','complete')),instructions jsonb not null default '{}',updated_at timestamptz not null default now());
insert into public.game_control(id) values(true);
create table public.game_tasks(team_id uuid primary key references public.teams(id),clue text not null default '' check(length(clue)<=1500),solution text not null default '' check(length(solution)<=300),submission text not null default '' check(length(submission)<=300),status text not null default 'assigned' check(status in ('assigned','answered','approved','performed')),awarded boolean not null default false);
create table public.runbook_documents(id boolean primary key default true check(id),body text not null);
alter table public.game_control enable row level security;alter table public.game_tasks enable row level security;alter table public.runbook_documents enable row level security;
revoke all on public.game_control,public.game_tasks,public.runbook_documents from anon,authenticated;
create function public.game_state() returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.game_control;g public.guests;adm boolean:=public.is_organizer();begin
 if auth.uid() is null then raise exception 'Войдите';end if;
 select * into g from public.guests where user_id=auth.uid();if not adm and g.id is null then raise exception 'Нужен профиль гостя';end if;
 select * into c from public.game_control;
 if not adm and c.phase='off' then return jsonb_build_object('phase','off');end if;
 return jsonb_build_object('title',c.title,'phase',c.phase,'instructions',case when adm then c.instructions else jsonb_build_object(c.phase,c.instructions->c.phase) end,'tasks',(select coalesce(jsonb_agg(case when adm then to_jsonb(t) else to_jsonb(t)-'solution' end),'[]'::jsonb) from public.game_tasks t where adm or (t.team_id=g.team_id and c.phase in ('guess','perform','toasts','complete'))));
end $$;
create function public.game_action(command text,payload jsonb default '{}') returns void language plpgsql security definer set search_path='' as $$
declare g public.guests;c public.game_control;tid uuid;team_ids uuid[];n integer;i integer:=0;v text;aw boolean;begin
 if auth.uid() is null then raise exception 'Войдите';end if;
 if octet_length(payload::text)>32768 then raise exception 'Слишком большой запрос';end if;
 select * into c from public.game_control where id=true for update;
 if command='submit' then
  select * into g from public.guests where user_id=auth.uid();
  if g.id is null or g.team_id is null or c.phase<>'guess' then raise exception 'Сейчас ответы не принимаются';end if;
  v=trim(payload->>'answer');if v is null or length(v) not between 1 and 300 then raise exception 'Введите ответ';end if;
  update public.game_tasks set submission=v,status='answered' where team_id=g.team_id and status='assigned' and clue<>'';
  if not found then raise exception 'Ответ уже отправлен или задание не готово';end if;
  return;
 end if;
 if not public.is_organizer() then raise exception 'Только организатор' using errcode='42501';end if;
 case command
 when 'phase' then
  v=payload->>'phase';if v not in ('off','teams','guess','perform','toasts','complete') or v is null then raise exception 'Неизвестный этап';end if;
  if v='guess' and (not exists(select 1 from public.guests where team_id is not null) or exists(select 1 from public.guests g left join public.game_tasks t on t.team_id=g.team_id where g.team_id is not null and coalesce(trim(t.clue),'')='')) then raise exception 'Сначала добавьте задания всем командам с гостями';end if;
  update public.game_control set phase=v,updated_at=now();
 when 'shuffle' then
  n=(payload->>'count')::integer;if n not in(4,5) or n is null or c.phase not in('off','teams') then raise exception 'Распределение на 4–5 команд доступно до начала игры';end if;
  if exists(select 1 from public.answers) or exists(select 1 from public.game_tasks where status<>'assigned') then raise exception 'После ответов состав команд меняется только вручную';end if;
  perform id from public.guests order by id for update;
  while (select count(*) from public.teams)<n loop insert into public.teams(name) values('Команда '||((select count(*) from public.teams)+1)::text);end loop;
  select array_agg(id order by name) into team_ids from (select id,name from public.teams order by name limit n) x;
  for g in select * from public.guests order by random() loop update public.guests set team_id=team_ids[(i%n)+1] where id=g.id;i=i+1;end loop;
 when 'task' then
  tid=(payload->>'team_id')::uuid;
  if exists(select 1 from public.game_tasks where team_id=tid and status<>'assigned') then raise exception 'Нельзя менять задание после ответа';end if;
  insert into public.game_tasks(team_id,clue,solution) values(tid,trim(payload->>'clue'),trim(coalesce(payload->>'solution',''))) on conflict(team_id) do update set clue=excluded.clue,solution=excluded.solution;
 when 'approve' then update public.game_tasks set status='approved' where team_id=(payload->>'team_id')::uuid and status='answered';if not found then raise exception 'Нет ответа для проверки';end if;
 when 'retry' then update public.game_tasks set status='assigned',submission='' where team_id=(payload->>'team_id')::uuid and not awarded;
 when 'award' then
  tid=(payload->>'team_id')::uuid;
  update public.game_tasks set awarded=true,status='performed' where team_id=tid and status='approved' and not awarded returning awarded into aw;
  if found then update public.teams set artifacts=artifacts+1 where id=tid;else raise exception 'Сначала подтвердите ответ. Артефакт выдаётся один раз';end if;
 else raise exception 'Неизвестное действие';end case;
 insert into public.audit(actor,action) values(auth.uid(),'game:'||command);
end $$;
revoke all on function public.game_state(),public.game_action(text,jsonb) from public,anon;
grant execute on function public.game_state(),public.game_action(text,jsonb) to authenticated;
create or replace function public.can_view_media(object_path text) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_organizer() or exists(
  select 1 from public.media m join public.guests g on g.user_id=auth.uid() cross join public.settings s
  where m.path=object_path and (
   m.kind in ('eugene','cover','cutout') or
   (s.album_published and (m.kind='event' or (m.kind='portrait' and not g.photo_opt_out and
    (m.guest_id=g.id or (m.pair_id=g.pair_id and g.pair_id is not null and (select count(*) from public.guests p where p.pair_id=g.pair_id)>=1 and not exists(select 1 from public.guests p where p.pair_id=g.pair_id and p.photo_opt_out))))))
  ))
$$;
create or replace function public.bootstrap() returns jsonb language plpgsql security definer set search_path='' as $$
declare is_admin boolean:=public.is_organizer();g public.guests;members uuid[]:=array[]::uuid[];result jsonb;begin
 if auth.uid() is null then raise exception 'Требуется вход';end if;
 select * into g from public.guests where user_id=auth.uid();
 if not is_admin and g.id is null then raise exception 'Откройте персональную ссылку-приглашение';end if;
 if not g.photo_opt_out and g.pair_id is not null and not exists(select 1 from public.guests where pair_id=g.pair_id and photo_opt_out) then select array_agg(id) into members from public.guests where pair_id=g.pair_id;end if;
 result=jsonb_build_object(
 'game',public.game_state(),
 'settings',(select to_jsonb(s)-'id' from public.settings s),
 'guests',coalesce((select jsonb_agg(to_jsonb(x)-'user_id') from public.guests x where is_admin or x.id=g.id or x.id=any(members)),'[]'),
 'teams',coalesce((select jsonb_agg(t order by name) from public.teams t),'[]'),
 'program',coalesce((select jsonb_agg(p order by position) from public.program p),'[]'),
 'reviews',coalesce((select jsonb_agg(r) from public.reviews r where is_admin or r.guest_id=g.id or r.guest_id=any(members)),'[]'),
 'media',coalesce((select jsonb_agg(m order by position) from public.media m where public.can_view_media(m.path)),'[]'),
 'questions',coalesce((select jsonb_agg(case when is_admin then to_jsonb(q) else to_jsonb(q)-'correct_index' end) from public.questions q where is_admin or active),'[]'),
 'answers',coalesce((select jsonb_agg(a) from public.answers a where is_admin or a.guest_id=g.id),'[]'),
 'votes',coalesce((select jsonb_agg(v) from public.votes v where is_admin or v.guest_id=g.id),'[]'),
 'requests',coalesce((select jsonb_agg(r order by created_at desc) from public.requests r where is_admin or r.guest_id=g.id),'[]'),
 'audit',case when is_admin then coalesce((select jsonb_agg(a) from (select * from public.audit order by id desc limit 100) a),'[]') else '[]'::jsonb end);
 return jsonb_build_object('identity',jsonb_build_object('role',case when is_admin then 'admin' else 'guest' end,'guestId',g.id),'state',result);
end $$;
create or replace function public.app_action(action_name text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.guests;q public.questions;target uuid;pair_uuid uuid;v_token text;item jsonb;i integer;correct boolean;outcome jsonb:='{}';a uuid;b uuid;first_position bigint;second_position bigint;member_ids uuid[];
begin
 if auth.uid() is null then raise exception 'Требуется вход';end if;
 if octet_length(payload::text)>65536 then raise exception 'Слишком большой запрос';end if;
 select * into g from public.guests where user_id=auth.uid() for update;
 if action_name in ('photo_preference','review','request','vote','answer') then
  if g.id is null then raise exception 'Гость не найден';end if;
  case action_name
   when 'photo_preference' then update public.guests set photo_opt_out=(payload->>'value')::boolean where id=g.id;
   when 'review' then insert into public.reviews(guest_id,body,rating) values(g.id,trim(payload->>'body'),(payload->>'rating')::integer) on conflict(guest_id) do update set body=excluded.body,rating=excluded.rating,updated_at=now();
   when 'request' then
    if (select count(*) from public.requests where guest_id=g.id and created_at>now()-interval '1 hour')>=20 then raise exception 'Слишком много запросов. Обратитесь к ведущему лично';end if;
    if payload->>'kind' not in ('Вопрос ведущему','Женя, помоги!','Помощь хореографа') then raise exception 'Неизвестный запрос';end if;
    insert into public.requests(guest_id,kind) values(g.id,payload->>'kind') on conflict do nothing;
   when 'vote' then
    if payload->>'choice' not in ('Танцев до упаду','Тёплых историй','Песен всем залом') then raise exception 'Неизвестный вариант';end if;
    insert into public.votes(guest_id,choice) values(g.id,payload->>'choice') on conflict(guest_id) do update set choice=excluded.choice;
   when 'answer' then
    select * into q from public.questions where id=(payload->>'question_id')::uuid and active for share;
    if q.id is null then raise exception 'Вопрос закрыт';end if;
    i=(payload->>'choice')::integer;if i is null or i<0 or i>=jsonb_array_length(q.options) then raise exception 'Неверный вариант';end if;
    correct=i=q.correct_index;
    insert into public.answers(guest_id,question_id,choice,correct) values(g.id,q.id,i,correct);
    if correct then update public.teams set score=least(99999,score+q.points) where id=g.team_id;end if;
    outcome=jsonb_build_object('correct',correct);
  end case;
 else
  if not public.is_organizer() then raise exception 'Нужны права организатора' using errcode='42501';end if;
  case action_name
   when 'settings' then
    if payload ? 'originals_url' and payload->>'originals_url'<>'' and payload->>'originals_url' !~ '^https://(drive\.google\.com|disk\.yandex\.(ru|com)|yadi\.sk)/' then raise exception 'Нужна HTTPS-ссылка Google Drive или Яндекс Диска';end if;
    update public.settings set activity=coalesce(payload->>'activity',activity),announcement=coalesce(payload->>'announcement',announcement),album_published=coalesce((payload->>'album_published')::boolean,album_published),originals_url=coalesce(payload->>'originals_url',originals_url);
   when 'guest_create' then insert into public.guests(name,team_id) values(trim(payload->>'name'),nullif(payload->>'team_id','')::uuid) returning id into target;outcome=jsonb_build_object('id',target);
   when 'guest_update' then update public.guests set name=trim(payload->>'name'),team_id=nullif(payload->>'team_id','')::uuid where id=(payload->>'id')::uuid;
   when 'pair' then
    a=(payload->>'first')::uuid;b=(payload->>'second')::uuid;
    if a is null or b is null or a=b then raise exception 'Выберите двух разных гостей';end if;
    perform id from public.guests where id in (a,b) order by id for update;
    if (select count(*) from public.guests where id in(a,b) and pair_id is null)<>2 then raise exception 'Гость не найден или уже состоит в паре';end if;
    insert into public.pairs default values returning id into pair_uuid;update public.guests set pair_id=pair_uuid where id in(a,b);
   when 'group_create' then
    if jsonb_typeof(payload->'members')<>'array' or jsonb_array_length(payload->'members') not between 1 and 50 then raise exception 'Выберите от 1 до 50 гостей';end if;
    select array_agg(distinct v::uuid) into member_ids from jsonb_array_elements_text(payload->'members') v;
    if cardinality(member_ids)<>jsonb_array_length(payload->'members') then raise exception 'Гости не должны повторяться';end if;
    perform id from public.guests where id=any(member_ids) order by id for update;
    if (select count(*) from public.guests where id=any(member_ids) and pair_id is null)<>cardinality(member_ids) then raise exception 'Гость не найден или уже входит в группу';end if;
    insert into public.pairs default values returning id into pair_uuid;update public.guests set pair_id=pair_uuid where id=any(member_ids);
   when 'unpair' then delete from public.pairs where id=(payload->>'id')::uuid;
   when 'score' then update public.teams set score=(payload->>'score')::integer where id=(payload->>'id')::uuid;
   when 'program' then
    if jsonb_typeof(payload->'items')<>'array' or jsonb_array_length(payload->'items')>50 then raise exception 'Не более 50 блоков';end if;
    delete from public.program;i=0;for item in select * from jsonb_array_elements(payload->'items') loop insert into public.program(time,title,description,position) values(item->>'time',item->>'title',item->>'description',i);i=i+1;end loop;
   when 'question' then
    i=(payload->>'correct_index')::integer;if i is null or i<0 or i>=jsonb_array_length(payload->'options') then raise exception 'Неверный правильный ответ';end if;
    if exists(select 1 from jsonb_array_elements_text(payload->'options') x where length(trim(x)) not between 1 and 100) then raise exception 'Проверьте варианты';end if;
    target=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
    if exists(select 1 from public.answers where question_id=target) and exists(select 1 from public.questions where id=target and (prompt<>payload->>'prompt' or options<>payload->'options' or correct_index<>i or points<>(payload->>'points')::integer)) then raise exception 'Нельзя менять вопрос после первого ответа. Создайте новый';end if;
    insert into public.questions(id,prompt,options,correct_index,points,active) values(target,payload->>'prompt',payload->'options',i,(payload->>'points')::integer,(payload->>'active')::boolean) on conflict(id) do update set prompt=excluded.prompt,options=excluded.options,correct_index=excluded.correct_index,points=excluded.points,active=excluded.active;
   when 'request_done' then update public.requests set done=true where id=(payload->>'id')::uuid;
   when 'invite_rotate' then
    target=(payload->>'id')::uuid;if not exists(select 1 from public.guests where id=target) then raise exception 'Гость не найден';end if;
    v_token=encode(extensions.gen_random_bytes(32),'hex');update public.guests set user_id=null where id=target;
    insert into public.invites(guest_id,token_hash) values(target,encode(extensions.digest(v_token,'sha256'),'hex')) on conflict(guest_id) do update set token_hash=excluded.token_hash,used_at=null,expires_at=now()+interval '30 days';outcome=jsonb_build_object('token',v_token);
   when 'media_add' then
    if payload->>'kind'='cutout' then raise exception 'Декоративные портреты добавляются через разработчика';end if;
    if (payload->>'kind')='portrait' and payload->>'guest_id' is not null and exists(select 1 from public.guests where id=(payload->>'guest_id')::uuid and photo_opt_out) then raise exception 'Гость отказался от портрета';end if;
    if (payload->>'kind')='portrait' and payload->>'pair_id' is not null and ((select count(*) from public.guests where pair_id=(payload->>'pair_id')::uuid)<1 or exists(select 1 from public.guests where pair_id=(payload->>'pair_id')::uuid and photo_opt_out)) then raise exception 'Пара не готова к съёмке';end if;
    if not exists(select 1 from storage.objects where bucket_id='event-photos' and name=payload->>'path') then raise exception 'Сначала загрузите файл';end if;
    if payload->>'kind' in ('portrait','cover') then delete from public.media where kind=payload->>'kind' and guest_id is not distinct from nullif(payload->>'guest_id','')::uuid and pair_id is not distinct from nullif(payload->>'pair_id','')::uuid;end if;
    insert into public.media(id,kind,path,caption,bytes,position,guest_id,pair_id) values((payload->>'id')::uuid,payload->>'kind',payload->>'path',coalesce(payload->>'caption',''),(payload->>'bytes')::bigint,(payload->>'position')::bigint,nullif(payload->>'guest_id','')::uuid,nullif(payload->>'pair_id','')::uuid);
   when 'media_caption' then update public.media set caption=payload->>'caption' where id=(payload->>'id')::uuid;
   when 'media_delete' then delete from public.media where id=(payload->>'id')::uuid;
   when 'media_order' then
    a=(payload->>'id')::uuid;b=(payload->>'other')::uuid;perform id from public.media where id in(a,b) order by id for update;
    select position into first_position from public.media where id=a;select position into second_position from public.media where id=b;
    if first_position is null or second_position is null then raise exception 'Фото не найдено';end if;
    update public.media set position=case when id=a then second_position else first_position end where id in(a,b);
   else raise exception 'Неизвестное действие';
  end case;
  insert into public.audit(actor,action) values(auth.uid(),action_name);
 end if;
 return outcome;
end $$;
-- Explicit execute privileges: unauthenticated users cannot invoke any app function.
create or replace function public.runbook_read() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.is_organizer() then raise exception 'Organizer only' using errcode='42501'; end if;
 return jsonb_build_object('steps',(select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]'::jsonb) from public.runbook_steps s),'clock',(select to_jsonb(c) from public.runbook_clock c),'server_time',now(),'document',(select body from public.runbook_documents where id=true));
end $$;
