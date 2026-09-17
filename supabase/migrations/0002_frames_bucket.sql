-- Paused video frames captured from the student's tab. Private; the server uploads
-- with the service role and hands out short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('frames', 'frames', false, 2097152, array['image/jpeg'])
on conflict (id) do nothing;
