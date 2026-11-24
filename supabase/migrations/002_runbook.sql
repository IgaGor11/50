create table public.runbook_steps(id integer primary key, title text not null, notes text not null, done boolean not null default false);
create table public.runbook_clock(id boolean primary key default true check(id), current_step integer references public.runbook_steps(id), started_at timestamptz, elapsed_seconds integer not null default 0, version integer not null default 0);
insert into public.runbook_clock(id) values(true);
alter table public.runbook_steps enable row level security;
alter table public.runbook_clock enable row level security;
revoke all on public.runbook_steps, public.runbook_clock from anon, authenticated;
create function public.runbook_read() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.is_organizer() then raise exception 'Organizer only' using errcode='42501'; end if;
 return jsonb_build_object('steps',(select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]'::jsonb) from public.runbook_steps s),'clock',(select to_jsonb(c) from public.runbook_clock c),'server_time',now());
end $$;
create function public.runbook_control(command text, expected_version integer, step_id integer default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.runbook_clock; next_id integer;
begin
 if not public.is_organizer() then raise exception 'Organizer only' using errcode='42501'; end if;
 select * into c from public.runbook_clock where id=true for update;
 if c.version<>expected_version then raise exception 'Пульт обновлён другим организатором. Повторите действие.'; end if;
 if command='start' then
  if not exists(select 1 from public.runbook_steps where id=step_id) then raise exception 'Неизвестный блок'; end if;
  update public.runbook_clock set current_step=step_id,started_at=now(),elapsed_seconds=0 where id=true;
 elsif command='pause' then
  update public.runbook_clock set elapsed_seconds=elapsed_seconds+case when started_at is null then 0 else greatest(0,extract(epoch from now()-started_at)::integer) end,started_at=null where id=true;
 elsif command='resume' then
  update public.runbook_clock set started_at=coalesce(started_at,now()) where id=true and current_step is not null;
 elsif command='next' then
  update public.runbook_steps set done=true where id=c.current_step;
  select min(id) into next_id from public.runbook_steps where id>c.current_step;
  update public.runbook_clock set current_step=next_id,started_at=case when next_id is null then null else now() end,elapsed_seconds=0 where id=true;
 else raise exception 'Неизвестное действие'; end if;
 update public.runbook_clock set version=version+1 where id=true;
 return public.runbook_read();
end $$;
revoke all on function public.runbook_read(),public.runbook_control(text,integer,integer) from public,anon;
grant execute on function public.runbook_read(),public.runbook_control(text,integer,integer) to authenticated;
