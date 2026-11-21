-- 사진전 마을의 "함께 쓰는 기록"(기도의 벽 · 촛불 · 다녀간 사람)을 위한 테이블입니다.
-- Supabase 대시보드 → SQL Editor 에 붙여 넣고 Run 을 누르세요.
-- 실시간으로 함께 걷기 · 대화만 쓸 거라면 이 파일은 실행하지 않아도 됩니다.
-- 여러 번 실행해도 괜찮습니다.

create table if not exists chapel_notes (
  id uuid primary key default gen_random_uuid(),
  t text not null check (char_length(t) between 1 and 80),
  name text check (char_length(name) <= 12),
  at bigint not null
);
create table if not exists chapel_candles (
  id bigint generated always as identity primary key,
  at bigint not null
);
create table if not exists chapel_visits (
  id bigint generated always as identity primary key,
  at bigint not null
);

alter table chapel_notes enable row level security;
alter table chapel_candles enable row level security;
alter table chapel_visits enable row level security;

-- 누구나 읽고 새로 쓸 수는 있지만, 고치거나 지울 수는 없습니다.
-- 부적절한 기도는 미디어팀이 대시보드 Table Editor 에서 지워 주세요.
drop policy if exists "모두 읽기" on chapel_notes;
drop policy if exists "모두 쓰기" on chapel_notes;
drop policy if exists "모두 읽기" on chapel_candles;
drop policy if exists "모두 쓰기" on chapel_candles;
drop policy if exists "모두 읽기" on chapel_visits;
drop policy if exists "모두 쓰기" on chapel_visits;
create policy "모두 읽기" on chapel_notes for select to anon using (true);
create policy "모두 쓰기" on chapel_notes for insert to anon with check (true);
create policy "모두 읽기" on chapel_candles for select to anon using (true);
create policy "모두 쓰기" on chapel_candles for insert to anon with check (true);
create policy "모두 읽기" on chapel_visits for select to anon using (true);
create policy "모두 쓰기" on chapel_visits for insert to anon with check (true);

-- 2026년 5월 30일 이후 만든 Supabase 프로젝트는 새 테이블을 웹(Data API)에 자동으로 열지 않습니다.
-- 그래서 방문자(anon)에게 읽기 · 새로 쓰기 권한만 직접 줍니다. 고치기 · 지우기 권한은 주지 않습니다.
grant usage on schema public to anon;
grant select, insert on chapel_notes, chapel_candles, chapel_visits to anon;
