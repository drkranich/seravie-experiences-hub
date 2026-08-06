-- Reagenda o cron para rodar DE HORA EM HORA (a edge function decide, por tenant,
-- se é a hora configurada em automation_settings.daily_hour_utc). Envia
-- x-cron-secret lendo app.settings.cron_secret (defina via ALTER DATABASE ... SET).
do $$ begin perform cron.unschedule('seravie-automation-daily'); exception when others then null; end $$;
do $$ begin perform cron.unschedule('seravie-automation-hourly'); exception when others then null; end $$;
select cron.schedule(
  'seravie-automation-hourly', '0 * * * *',
  $$
  select extensions.http_post(
    url := 'https://qgmffsrgfyphmuqvafdc.supabase.co/functions/v1/automation-cron',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', coalesce(current_setting('app.settings.cron_secret', true), '')),
    body := jsonb_build_object('source','pg_cron')
  );
  $$
);
