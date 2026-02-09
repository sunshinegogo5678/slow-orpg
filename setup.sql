-- [Slow ORPG 통합 설치 스크립트 (Fixed 2026.01.30 - Traits Added)]
-- 이 코드를 Supabase SQL Editor에 복사하여 붙여넣고 Run 버튼을 누르세요.

-- --------------------------------------------------------
-- 1. 유틸리티 함수 (수정 시간 자동 갱신용)
-- --------------------------------------------------------
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;


-- --------------------------------------------------------
-- 2. 유저 프로필 테이블 (Profiles)
-- --------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade not null primary key,
  nickname text,
  avatar_url text,
  introduction text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default now()
);

alter table public.profiles add column if not exists updated_at timestamptz default now();

drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
before update on public.profiles
for each row execute procedure public.update_updated_at_column();

create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- --------------------------------------------------------
-- 3. 캠페인(게임 방) 테이블 (Campaigns)
-- --------------------------------------------------------
create table if not exists public.campaigns (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  title text not null,
  description text,
  gm_id uuid references public.profiles(id) not null,
  max_players integer default 4,
  cover_image text,
  invite_code text unique default substr(md5(random()::text), 1, 6),
  discord_webhook_url text,
  bgm_url text,
  system text default 'CoC 7th',
  current_chapter text default '제 1장',
  current_location text default '알 수 없음',
  scenario_time text default '시간 미상',
  scene_description text default '아직 설정된 장면이 없습니다.',
  is_scene_visible boolean default true,
  last_active_at timestamp with time zone default now()
);

alter table public.campaigns add column if not exists bgm_url text;
alter table public.campaigns add column if not exists system text default 'CoC 7th';


-- --------------------------------------------------------
-- 4. 참여자 목록 테이블 (Participants)
-- --------------------------------------------------------
create table if not exists public.participants (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  joined_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, campaign_id)
);


-- --------------------------------------------------------
-- 5. 캐릭터 테이블 (Characters)
-- --------------------------------------------------------
create table if not exists public.characters (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  age text,
  occupation text,
  job text,     -- [추가] 직업
  traits jsonb default '[]'::jsonb, -- [추가] 특성 (배열)
  stats jsonb default '[]'::jsonb, 
  skills jsonb default '{}'::jsonb, 
  backstory jsonb default '{}'::jsonb, 
  avatar_url text,
  derived jsonb default '{}'::jsonb 
);

-- [안전 장치] 컬럼 추가
alter table public.characters add column if not exists job text;
alter table public.characters add column if not exists traits jsonb default '[]'::jsonb;


-- --------------------------------------------------------
-- 6. 메시지(채팅) 테이블 (Messages)
-- --------------------------------------------------------
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  campaign_id uuid references public.campaigns(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  speaker_name text not null,
  content text,
  type text default 'talk',
  dice_result jsonb,
  is_hidden boolean default false,
  avatar_url text
);

create or replace function public.handle_new_message()
returns trigger as $$
begin
  update public.campaigns
  set last_active_at = now()
  where id = new.campaign_id;
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_message_sent on public.messages;
create trigger on_message_sent
after insert on public.messages
for each row execute function public.handle_new_message();


-- --------------------------------------------------------
-- 7. 스토리지 및 Realtime 설정
-- --------------------------------------------------------
insert into storage.buckets (id, name, public) values ('images', 'images', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('bgm', 'bgm', true) on conflict (id) do nothing;

-- [중요] 실시간 구독 활성화
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table campaigns;


-- --------------------------------------------------------
-- 8. RLS 정책 (권한 설정)
-- --------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.participants enable row level security;
alter table public.characters enable row level security;
alter table public.messages enable row level security;

drop policy if exists "Enable access for authenticated users" on public.profiles;
drop policy if exists "Enable access for authenticated users" on public.campaigns;
drop policy if exists "Enable access for authenticated users" on public.participants;
drop policy if exists "Enable access for authenticated users" on public.characters;
drop policy if exists "Enable access for authenticated users" on public.messages;
drop policy if exists "Enable upload for authenticated users" on storage.objects;
drop policy if exists "Enable read for all" on storage.objects;

create policy "Enable access for authenticated users" on public.profiles for all using (auth.role() = 'authenticated');
create policy "Enable access for authenticated users" on public.campaigns for all using (auth.role() = 'authenticated');
create policy "Enable access for authenticated users" on public.participants for all using (auth.role() = 'authenticated');
create policy "Enable access for authenticated users" on public.characters for all using (auth.role() = 'authenticated');
create policy "Enable access for authenticated users" on public.messages for all using (auth.role() = 'authenticated');

create policy "Enable upload for authenticated users" on storage.objects for insert with check ((bucket_id = 'images' or bucket_id = 'bgm') and auth.role() = 'authenticated');
create policy "Enable read for all" on storage.objects for select using (bucket_id = 'images' or bucket_id = 'bgm');