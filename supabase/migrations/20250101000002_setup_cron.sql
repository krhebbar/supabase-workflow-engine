-- Setup pg_cron extension for scheduled workflow execution
--
-- This migration configures the pg_cron extension to periodically
-- call the workflow_action_log_cron() function

-- Enable pg_cron extension (requires superuser, auto-enabled in Supabase)
-- create extension if not exists pg_cron;

-- Schedule the workflow cron function to run every minute
-- This will process all pending workflow actions
select cron.schedule(
    'workflow-processing',  -- job name
    '* * * * *',            -- cron expression: every minute
    'select public.workflow_action_log_cron();'
);

-- Optional: Schedule cleanup job to remove old completed logs
-- Runs daily at 2 AM to clean up logs older than 30 days
select cron.schedule(
    'workflow-cleanup',
    '0 2 * * *',  -- daily at 2 AM
    $$
    delete from public.workflow_action_logs
    where
        status in ('completed', 'stopped')
        and completed_at < now() - interval '30 days';
    $$
);

-- View scheduled cron jobs
-- select * from cron.job;

comment on schema cron is 'pg_cron extension for scheduling PostgreSQL commands';
