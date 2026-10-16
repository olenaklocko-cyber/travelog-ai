-- ============================================================
-- «Мій розумний тревелог» — перепроєктування бази (тиждень 1)
-- Виправлення: trips.id у наявній базі — uuid, не bigint.
-- Ідемпотентний: можна виконувати повторно.
-- ============================================================

-- 1. ДОВІДНИК КРАЇН
-- ============================================================
create table if not exists krajiny (
  code  text primary key check (char_length(code) = 2),
  nazva text not null,
  emoji text not null default '🌍'
);

insert into krajiny (code, nazva, emoji) values
  ('UA', 'Україна', '🇺🇦'),
  ('PL', 'Польща', '🇵🇱'),
  ('DE', 'Німеччина', '🇩🇪'),
  ('FR', 'Франція', '🇫🇷'),
  ('IT', 'Італія', '🇮🇹'),
  ('ES', 'Іспанія', '🇪🇸'),
  ('GB', 'Велика Британія', '🇬🇧'),
  ('US', 'США', '🇺🇸'),
  ('AE', 'ОАЕ', '🇦🇪'),
  ('TR', 'Туреччина', '🇹🇷'),
  ('EG', 'Єгипет', '🇪🇬'),
  ('TH', 'Таїланд', '🇹🇭'),
  ('JP', 'Японія', '🇯🇵'),
  ('GR', 'Греція', '🇬🇷'),
  ('PT', 'Португалія', '🇵🇹')
on conflict (code) do nothing;

-- 2. ПОДОРОЖІ — додаємо обмеження, якщо їх нема
-- ============================================================
-- Додаємо CHECK на status, якщо колонка існує і CHECK нема
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'trips_status_check'
  ) then
    alter table trips add constraint trips_status_check
      check (status in ('zbyrayut', 'aktyvni', 'zaversheni', 'Активні збори', 'В дорозі', 'Завершена'));
  end if;
exception
  when undefined_column then null;
end $$;

-- 3. ВИТРАТИ/ДОХОДИ
-- ============================================================
create table if not exists expenses (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references trips (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  typ        text not null check (typ in ('dohid', 'vytrata', 'Дохід', 'Витрата')),
  suma       numeric(12,2) not null check (suma > 0),
  opys       text default '',
  created_at timestamptz not null default now()
);

-- 4. ФОТО ПОДОРОЖЕЙ
-- ============================================================
create table if not exists photos (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references trips (id) on delete cascade,
  url        text not null,
  pidpys     text default '',
  created_at timestamptz not null default now()
);

-- 5. ВІДГУКИ — додаємо sesiya
-- ============================================================
alter table vidhuky add column if not exists sesiya text;

-- 6. ВІДВІДУВАННЯ — dedup
-- ============================================================
delete from vizyty a
using vizyty b
where a.id > b.id
  and a.sesiya = b.sesiya
  and a.den = b.den
  and a.shlyah = b.shlyah;

create unique index if not exists vizyty_uno_sesiya_den_shlyah
  on vizyty (sesiya, den, shlyah);

-- ============================================================
-- ІНДЕКСИ
-- ============================================================
create index if not exists trips_user_created_idx
  on trips (user_id, created_at desc);

create index if not exists trips_user_status_idx
  on trips (user_id, status);

create index if not exists expenses_trip_idx
  on expenses (trip_id);

create index if not exists expenses_user_idx
  on expenses (user_id);

create index if not exists photos_trip_idx
  on photos (trip_id);

create index if not exists vidhuky_created_idx
  on vidhuky (created_at desc);

create index if not exists vizyty_sesiya_den_idx
  on vizyty (sesiya, den);

-- ============================================================
-- RLS
-- ============================================================
alter table krajiny enable row level security;
drop policy if exists krajiny_chytaty on krajiny;
create policy krajiny_chytaty on krajiny for select using (true);

alter table expenses enable row level security;
drop policy if exists expenses_polityka on expenses;
create policy expenses_polityka on expenses for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table photos enable row level security;
drop policy if exists photos_polityka on photos;
create policy photos_polityka on photos for all
  using (exists (
    select 1 from trips t
    where t.id = photos.trip_id and t.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from trips t
    where t.id = photos.trip_id and t.user_id = auth.uid()
  ));

-- ============================================================
-- ВИГЛЯД
-- ============================================================
create or replace view trips_z_vidatamy as
select
  t.*,
  coalesce((
    select sum(e.suma) from expenses e
    where e.trip_id = t.id and e.typ in ('vytrata', 'Витрата')
  ), 0) as vytracheno,
  coalesce((
    select sum(e.suma) from expenses e
    where e.trip_id = t.id and e.typ in ('dohid', 'Дохід')
  ), 0) as zibrano
from trips t;
