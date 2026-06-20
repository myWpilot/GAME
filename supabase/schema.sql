-- King Oyunu - Supabase şeması
-- Supabase Dashboard > SQL Editor içine yapıştırıp çalıştırın.

create extension if not exists "pgcrypto";

-- Profil tablosu: auth.users ile 1-1, görünen isim için
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  wins integer not null default 0,
  losses integer not null default 0,
  created_at timestamptz default now()
);

alter table public.profiles add column if not exists wins integer not null default 0;
alter table public.profiles add column if not exists losses integer not null default 0;

alter table public.profiles enable row level security;

create policy "profiles_select_all" on public.profiles
  for select using (true);

create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- Yeni kullanıcı kayıt olduğunda otomatik profil oluştur
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Oyun odaları
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  status text not null default 'LOBBY', -- LOBBY | PLAYING | FINISHED
  player_ids uuid[] not null default '{}',
  state jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.games enable row level security;

-- Herkes (giriş yapmış) oda kodu ile odayı bulup görebilir
create policy "games_select" on public.games
  for select using (auth.uid() is not null);

-- Giriş yapmış herkes oda açabilir (kurucu otomatik player listesine eklenir)
create policy "games_insert" on public.games
  for insert with check (auth.uid() = any(player_ids));

-- Sadece odadaki oyuncular state/player_ids güncelleyebilir
create policy "games_update" on public.games
  for update using (auth.uid() = any(player_ids));

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists games_set_updated_at on public.games;
create trigger games_set_updated_at
  before update on public.games
  for each row execute procedure public.set_updated_at();

-- Realtime için tabloyu yayına ekle
alter publication supabase_realtime add table public.games;
