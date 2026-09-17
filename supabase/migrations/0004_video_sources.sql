-- Videos from sources other than YouTube.

alter table public.videos
  add column if not exists provider text not null default 'youtube' check (provider in ('youtube', 'vimeo', 'file')),
  add column if not exists source_url text,
  add column if not exists thumbnail_url text,
  -- Direct video files are uploaded to Gemini so it can watch them; uploads expire after ~48h.
  add column if not exists gemini_file_uri text,
  add column if not exists gemini_file_mime text,
  add column if not exists gemini_file_expires_at timestamptz;

-- Vimeo videos can't be analyzed ahead of time; the tutor works from what plays in the browser.
alter table public.videos drop constraint if exists videos_index_status_check;
alter table public.videos add constraint videos_index_status_check
  check (index_status in ('pending', 'processing', 'ready', 'failed', 'live'));
