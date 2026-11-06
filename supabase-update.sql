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

-- 금액 변경 표시: 금액을 고치면 이전 금액과 바꾼 시각을 자동으로 남깁니다 (관리자 화면 ▲▼ 표시용)
alter table public.listings add column if not exists prev_price numeric;
alter table public.listings add column if not exists price_changed_at timestamptz;
create or replace function public.listing_price_track()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.price is distinct from old.price then
    new.prev_price := old.price;
    new.price_changed_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists listing_price_track on public.listings;
create trigger listing_price_track before update on public.listings
  for each row execute function public.listing_price_track();

-- 방문 통계 ------------------------------------------------------------
--   - 손님 브라우저의 무작위 방문자 번호만 씁니다 (이름·전화·IP 저장 안 함).
--   - 같은 사람은 하루에 방문 1번, 같은 단지 검색 1번, 같은 매물 보기 1번으로만 셉니다.
--   - 중복 확인용 기록(stat_seen)은 이틀 뒤, 하루 합계(stat_daily)는 400일 뒤 지워집니다.
create table if not exists public.stat_daily (
  day  date    not null,
  kind text    not null check (kind in ('visit', 'cx', 'listing')),  -- 방문(mobile/pc), 단지 검색, 매물 보기
  key  text    not null,
  n    integer not null default 0,
  primary key (day, kind, key)
);
create table if not exists public.stat_seen (
  day  date not null,
  kind text not null,
  key  text not null,
  vid  text not null,
  primary key (day, kind, key, vid)
);
-- 아침 보고용 열쇠 (값은 따로 넣습니다. 아무도 읽을 수 없음)
create table if not exists public.stat_secret (
  id    integer primary key default 1 check (id = 1),
  token text    not null
);
alter table public.stat_daily  enable row level security;
alter table public.stat_seen   enable row level security;
alter table public.stat_secret enable row level security;

drop policy if exists "stat_daily admin read" on public.stat_daily;
create policy "stat_daily admin read" on public.stat_daily for select to authenticated using (public.is_admin());
grant select on public.stat_daily to authenticated;

create or replace function public.stat_hit(p_kind text, p_key text, p_vid text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := (now() at time zone 'Asia/Seoul')::date;
  k text := left(coalesce(p_key, ''), 60);
  seen_key text;
begin
  if coalesce(p_vid, '') !~ '^[A-Za-z0-9]{6,40}$' then return; end if;
  if p_kind = 'visit' then
    if k not in ('mobile', 'pc') then return; end if;
    seen_key := '';                               -- 기기와 상관없이 하루 1번
  elsif p_kind = 'cx' then
    if not exists (select 1 from complexes where name = k) then return; end if;
    seen_key := k;
  elsif p_kind = 'listing' then
    if k !~ '^[0-9]{1,12}$' or not exists (select 1 from listings where id = k::bigint) then return; end if;
    seen_key := k;
  else
    return;
  end if;

  -- 한 방문자가 하루에 남길 수 있는 기록은 100개까지 (장난 방지)
  if (select count(*) from stat_seen where day = d and vid = p_vid) >= 100 then return; end if;

  insert into stat_seen (day, kind, key, vid) values (d, p_kind, seen_key, p_vid) on conflict do nothing;
  if not found then return; end if;              -- 오늘 이미 센 것

  insert into stat_daily (day, kind, key, n) values (d, p_kind, k, 1)
  on conflict (day, kind, key) do update set n = stat_daily.n + 1;

  delete from stat_seen  where day < d - 1;
  delete from stat_daily where day < d - 400;
end;
$$;
revoke all on function public.stat_hit(text, text, text) from public;
grant execute on function public.stat_hit(text, text, text) to anon, authenticated;

-- AI 검색어 통계 --------------------------------------------------------
--   손님이 AI 검색창에 입력한 문장을 그대로 모읍니다. 30일 지나면 자동으로 지워집니다.
--   같은 사람이 같은 문장을 하루에 여러 번 보내도 1번만 남깁니다.
create table if not exists public.stat_query (
  id    bigint generated by default as identity primary key,
  day   date        not null,
  at    timestamptz not null default now(),
  q     text        not null,
  result_count integer,             -- 찾은 매물 수 (매물 검색이 아닌 문장이면 비어 있음)
  vid   text        not null,
  unique (day, vid, q)
);
alter table public.stat_query enable row level security;   -- 정책 없음 = 손님은 읽을 수 없음
drop policy if exists "stat_query admin read" on public.stat_query;
create policy "stat_query admin read" on public.stat_query for select to authenticated using (public.is_admin());
grant select on public.stat_query to authenticated;

create or replace function public.stat_query_add(p_q text, p_found integer, p_vid text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d date := (now() at time zone 'Asia/Seoul')::date;
  v_q text := left(btrim(regexp_replace(coalesce(p_q, ''), '\s+', ' ', 'g')), 200);
begin
  if v_q = '' or coalesce(p_vid, '') !~ '^[A-Za-z0-9]{6,40}$' then return; end if;
  if (select count(*) from stat_query where day = d and vid = p_vid) >= 50 then return; end if;   -- 장난 방지
  insert into stat_query (day, q, result_count, vid) values (d, v_q, case when p_found between 0 and 100000 then p_found end, p_vid)
  on conflict (day, vid, q) do nothing;
  delete from stat_query where day < d - 30;
end;
$$;
revoke all on function public.stat_query_add(text, integer, text) from public;
grant execute on function public.stat_query_add(text, integer, text) to anon, authenticated;

-- 하루 통계 보고 (열쇠가 맞을 때만). p_day 를 비우면 어제(한국 시간)
create or replace function public.stat_report(p_token text, p_day date default null)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d date := coalesce(p_day, (now() at time zone 'Asia/Seoul')::date - 1);
begin
  if p_token is null or not exists (select 1 from stat_secret where token = p_token) then
    raise exception 'denied';
  end if;
  return json_build_object(
    'day', d,
    'mobile', coalesce((select n from stat_daily where day = d and kind = 'visit' and key = 'mobile'), 0),
    'pc',     coalesce((select n from stat_daily where day = d and kind = 'visit' and key = 'pc'), 0),
    'complexes', coalesce((select json_agg(x) from (
        select key as name, n from stat_daily where day = d and kind = 'cx' order by n desc, key limit 5) x), '[]'::json),
    'listings', coalesce((select json_agg(x) from (
        select s.key::bigint as id, s.n, c.name as complex, l.building, l.py_text, l.price, l.exclusive_area
        from stat_daily s
        left join listings l on l.id = s.key::bigint
        left join complexes c on c.id = l.complex_id
        where s.day = d and s.kind = 'listing'
        order by s.n desc, s.key limit 5) x), '[]'::json),
    'last7', coalesce((select json_agg(x order by x.day) from (
        select day, sum(n)::int as visitors from stat_daily
        where kind = 'visit' and day > d - 7 and day <= d group by day) x), '[]'::json),
    'queries', coalesce((select json_agg(x) from (
        select q as query, count(*)::int as n, min(result_count) as found
        from stat_query where day = d group by q order by count(*) desc, max(at) desc limit 10) x), '[]'::json),
    'query_count', (select count(*)::int from stat_query where day = d)
  );
end;
$$;
revoke all on function public.stat_report(text, date) from public;
grant execute on function public.stat_report(text, date) to anon, authenticated;

-- 사이트가 새 칸을 바로 알아보도록 서버에 알림
notify pgrst, 'reload schema';

-- 끝. "Success. No rows returned" 가 나오면 정상입니다.
