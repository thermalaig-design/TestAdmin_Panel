alter table public."Trust"
  add column if not exists gst_number text null,
  add column if not exists pan_number text null,
  add column if not exists website text null,
  add column if not exists email_id text null,
  add column if not exists remark1 text null,
  add column if not exists remark2 text null,
  add column if not exists remark3 text null;
