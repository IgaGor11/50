create table public.drive_bridge(id boolean primary key default true check(id),token_hash text not null,enabled boolean not null default true,last_seen timestamptz,last_error text);
create table public.drive_exports(media_id uuid primary key references public.media(id) on delete cascade,drive_file_id text not null,exported_at timestamptz not null default now());
alter table public.drive_bridge enable row level security;alter table public.drive_exports enable row level security;
revoke all on public.drive_bridge,public.drive_exports from anon,authenticated;
create function public.drive_worker(command text,worker_token text,media_id uuid default null,file_id text default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if length(worker_token)<>64 or not exists(select 1 from public.drive_bridge where id=true and enabled and token_hash=encode(extensions.digest(worker_token,'sha256'),'hex')) then raise exception 'Forbidden' using errcode='42501';end if;
 update public.drive_bridge set last_seen=now() where id=true;
 if command='list' then return (select coalesce(jsonb_agg(x),'[]'::jsonb) from(select m.id,m.path,m.bytes from public.media m left join public.drive_exports e on e.media_id=m.id where m.kind='event' and e.media_id is null order by m.position limit 5) x);
 elsif command='ack' then
  if file_id is null or file_id !~ '^[a-zA-Z0-9_-]{10,200}$' or not exists(select 1 from public.media m where m.id=drive_worker.media_id and kind='event') then raise exception 'Invalid event photo';end if;
  insert into public.drive_exports(media_id,drive_file_id) values(drive_worker.media_id,file_id) on conflict(media_id) do nothing;return '{}'::jsonb;
 else raise exception 'Unknown command';end if;
end $$;
revoke all on function public.drive_worker(text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.drive_worker(text,text,uuid,text) to service_role;
create function public.drive_status() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.is_organizer() then raise exception 'Organizer only' using errcode='42501';end if;
 return jsonb_build_object('connected',(select last_seen is not null from public.drive_bridge where id=true),'last_seen',(select last_seen from public.drive_bridge where id=true),'exported',(select count(*) from public.drive_exports),'pending',(select count(*) from public.media m where kind='event' and not exists(select 1 from public.drive_exports e where e.media_id=m.id)));
end $$;
revoke all on function public.drive_status() from public,anon;grant execute on function public.drive_status() to authenticated;
