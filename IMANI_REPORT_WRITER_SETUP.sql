-- IMANI_REPORT_WRITER_SETUP.sql
-- Database side of Imani Whitfield's SD report writer (api/imani-report-writer.ts).
-- Apply AFTER the route is deployed to production, so the first call lands on a live route.
--
-- Already applied earlier (kept here for the record):
--   * vault secret "cron_secret"  (the shared secret the database sends to app routes)
--   * report_spots, report_writer_runs tables; finished_reports.writer_started_at / writer_attempts
--
-- What this file adds:
--   1. A trigger: when a finished_reports row reaches status 'numbers_worked_out', call the route.
--   2. A retry sweep every 10 minutes for rows stuck at 'numbers_worked_out' for more than 5 minutes
--      (the route itself caps attempts at 3 and holds a 15-minute run lock).

create or replace function public.start_report_writer()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  if v_secret is null then
    raise warning 'start_report_writer: cron_secret is missing from the vault';
    return new;
  end if;
  perform net.http_post(
    url := 'https://app.druaiconsulting.com/api/imani-report-writer',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
    body := jsonb_build_object('access_token', new.access_token),
    timeout_milliseconds := 5000
  );
  return new;
exception when others then
  raise warning 'start_report_writer failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists finished_reports_start_writer_insert on public.finished_reports;
create trigger finished_reports_start_writer_insert
  after insert on public.finished_reports
  for each row when (new.status = 'numbers_worked_out')
  execute function public.start_report_writer();

drop trigger if exists finished_reports_start_writer_update on public.finished_reports;
create trigger finished_reports_start_writer_update
  after update of status on public.finished_reports
  for each row when (new.status = 'numbers_worked_out' and old.status is distinct from new.status)
  execute function public.start_report_writer();

create or replace function public.retry_stuck_report_writers()
returns integer
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_secret text;
  r record;
  n integer := 0;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  if v_secret is null then return 0; end if;
  for r in
    select access_token from finished_reports
     where status = 'numbers_worked_out'
       and diagnostic_tier = 'strategic'
       and submitted_at < now() - interval '5 minutes'
       and coalesce(writer_attempts, 0) < 3
       and (writer_started_at is null or writer_started_at < now() - interval '15 minutes')
  loop
    perform net.http_post(
      url := 'https://app.druaiconsulting.com/api/imani-report-writer',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_secret),
      body := jsonb_build_object('access_token', r.access_token),
      timeout_milliseconds := 5000
    );
    n := n + 1;
  end loop;
  return n;
end;
$$;

select cron.schedule('dru-imani-report-writer-retry', '*/10 * * * *', $$select public.retry_stuck_report_writers();$$);
