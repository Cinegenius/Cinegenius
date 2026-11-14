-- Keep existing service-only permissions and bodies; bind writes to the intended
-- schema even when a caller changes its session search path.
alter function public.update_profile_modules(text,text,jsonb) set search_path = public, pg_temp;
alter function public.update_profile_physical(text,text,jsonb) set search_path = public, pg_temp;
alter function public.upsert_rate_limit(text,integer,timestamptz) set search_path = public, pg_temp;

-- Identical, non-constraint indexes verified against the production catalogue.
-- Retain reviews_target_idx and the user_settings primary key (including uniqueness).
drop index if exists public.idx_reviews_target;
drop index if exists public.user_settings_user_id_uidx;
