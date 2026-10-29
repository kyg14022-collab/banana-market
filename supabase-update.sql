-- ============================================================
-- 반아나 마켓 업데이트용 SQL (이미 supabase-setup.sql 을 실행한 경우)
-- Supabase SQL Editor 에 통째로 붙여 넣고 Run 하세요.
-- 관리자 이메일을 바꿀 필요가 없고, 기존 매물은 그대로 남습니다.
-- 여러 번 실행해도 괜찮습니다.
-- ============================================================

-- 학군, 동
alter table public.listings add column if not exists school text;
alter table public.listings add column if not exists building text;

-- 해당 층 저층/중층/고층 표시
alter table public.listings add column if not exists floor_level text check (floor_level in ('저층', '중층', '고층'));
alter table public.listings alter column floor_no drop not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'listings_floor_present') then
    alter table public.listings add constraint listings_floor_present check (floor_no is not null or floor_level is not null);
  end if;
end $$;

-- 마지막 확인일
alter table public.listings add column if not exists checked_at timestamptz;
update public.listings set checked_at = created_at where checked_at is null;
alter table public.listings alter column checked_at set default now();
alter table public.listings alter column checked_at set not null;

create or replace function public.touch_listing(p_id bigint)
returns timestamptz
language sql
security invoker
set search_path = public
as $$
  update public.listings set checked_at = now() where id = p_id returning checked_at;
$$;
revoke all on function public.touch_listing(bigint) from public, anon;
grant execute on function public.touch_listing(bigint) to authenticated;

-- 사이트가 새 칸을 바로 알아보도록 서버에 알림
notify pgrst, 'reload schema';

-- 끝. "Success. No rows returned" 가 나오면 정상입니다.
