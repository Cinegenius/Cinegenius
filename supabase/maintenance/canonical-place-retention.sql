-- Authorized postgres operator only. Thirty days is an operational rollback window.
-- No immediate purge, changes to unrelated jobs/settings, or cron-history deletion.
do $retention$
declare target_job bigint;scheduler_zone text:=coalesce(current_setting('cron.timezone',true),'GMT');
begin
set local lock_timeout='3s';
set local statement_timeout='30s';
create extension if not exists pg_cron;
 if current_user<>'postgres' then raise exception 'Run maintenance as the authorized postgres operator';end if;
 if scheduler_zone not in ('GMT','UTC','Etc/UTC','Etc/GMT') then raise exception 'Review scheduler timezone before applying this UTC schedule';end if;
 if to_regprocedure('public.purge_place_change_journal()') is null then raise exception 'Canonical place migration is required first';end if;
 if has_function_privilege('anon','public.purge_place_change_journal()','execute') or has_function_privilege('authenticated','public.purge_place_change_journal()','execute') then raise exception 'Journal cleanup must remain service/operator-only';end if;
 if not has_function_privilege('service_role','public.purge_place_change_journal()','execute') then raise exception 'Journal cleanup service privilege is missing';end if;
 if exists(select 1 from cron.job where jobname='cinegenius-place-journal-retention' and username<>current_user) then raise exception 'Same-named job has a different owner; review required';end if;
 select cron.schedule('cinegenius-place-journal-retention','17 3 * * *','SELECT public.purge_place_change_journal();') into target_job;
 perform cron.alter_job(target_job,active:=true);
 if not exists(select 1 from cron.job where jobid=target_job and jobname='cinegenius-place-journal-retention' and schedule='17 3 * * *' and command='SELECT public.purge_place_change_journal();' and username=current_user and database=current_database() and active=true) then raise exception 'Retention job verification failed';end if;
end $retention$;
select jobname,schedule,command,database,username,active,coalesce(current_setting('cron.timezone',true),'GMT') as scheduler_timezone from cron.job where jobname='cinegenius-place-journal-retention';
