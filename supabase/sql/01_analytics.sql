-- 📊 Тиждень 8: аналітика відвідувань + зворотний зв'язок
-- Виконати в Supabase → SQL Editor → вставити увесь файл → Run
-- Скрипт ідемпотентний: його можна запускати повторно без помилок

create table if not exists vizyty (
  id bigint generated always as identity primary key,
  den date not null default (now() at time zone 'utc')::date,
  sesiya text not null,
  shlyah text not null default '/',
  chas timestamptz not null default now()
);
create index if not exists vizyty_den_idx on vizyty (den);

create table if not exists vidhuky (
  id bigint generated always as identity primary key,
  teks text not null check (char_length(trim(teks)) between 3 and 1000),
  chas timestamptz not null default now(),
  opraciovano boolean not null default false
);

alter table vizyty enable row level security;
alter table vidhuky enable row level security;

drop policy if exists "vizyty insert" on vizyty;
create policy "vizyty insert" on vizyty for insert to anon, authenticated with check (true);
drop policy if exists "vidhuky insert" on vidhuky;
create policy "vidhuky insert" on vidhuky for insert to anon, authenticated with check (true);
drop policy if exists "vizyty select owner" on vizyty;
create policy "vizyty select owner" on vizyty for select to authenticated using (auth.jwt() ->> 'email' = 'olenaklocko@gmail.com');
drop policy if exists "vidhuky select owner" on vidhuky;
create policy "vidhuky select owner" on vidhuky for select to authenticated using (auth.jwt() ->> 'email' = 'olenaklocko@gmail.com');
drop policy if exists "vidhuky update owner" on vidhuky;
create policy "vidhuky update owner" on vidhuky for update to authenticated using (auth.jwt() ->> 'email' = 'olenaklocko@gmail.com') with check (auth.jwt() ->> 'email' = 'olenaklocko@gmail.com');
