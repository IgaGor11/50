-- Run once in a new Supabase project. No personal data is included in this migration.
create extension if not exists pgcrypto with schema extensions;
create table public.organizers(user_id uuid primary key references auth.users(id) on delete cascade);
create table public.teams(id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 80),score integer not null default 0 check(score between 0 and 99999));
create table public.pairs(id uuid primary key default gen_random_uuid());
create table public.guests(id uuid primary key default gen_random_uuid(),user_id uuid unique references auth.users(id) on delete set null,name text not null check(length(name) between 1 and 80),team_id uuid references public.teams(id) on delete set null,pair_id uuid references public.pairs(id) on delete set null,photo_opt_out boolean not null default false,created_at timestamptz not null default now());
create table public.invites(guest_id uuid primary key references public.guests(id) on delete cascade,token_hash text not null unique,used_at timestamptz,expires_at timestamptz not null default now()+interval '30 days');
create table public.settings(id boolean primary key default true check(id),activity text not null default 'Встреча гостей',announcement text not null default '',album_published boolean not null default false,originals_url text not null default '',check(length(activity)<=80 and length(announcement)<=240 and length(originals_url)<=1000));
insert into public.settings(id) values(true);
create table public.program(id uuid primary key default gen_random_uuid(),time text not null,title text not null,description text not null default '',position integer not null default 0,check(length(time)<=30 and length(title) between 1 and 100 and length(description)<=400));
create table public.reviews(guest_id uuid primary key references public.guests(id) on delete cascade,body text not null check(length(trim(body)) between 1 and 600),rating integer check(rating between 1 and 5),updated_at timestamptz not null default now());
create table public.media(id uuid primary key default gen_random_uuid(),kind text not null check(kind in ('event','eugene','cover','cutout','portrait')),path text not null unique check(path ~ '^[0-9a-f-]{36}\.webp$'),caption text not null default '' check(length(caption)<=120),bytes bigint not null check(bytes>0 and bytes<=10485760),position bigint not null default 0,guest_id uuid references public.guests(id) on delete cascade,pair_id uuid references public.pairs(id) on delete cascade,check((kind='portrait' and ((guest_id is null)<>(pair_id is null))) or (kind<>'portrait' and guest_id is null and pair_id is null)));
create table public.questions(id uuid primary key default gen_random_uuid(),prompt text not null check(length(prompt) between 1 and 250),options jsonb not null check(jsonb_typeof(options)='array' and jsonb_array_length(options) between 2 and 6),correct_index integer not null check(correct_index between 0 and 5),points integer not null default 10 check(points between 0 and 100),active boolean not null default false);
create table public.answers(guest_id uuid references public.guests(id),question_id uuid references public.questions(id),choice integer not null,correct boolean not null,created_at timestamptz not null default now(),primary key(guest_id,question_id));
create table public.votes(guest_id uuid primary key references public.guests(id),choice text not null check(length(choice)<=80));
create table public.requests(id uuid primary key default gen_random_uuid(),guest_id uuid not null references public.guests(id),kind text not null check(length(kind) between 1 and 80),done boolean not null default false,created_at timestamptz not null default now());
create unique index one_pending_request on public.requests(guest_id,kind) where not done;
create table public.audit(id bigint generated always as identity primary key,actor uuid not null,action text not null,at timestamptz not null default now());
create index media_kind_position on public.media(kind,position);
create index guests_pair on public.guests(pair_id);
create index guests_team on public.guests(team_id);
-- There is intentionally no direct client CRUD. All writes pass through checked RPCs.
do $$ declare t text; begin foreach t in array array['organizers','teams','pairs','guests','invites','settings','program','reviews','media','questions','answers','votes','requests','audit'] loop execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from anon, authenticated',t);end loop;end $$;
create function public.is_organizer() returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.organizers where user_id=auth.uid()) $$;
create function public.current_guest_id() returns uuid language sql stable security definer set search_path='' as $$ select id from public.guests where user_id=auth.uid() $$;
create function public.can_view_media(object_path text) returns boolean language sql stable security definer set search_path='' as $$
 select public.is_organizer() or exists(
  select 1 from public.media m join public.guests g on g.user_id=auth.uid() cross join public.settings s
  where m.path=object_path and (
   m.kind in ('eugene','cover','cutout') or
   (s.album_published and (m.kind='event' or (m.kind='portrait' and not g.photo_opt_out and
    (m.guest_id=g.id or (m.pair_id=g.pair_id and g.pair_id is not null and (select count(*) from public.guests p where p.pair_id=g.pair_id)=2 and not exists(select 1 from public.guests p where p.pair_id=g.pair_id and p.photo_opt_out))))))
  ))
