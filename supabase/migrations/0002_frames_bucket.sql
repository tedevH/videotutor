-- Paused video frames captured from the student's tab. Private; the server uploads
-- with the service role and hands out short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('frames', 'frames', false, 3145728, array['image/jpeg', 'image/png'])
on conflict (id) do update set allowed_mime_types = excluded.allowed_mime_types, file_size_limit = excluded.file_size_limit;
