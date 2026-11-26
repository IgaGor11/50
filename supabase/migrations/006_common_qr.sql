create table public.event_entry(id boolean primary key default true check(id),entry_key text not null default encode(extensions.gen_random_bytes(24),'hex'),enabled boolean not null default true,max_guests integer not null default 250 check(max_guests between 1 and 1000));
insert into public.event_entry(id) values(true);
alter table public.event_entry enable row level security;
revoke all on public.event_entry from public,anon,authenticated;
create function public.event_pass() returns jsonb language plpgsql security definer set search_path='' as $$
begin if not public.is_organizer() then raise exception 'Organizer only' using errcode='42501';end if;return(select jsonb_build_object('key',entry_key,'enabled',enabled) from public.event_entry where id=true);end $$;
revoke all on function public.event_pass() from public,anon;grant execute on function public.event_pass() to authenticated;
create function public.join_event(event_key text,display_name text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.event_entry;g public.guests;tid uuid;n text;begin
 if auth.uid() is null then raise exception 'Требуется вход' using errcode='42501';end if;
 select * into c from public.event_entry where id=true for update;
 if event_key is null or length(event_key)<>48 or c.entry_key<>event_key or not c.enabled then raise exception 'QR недействителен. Попросите организатора показать QR вечера.' using errcode='42501';end if;
 if public.is_organizer() then return jsonb_build_object('ready',true);end if;
 select * into g from public.guests where user_id=auth.uid();if g.id is not null then return jsonb_build_object('ready',true);end if;
 if display_name is null then return jsonb_build_object('needs_name',true);end if;
 n=trim(regexp_replace(display_name,'\s+',' ','g'));if length(n) not between 2 and 80 then raise exception 'Укажите имя и фамилию (от 2 до 80 символов)';end if;
 if (select count(*) from public.guests)>=c.max_guests then raise exception 'Попросите организатора помочь со входом';end if;
 select t.id into tid from public.teams t left join public.guests g on g.team_id=t.id group by t.id order by count(g.id),t.name limit 1;
 -- A name never grants access to another guest's profile, portrait or review.
 insert into public.guests(user_id,name,team_id) values(auth.uid(),n,tid);
 insert into public.audit(actor,action) values(auth.uid(),'guest:self_join');
 return jsonb_build_object('ready',true);
end $$;
revoke all on function public.join_event(text,text) from public,anon;grant execute on function public.join_event(text,text) to authenticated;
