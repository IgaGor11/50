-- New guests get a random team among those with the fewest members.
-- The event_entry row lock in join_event serializes simultaneous joins.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.join_event(text,text)'::regprocedure) into definition;
  if position('order by count(member.id),t.name limit 1' in definition) = 0 then
    raise exception 'Unexpected join_event team selection; review before migration';
  end if;
  execute replace(definition,
    'order by count(member.id),t.name limit 1',
    'order by count(member.id),random() limit 1');
end $$;
