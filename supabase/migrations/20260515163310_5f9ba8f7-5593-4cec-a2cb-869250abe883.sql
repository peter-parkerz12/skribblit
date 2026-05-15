
create table public.rooms (
  code text primary key,
  host_id text not null,
  phase text not null default 'lobby',
  current_round int not null default 0,
  total_rounds int not null default 3,
  round_seconds int not null default 80,
  max_players int not null default 8,
  current_drawer_id text,
  secret_word text,
  word_choices text[] not null default '{}',
  round_ends_at timestamptz,
  used_words text[] not null default '{}',
  drawer_queue text[] not null default '{}',
  difficulty text not null default 'mixed',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.players (
  id text primary key,
  room_code text not null references public.rooms(code) on delete cascade,
  name text not null,
  color text not null,
  score int not null default 0,
  round_score int not null default 0,
  is_host boolean not null default false,
  guessed_correctly boolean not null default false,
  guess_order int,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);
create index players_room_idx on public.players(room_code);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references public.rooms(code) on delete cascade,
  player_id text not null,
  player_name text not null,
  player_color text not null,
  content text not null,
  kind text not null default 'chat',
  created_at timestamptz not null default now()
);
create index messages_room_idx on public.messages(room_code, created_at);

alter table public.rooms enable row level security;
alter table public.players enable row level security;
alter table public.messages enable row level security;

create policy "rooms public read" on public.rooms for select using (true);
create policy "players public read" on public.players for select using (true);
create policy "messages public read" on public.messages for select using (true);

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.messages;

alter table public.rooms replica identity full;
alter table public.players replica identity full;
alter table public.messages replica identity full;
