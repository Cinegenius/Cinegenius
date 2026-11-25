-- Five existing Supabase Advisor warnings, read-only check on 25 November 2026.
-- Pure JSON/path helpers use pg_catalog builtins and explicit public calls.
-- Preserve all bodies, signatures, privileges and visibility decisions.
begin;
alter function public.community_image_entries(jsonb) set search_path=pg_catalog;
alter function public.community_production_images(jsonb) set search_path=pg_catalog;
alter function public.community_decode_path(text) set search_path=pg_catalog;
alter function public.community_direct_image_entries(jsonb,text) set search_path=pg_catalog;
alter function public.place_record_key(text,jsonb) set search_path=pg_catalog;
notify pgrst,'reload schema';
commit;
