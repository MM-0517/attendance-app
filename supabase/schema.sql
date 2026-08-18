create extension if not exists pgcrypto;
create type public.user_role as enum ('employee','admin');
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,name text not null,role public.user_role not null default 'employee',created_at timestamptz not null default now());
create table public.attendance_records(id uuid primary key default gen_random_uuid(),user_id uuid not null references public.profiles(id) on delete cascade,work_date date not null,clock_in timestamptz,clock_out timestamptz,clock_in_latitude double precision,clock_in_longitude double precision,clock_in_accuracy double precision,clock_out_latitude double precision,clock_out_longitude double precision,clock_out_accuracy double precision,work_location text,created_at timestamptz not null default now(),unique(user_id,work_date));
create table public.break_records(id uuid primary key default gen_random_uuid(),attendance_id uuid not null references public.attendance_records(id) on delete cascade,started_at timestamptz not null,ended_at timestamptz);
alter table public.profiles enable row level security;alter table public.attendance_records enable row level security;alter table public.break_records enable row level security;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$select exists(select 1 from public.profiles where id=auth.uid() and role='admin')$$;
create policy "profiles own/admin" on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create policy "attendance own/admin select" on public.attendance_records for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy "attendance own insert" on public.attendance_records for insert to authenticated with check(user_id=auth.uid());
create policy "attendance own update/admin" on public.attendance_records for update to authenticated using(user_id=auth.uid() or public.is_admin()) with check(user_id=auth.uid() or public.is_admin());
create policy "break own/admin select" on public.break_records for select to authenticated using(exists(select 1 from public.attendance_records a where a.id=attendance_id and (a.user_id=auth.uid() or public.is_admin())));
create policy "break own insert" on public.break_records for insert to authenticated with check(exists(select 1 from public.attendance_records a where a.id=attendance_id and a.user_id=auth.uid()));
create policy "break own update" on public.break_records for update to authenticated using(exists(select 1 from public.attendance_records a where a.id=attendance_id and a.user_id=auth.uid())) with check(exists(select 1 from public.attendance_records a where a.id=attendance_id and a.user_id=auth.uid()));
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$begin insert into public.profiles(id,name) values(new.id,coalesce(new.raw_user_meta_data->>'name',split_part(new.email,'@',1))); return new;end;$$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
-- 管理者化: update public.profiles set role='admin' where id='対象ユーザーUUID';

-- 位置情報を利用する場合の補足:
-- 緯度/経度/精度は勤怠レコードに保存されます。
-- 管理者のみ全社員の位置情報を閲覧できるよう、既存のRLSでattendance_recordsを保護しています。
