-- iPhone Safari can return JPEG when WebP export is unavailable.
-- Keep the bucket private and preserve the organizer check on writes.
alter table public.media drop constraint media_path_check;
alter table public.media add constraint media_path_check
  check (path ~ '^[0-9a-f-]{36}\.(webp|jpg)$');

drop policy photo_insert on storage.objects;
create policy photo_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'event-photos'
    and public.is_organizer()
    and name ~ '^[0-9a-f-]{36}\.(webp|jpg)$'
  );
