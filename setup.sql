-- [Slow ORPG 통합 설치 스크립트 (Final Version - 2026.01.30 Update)]
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
  updated_at timestamp with time zone default now() -- [추가] 수정 시간
);

-- [안전 장치] 기존 테이블이 있을 경우 컬럼 추가
alter table public.profiles 
add column if not exists updated_at timestamptz default now();

-- [트리거] 프로필 수정 시 updated_at 자동 갱신
drop trigger if exists update_profiles_updated_at on public.profiles;
create trigger update_profiles_updated_at
before update on public.profiles
for each row execute procedure public.update_updated_at_column();

-- [트리거] 회원가입 시 프로필 자동 생성 함수
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, nickname)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

-- 트리거 연결
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
  bgm_url text, -- [추가] 배경음악 URL
  -- GM 컨트롤 관련
  current_chapter text default '제 1장',
  current_location text default '알 수 없음',
  scenario_time text default '시간 미상',
  scene_description text default '아직 설정된 장면이 없습니다.',
  is_scene_visible boolean default true,
  last_active_at timestamp with time zone default now()
);

-- [안전 장치] 기존 테이블에 bgm_url이 없을 경우 추가
alter table public.campaigns 
add column if not exists bgm_url text;


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
  stats jsonb default '[]'::jsonb, 
  skills jsonb default '{}'::jsonb, 
  backstory jsonb default '{}'::jsonb, 
  avatar_url text,
  derived jsonb default '{}'::jsonb 
);


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
  type text default 'talk', -- talk, ooc, narration, dice
  dice_result jsonb,
  is_hidden boolean default false,
  avatar_url text
);

-- [트리거] 메시지 전송 시 캠페인 최신 활동 시간 갱신
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
-- 7. 스토리지 버킷 (Storage)
-- --------------------------------------------------------
insert into storage.buckets (id, name, public) 
values ('images', 'images', true)
on conflict (id) do nothing;


-- --------------------------------------------------------
-- 8. RLS 정책 (Row Level Security)
-- --------------------------------------------------------
-- 테이블 RLS 활성화
alter table public.profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.participants enable row level security;
alter table public.characters enable row level security;
alter table public.messages enable row level security;

-- 기존 정책 삭제 (중복 생성 방지용, 에러나면 무시 가능)
drop policy if exists "Enable access for authenticated users" on public.profiles;
drop policy if exists "Enable access for authenticated users" on public.campaigns;
drop policy if exists "Enable access for authenticated users" on public.participants;
drop policy if exists "Enable access for authenticated users" on public.characters;
drop policy if exists "Enable access for authenticated users" on public.messages;
drop policy if exists "Enable upload for authenticated users" on storage.objects;
drop policy if exists "Enable read for all" on storage.objects;

-- 정책 재생성: 모든 인증된 유저 허용 (친구끼리 쓰는 툴이므로 단순화)
create policy "Enable access for authenticated users" on public.profiles for all using (auth.role() = 'authenticated');
create policy "Enable access for authenticated users" on public.campaigns for all using (auth.role() = 'authenticated');
create policy "Enable access for authenticated users" on public.participants for all using (auth.role() = 'authenticated');
create policy "Enable access for authenticated users" on public.characters for all using (auth.role() = 'authenticated');
create policy "Enable access for authenticated users" on public.messages for all using (auth.role() = 'authenticated');

-- 스토리지 정책
create policy "Enable upload for authenticated users" on storage.objects for insert with check (bucket_id = 'images' and auth.role() = 'authenticated');
create policy "Enable read for all" on storage.objects for select using (bucket_id = 'images');