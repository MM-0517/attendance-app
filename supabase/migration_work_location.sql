-- 既存の勤怠管理データベースに勤務場所欄を追加するためのSQL
alter table public.attendance_records
add column if not exists work_location text;
