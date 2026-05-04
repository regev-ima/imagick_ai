-- Original migration: SELECT cron.unschedule(3);
-- Made tolerant: the new project may not have a job with this ID.
DO $$ BEGIN
  PERFORM cron.unschedule(3);
EXCEPTION WHEN OTHERS THEN NULL; END $$;
