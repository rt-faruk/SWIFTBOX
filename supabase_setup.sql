-- Snoonu Rider Duty Portal: baseline schema and RLS policies.
-- Review existing schema/policies before running in production.

create table if not exists public.riders (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  rider_id text unique not null,
  full_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.riders(id) on delete cascade,
  duty_date date not null,
  checkin_time timestamptz not null default now(),
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  constraint attendance_one_checkin_per_day unique (rider_id, duty_date)
);

alter table public.riders enable row level security;
alter table public.attendance enable row level security;

drop policy if exists "Rider can view own profile" on public.riders;
create policy "Rider can view own profile" on public.riders
for select to authenticated using (auth_user_id = auth.uid());

drop policy if exists "Admin manage riders" on public.riders;
create policy "Admin manage riders" on public.riders
for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "Rider read own attendance" on public.attendance;
create policy "Rider read own attendance" on public.attendance
for select to authenticated using (
  exists (select 1 from public.riders r
          where r.id = attendance.rider_id and r.auth_user_id = auth.uid())
  or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

drop policy if exists "Rider start own duty" on public.attendance;
create policy "Rider start own duty" on public.attendance
for insert to authenticated with check (
  exists (select 1 from public.riders r
          where r.id = attendance.rider_id
            and r.auth_user_id = auth.uid() and r.is_active = true)
  and duty_date = (now() at time zone 'Asia/Qatar')::date
);

drop policy if exists "Admin manage attendance" on public.attendance;
create policy "Admin manage attendance" on public.attendance
for all to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create index if not exists attendance_duty_date_idx on public.attendance(duty_date);
create index if not exists attendance_rider_date_idx on public.attendance(rider_id, duty_date);
