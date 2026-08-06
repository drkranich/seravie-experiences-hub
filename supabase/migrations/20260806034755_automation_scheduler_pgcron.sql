-- Agendador de automações baseadas em tempo: pg_cron chama a edge function
-- automation-cron todo dia às 12:00 UTC (09:00 BRT). pg_net (schema extensions)
-- faz a chamada HTTP.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

do $$
begin
  perform cron.unschedule('seravie-automation-daily');
exception when others then null;
end $$;

select cron.schedule(
  'seravie-automation-daily',
  '0 12 * * *',
  $$
  select extensions.http_post(
    url := 'https://qgmffsrgfyphmuqvafdc.supabase.co/functions/v1/automation-cron',
    headers := jsonb_build_object('Content-Type','application/json'),
    body := jsonb_build_object('source','pg_cron')
  );
  $$
);
