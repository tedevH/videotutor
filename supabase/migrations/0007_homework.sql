-- Homework: upload a problem set, quiz or photo of your work, write on it, and learn by solving it.

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  course_id uuid references public.courses on delete set null,
  title text not null,
  kind text not null default 'homework' check (kind in ('homework', 'quiz', 'exam', 'notes')),
  file_path text,
  page_count int not null default 0,
  due_date date,
  -- pending → processing → ready | failed (problem extraction)
  status text not null default 'pending',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assignments_user_idx on public.assignments (user_id, created_at desc);

create table public.assignment_pages (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  page_number int not null,
  image_path text not null,
  width int,
  height int,
  text text not null default '',
  created_at timestamptz not null default now(),
  unique (assignment_id, page_number)
);

create table public.assignment_problems (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  page_number int not null default 1,
  label text not null,
  prompt text not null,
  concept_id uuid references public.concepts on delete set null,
  status text not null default 'untouched' check (status in ('untouched', 'working', 'stuck', 'solved')),
  attempts int not null default 0,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index assignment_problems_idx on public.assignment_problems (assignment_id, position);

-- The student's pen work on each page, so it's still there tomorrow.
create table public.assignment_annotations (
  assignment_id uuid not null references public.assignments on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  page_number int not null,
  strokes jsonb not null default '[]',
  updated_at timestamptz not null default now(),
  primary key (assignment_id, page_number)
);

-- A tutoring session can be about an assignment instead of a video.
alter table public.sessions
  add column if not exists assignment_id uuid references public.assignments on delete cascade;

alter table public.assignments enable row level security;
alter table public.assignment_pages enable row level security;
alter table public.assignment_problems enable row level security;
alter table public.assignment_annotations enable row level security;

create policy "own assignments" on public.assignments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own assignment pages" on public.assignment_pages for select using (auth.uid() = user_id);
create policy "own assignment problems" on public.assignment_problems for select using (auth.uid() = user_id);
-- Annotations are the student's own drawing: they write these directly.
create policy "own annotations" on public.assignment_annotations for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Uploaded homework and the page images rendered from it. Private; the server signs URLs.
insert into storage.buckets (id, name, public, file_size_limit)
values ('homework', 'homework', false, 52428800)
on conflict (id) do nothing;

create policy "upload own homework" on storage.objects for insert to authenticated
  with check (bucket_id = 'homework' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read own homework" on storage.objects for select to authenticated
  using (bucket_id = 'homework' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own homework" on storage.objects for delete to authenticated
  using (bucket_id = 'homework' and (storage.foldername(name))[1] = auth.uid()::text);
