-- Add structured presentation metadata for new notifications only.
-- Existing title/body, records, RLS, table grants and RPC grants remain in place.
-- Latest authoritative sources:
--   20261024191000_direct_company_invitations.sql (both company RPCs)
--   20261029020000_admin_review_discretion.sql (offer_review_transition)
-- One statement is atomic even in SQL editors that run statements separately.
-- Known-body guards refuse to replace a missing, older or independently changed RPC.
DO $notification_localization$
DECLARE
 patch record;
 function_oid oid;
 current_source text;
 next_source text;
 definition text;
 column_type oid;
 column_not_null boolean;
 column_default text;
BEGIN
 IF to_regclass('public.notifications') IS NULL THEN
  RAISE EXCEPTION 'Required public.notifications table is missing';
 END IF;
 SELECT a.atttypid,a.attnotnull,pg_get_expr(d.adbin,d.adrelid)
 INTO column_type,column_not_null,column_default
 FROM pg_attribute a
 LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
 WHERE a.attrelid='public.notifications'::regclass AND a.attname='localization' AND NOT a.attisdropped;
 IF column_type IS NULL THEN
  ALTER TABLE public.notifications ADD COLUMN localization jsonb;
 ELSIF column_type<>'jsonb'::regtype OR column_not_null OR (column_default IS NOT NULL AND column_default<>'NULL::jsonb') THEN
  RAISE EXCEPTION 'Existing notifications.localization has an unexpected type, nullability or default';
 END IF;

 FOR patch IN SELECT * FROM (VALUES
  ('public.invite_company_member(text,uuid,text,text[])','a7297a4d587067d78079011b7a93eaa4','ee524a37e8e7adb4bb3e9309a0a93af3',
$old_invite_company_member$insert into public.notifications(user_id,type,title,body,href) values(p_recipient,'company_invitation','Einladung ins Firmenteam',co.name||' lädt dich ein: '||array_to_string(p_titles,' · ')||'. Die Zuordnung wird erst nach deiner Annahme öffentlich.','/company-invitations');$old_invite_company_member$,
$new_invite_company_member$insert into public.notifications(user_id,type,title,body,href,localization) values(p_recipient,'company_invitation','Einladung ins Firmenteam',co.name||' lädt dich ein: '||array_to_string(p_titles,' · ')||'. Die Zuordnung wird erst nach deiner Annahme öffentlich.','/company-invitations',
  jsonb_build_object('version',1,
   'title',jsonb_build_object('key','companyInvitationTitle'),
   'body',jsonb_build_object('key','companyInvitationBody','values',jsonb_build_object('company',co.name,'roles',array_to_string(p_titles,' · ')))));$new_invite_company_member$),
  ('public.respond_company_invitation(text,uuid,text)','a816537c4886e41941b3086b51caa857','f749d874a8fae804995236c70b35b715',
$old_respond_company_invitation$insert into public.notifications(user_id,type,title,body,href) values(
  case when p_decision='revoke' then inv.recipient_user_id else inv.created_by end,
  'company_invitation_response',case p_decision when 'accept' then 'Teameinladung angenommen' when 'decline' then 'Teameinladung abgelehnt' else 'Teameinladung zurückgezogen' end,
  co.name||': '||array_to_string(inv.public_titles,' · '),case when p_decision='revoke' then '/company-invitations' else '/company-dashboard?company_id='||co.id::text||'&tab=team' end);$old_respond_company_invitation$,
$new_respond_company_invitation$insert into public.notifications(user_id,type,title,body,href,localization) values(
  case when p_decision='revoke' then inv.recipient_user_id else inv.created_by end,
  'company_invitation_response',case p_decision when 'accept' then 'Teameinladung angenommen' when 'decline' then 'Teameinladung abgelehnt' else 'Teameinladung zurückgezogen' end,
  co.name||': '||array_to_string(inv.public_titles,' · '),case when p_decision='revoke' then '/company-invitations' else '/company-dashboard?company_id='||co.id::text||'&tab=team' end,
  jsonb_build_object('version',1,'title',jsonb_build_object('key',case p_decision
   when 'accept' then 'companyInvitationAccepted'
   when 'decline' then 'companyInvitationDeclined'
   else 'companyInvitationRevoked' end)));$new_respond_company_invitation$),
  ('public.offer_review_transition(text,uuid,jsonb,jsonb,jsonb,text,text,text,jsonb)','9dbd6a0f333645c4216ae5a9682425a7','11f1899625ffda43c8bd871e03de20ed',
$old_offer_review_transition$INSERT INTO notifications(user_id,type,title,body,href) VALUES(provider_id,'offer_review',p_notification->>'title',p_notification->>'body',p_notification->>'href');$old_offer_review_transition$,
$new_offer_review_transition$INSERT INTO notifications(user_id,type,title,body,href,localization) VALUES(provider_id,'offer_review',p_notification->>'title',p_notification->>'body',p_notification->>'href',p_notification->'localization');$new_offer_review_transition$)
 ) AS patches(signature,before_md5,after_md5,old_insert,new_insert) LOOP
  function_oid:=to_regprocedure(patch.signature);
  IF function_oid IS NULL THEN
   RAISE EXCEPTION 'Required RPC % is missing; no changes applied',patch.signature;
  END IF;
  SELECT prosrc INTO current_source FROM pg_proc WHERE oid=function_oid;
  IF md5(current_source)=patch.after_md5 THEN CONTINUE; END IF;
  IF md5(current_source)<>patch.before_md5 THEN
   RAISE EXCEPTION 'Unexpected body for RPC %; no changes applied',patch.signature;
  END IF;
  IF length(current_source)-length(replace(current_source,patch.old_insert,''))<>length(patch.old_insert) THEN
   RAISE EXCEPTION 'Notification INSERT is not unique in RPC %',patch.signature;
  END IF;
  next_source:=replace(current_source,patch.old_insert,patch.new_insert);
  IF md5(next_source)<>patch.after_md5 THEN
   RAISE EXCEPTION 'Unexpected replacement for RPC %',patch.signature;
  END IF;
  -- Reuse PostgreSQL's current header so defaults, security mode, search_path
  -- and other function attributes survive. CREATE OR REPLACE retains OID,
  -- ownership, dependencies and existing EXECUTE privileges.
  definition:=pg_get_functiondef(function_oid);
  EXECUTE replace(definition,patch.old_insert,patch.new_insert);
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid=function_oid)<>patch.after_md5 THEN
   RAISE EXCEPTION 'RPC verification failed for %',patch.signature;
  END IF;
 END LOOP;
 -- Refresh PostgREST's schema cache after commit; no notification row is emitted.
 PERFORM pg_notify('pgrst','reload schema');
END $notification_localization$;