$$;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('event-photos','event-photos',false,10485760,array['image/webp']) on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['image/webp'];
create policy photo_read on storage.objects for select to authenticated using(bucket_id='event-photos' and public.can_view_media(name));
create policy photo_insert on storage.objects for insert to authenticated with check(bucket_id='event-photos' and public.is_organizer() and name ~ '^[0-9a-f-]{36}\.webp$');
create policy photo_delete on storage.objects for delete to authenticated using(bucket_id='event-photos' and public.is_organizer());
create function public.claim_invite(invite_token text) returns void language plpgsql security definer set search_path='' as $$
declare inv public.invites;begin
 if auth.uid() is null then raise exception 'Требуется вход';end if;
 if length(invite_token)<>64 then raise exception 'Приглашение недействительно';end if;
 select * into inv from public.invites where token_hash=encode(extensions.digest(invite_token,'sha256'),'hex') for update;
 if inv.guest_id is null or inv.expires_at<now() then raise exception 'Приглашение недействительно';end if;
 if inv.used_at is not null then
  if exists(select 1 from public.guests where id=inv.guest_id and user_id=auth.uid()) then return;end if;
  raise exception 'Приглашение уже использовано. Попросите организатора обновить ссылку';
 end if;
 if exists(select 1 from public.guests where user_id=auth.uid() and id<>inv.guest_id) then raise exception 'Вы уже вошли как другой гость';end if;
 update public.guests set user_id=auth.uid() where id=inv.guest_id;
 update public.invites set used_at=now() where guest_id=inv.guest_id;
end $$;
create function public.bootstrap() returns jsonb language plpgsql security definer set search_path='' as $$
declare is_admin boolean:=public.is_organizer();g public.guests;partner uuid;result jsonb;begin
 if auth.uid() is null then raise exception 'Требуется вход';end if;
 select * into g from public.guests where user_id=auth.uid();
 if not is_admin and g.id is null then raise exception 'Откройте персональную ссылку-приглашение';end if;
 if not g.photo_opt_out then select id into partner from public.guests where pair_id=g.pair_id and id<>g.id and not photo_opt_out;end if;
 result=jsonb_build_object(
 'settings',(select to_jsonb(s)-'id' from public.settings s),
 'guests',coalesce((select jsonb_agg(to_jsonb(x)-'user_id') from public.guests x where is_admin or x.id=g.id or x.id=partner),'[]'),
 'teams',coalesce((select jsonb_agg(t order by name) from public.teams t),'[]'),
 'program',coalesce((select jsonb_agg(p order by position) from public.program p),'[]'),
 'reviews',coalesce((select jsonb_agg(r) from public.reviews r where is_admin or r.guest_id=g.id or r.guest_id=partner),'[]'),
 'media',coalesce((select jsonb_agg(m order by position) from public.media m where public.can_view_media(m.path)),'[]'),
 'questions',coalesce((select jsonb_agg(case when is_admin then to_jsonb(q) else to_jsonb(q)-'correct_index' end) from public.questions q where is_admin or active),'[]'),
 'answers',coalesce((select jsonb_agg(a) from public.answers a where is_admin or a.guest_id=g.id),'[]'),
 'votes',coalesce((select jsonb_agg(v) from public.votes v where is_admin or v.guest_id=g.id),'[]'),
 'requests',coalesce((select jsonb_agg(r order by created_at desc) from public.requests r where is_admin or r.guest_id=g.id),'[]'),
 'audit',case when is_admin then coalesce((select jsonb_agg(a) from (select * from public.audit order by id desc limit 100) a),'[]') else '[]'::jsonb end);
 return jsonb_build_object('identity',jsonb_build_object('role',case when is_admin then 'admin' else 'guest' end,'guestId',g.id),'state',result);
end $$;
create function public.app_action(action_name text,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.guests;q public.questions;target uuid;pair_uuid uuid;v_token text;item jsonb;i integer;correct boolean;outcome jsonb:='{}';a uuid;b uuid;first_position bigint;second_position bigint;
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
    if payload->>'kind' not in ('Вопрос ведущему','Женя, помоги!') then raise exception 'Неизвестный запрос';end if;
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
    if (payload->>'kind')='portrait' and payload->>'guest_id' is not null and exists(select 1 from public.guests where id=(payload->>'guest_id')::uuid and photo_opt_out) then raise exception 'Гость отказался от портрета';end if;
    if (payload->>'kind')='portrait' and payload->>'pair_id' is not null and ((select count(*) from public.guests where pair_id=(payload->>'pair_id')::uuid)<>2 or exists(select 1 from public.guests where pair_id=(payload->>'pair_id')::uuid and photo_opt_out)) then raise exception 'Пара не готова к съёмке';end if;
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
revoke all on function public.is_organizer(),public.current_guest_id(),public.can_view_media(text),public.claim_invite(text),public.bootstrap(),public.app_action(text,jsonb) from public,anon;
grant execute on function public.is_organizer(),public.current_guest_id(),public.can_view_media(text),public.claim_invite(text),public.bootstrap(),public.app_action(text,jsonb) to authenticated;
insert into public.teams(name) values('Искра'),('Орбита'),('Ритм');
insert into public.program(time,title,description,position) values('Начало','Собираемся вместе','Программа будет уточнена.',0);
