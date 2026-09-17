-- Lumo learning engine: courses, concept graph, student model (the "Lumo Brain"), practice.

-- ─── Courses built from uploaded material ─────────────────────────────────────
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  subject text,
  description text,
  exam_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.course_materials (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  kind text not null check (kind in ('syllabus', 'slides', 'notes', 'textbook', 'homework', 'exam', 'video', 'other')),
  title text not null,
  storage_path text,
  mime_type text,
  video_id text references public.videos on delete set null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'ready', 'failed')),
  error text,
  summary text,
  created_at timestamptz not null default now()
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses on delete cascade,
  title text not null,
  position int not null default 0,
  summary text
);

-- ─── Concept graph (per student) ──────────────────────────────────────────────
create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  slug text not null,
  name text not null,
  subject text,
  description text,
  course_id uuid references public.courses on delete set null,
  unit_id uuid references public.units on delete set null,
  exam_weight real not null default 1,
  created_at timestamptz not null default now(),
  unique (user_id, slug)
);
create index on public.concepts (user_id, course_id);

create table public.concept_prerequisites (
  concept_id uuid not null references public.concepts on delete cascade,
  prerequisite_id uuid not null references public.concepts on delete cascade,
  primary key (concept_id, prerequisite_id),
  check (concept_id <> prerequisite_id)
);

-- Where a concept is taught: a moment in a video or a page in a document.
create table public.concept_sources (
  id bigint generated always as identity primary key,
  concept_id uuid not null references public.concepts on delete cascade,
  video_id text references public.videos on delete cascade,
  start_seconds int,
  material_id uuid references public.course_materials on delete cascade,
  page int,
  note text
);

-- ─── Student model ────────────────────────────────────────────────────────────
create table public.mastery (
  user_id uuid not null references auth.users on delete cascade,
  concept_id uuid not null references public.concepts on delete cascade,
  p_known real not null default 0.2,           -- knowledge-tracing estimate, 0..1
  stability_days real not null default 1,      -- days until recall probability falls to 90%
  attempts int not null default 0,
  correct int not null default 0,
  streak int not null default 0,
  signals int not null default 0,              -- evidence from conversations (not graded attempts)
  last_evidence_at timestamptz,
  next_review_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, concept_id)
);
create index on public.mastery (user_id, next_review_at);

create table public.misconceptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  concept_id uuid references public.concepts on delete set null,
  key text not null,                           -- normalized identity, e.g. "chain-rule:forgets-inner-derivative"
  description text not null,
  occurrences int not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (user_id, key)
);

create table public.learning_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users on delete cascade,
  concept_id uuid references public.concepts on delete set null,
  kind text not null check (kind in ('asked', 'confused', 'understood', 'misconception', 'attempt', 'hint', 'review', 'feedback')),
  correct boolean,
  modality text,
  source text,                                 -- 'video' | 'practice' | 'review' | 'board'
  session_id uuid references public.sessions on delete set null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.learning_events (user_id, created_at desc);

-- Which kinds of explanation actually work for this student.
create table public.modality_stats (
  user_id uuid not null references auth.users on delete cascade,
  modality text not null,
  shown int not null default 0,
  worked int not null default 0,
  primary key (user_id, modality)
);

-- ─── Practice ─────────────────────────────────────────────────────────────────
create table public.practice_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  concept_id uuid not null references public.concepts on delete cascade,
  difficulty text not null check (difficulty in ('easy', 'medium', 'hard', 'transfer')),
  kind text not null check (kind in ('compute', 'recognize', 'explain', 'choice')),
  prompt text not null,
  choices jsonb,
  solution jsonb not null,                     -- { answer, steps[], hints[], common_mistakes[] }
  targets_misconception uuid references public.misconceptions on delete set null,
  created_at timestamptz not null default now()
);

create table public.practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  item_id uuid not null references public.practice_items on delete cascade,
  answer text not null,
  correct boolean not null,
  hints_used int not null default 0,
  diagnosis jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ─── Sessions: tutoring style and course ──────────────────────────────────────
alter table public.sessions
  add column if not exists mode text not null default 'socratic' check (mode in ('socratic', 'direct')),
  add column if not exists course_id uuid references public.courses on delete set null;

-- Standalone tutoring (whiteboard, review) isn't tied to a video. The existing
-- unique (user_id, video_id) still holds: Postgres treats NULLs as distinct.
alter table public.sessions alter column video_id drop not null;

-- ─── Row level security: students only see their own learning data ────────────
alter table public.courses enable row level security;
alter table public.course_materials enable row level security;
alter table public.units enable row level security;
alter table public.concepts enable row level security;
alter table public.concept_prerequisites enable row level security;
alter table public.concept_sources enable row level security;
alter table public.mastery enable row level security;
alter table public.misconceptions enable row level security;
alter table public.learning_events enable row level security;
alter table public.modality_stats enable row level security;
alter table public.practice_items enable row level security;
alter table public.practice_attempts enable row level security;

create policy "own courses" on public.courses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own materials" on public.course_materials for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own units" on public.units for select
  using (exists (select 1 from public.courses c where c.id = course_id and c.user_id = auth.uid()));
create policy "own concepts" on public.concepts for select using (auth.uid() = user_id);
create policy "own prerequisites" on public.concept_prerequisites for select
  using (exists (select 1 from public.concepts c where c.id = concept_id and c.user_id = auth.uid()));
create policy "own concept sources" on public.concept_sources for select
  using (exists (select 1 from public.concepts c where c.id = concept_id and c.user_id = auth.uid()));
-- The student model is written only by the server, so it can't be edited to fake mastery.
create policy "read own mastery" on public.mastery for select using (auth.uid() = user_id);
create policy "read own misconceptions" on public.misconceptions for select using (auth.uid() = user_id);
create policy "read own events" on public.learning_events for select using (auth.uid() = user_id);
create policy "read own modality stats" on public.modality_stats for select using (auth.uid() = user_id);
create policy "read own practice items" on public.practice_items for select using (auth.uid() = user_id);
create policy "read own attempts" on public.practice_attempts for select using (auth.uid() = user_id);

-- Uploaded course material (PDFs, slides, images). Private; server hands out signed URLs.
insert into storage.buckets (id, name, public, file_size_limit)
values ('materials', 'materials', false, 52428800)
on conflict (id) do nothing;

create policy "upload own materials" on storage.objects for insert to authenticated
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "read own materials" on storage.objects for select to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
