-- VideoTutor core schema

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text,
  name text,
  school_level text not null default 'college' check (school_level in ('high_school', 'college')),
  plan text not null default 'free',
  created_at timestamptz not null default now()
);

create table public.videos (
  id text primary key,                -- YouTube videoId
  title text,
  channel text,
  duration_seconds int,
  index_status text not null default 'pending'
    check (index_status in ('pending', 'processing', 'ready', 'failed')),
  index_error text,
  summary text,
  created_at timestamptz not null default now()
);

create table public.video_chunks (
  id bigint generated always as identity primary key,
  video_id text not null references public.videos on delete cascade,
  start_seconds int not null,
  end_seconds int not null,
  transcript text not null default '',
  visual text not null default '',
  on_screen_text text[] not null default '{}',
  concepts text[] not null default '{}',
  unique (video_id, start_seconds)
);
create index on public.video_chunks (video_id, start_seconds);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  video_id text not null references public.videos on delete cascade,
  last_position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, video_id)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  video_timestamp int,
  content jsonb not null,
  created_at timestamptz not null default now()
);
create index on public.messages (session_id, created_at);

create table public.feedback (
  message_id uuid not null references public.messages on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  rating smallint not null check (rating in (-1, 1)),
  comment text,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users on delete set null,
  kind text not null,                 -- 'tutor' | 'ingest'
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  created_at timestamptz not null default now()
);

-- Row level security: users see only their own data; videos/chunks are shared read-only.
alter table public.profiles enable row level security;
alter table public.videos enable row level security;
alter table public.video_chunks enable row level security;
alter table public.sessions enable row level security;
alter table public.messages enable row level security;
alter table public.feedback enable row level security;
alter table public.usage_events enable row level security;

create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "videos readable" on public.videos for select to authenticated using (true);
create policy "chunks readable" on public.video_chunks for select to authenticated using (true);
create policy "own sessions" on public.sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own messages" on public.messages for all
  using (exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid()));
create policy "own feedback" on public.feedback for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Create a profile row on signup
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
