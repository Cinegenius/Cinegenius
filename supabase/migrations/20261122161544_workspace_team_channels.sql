-- Generated with Supabase CLI 2.81.3; reviewed SQL candidate, not yet applied.
BEGIN;
CREATE TABLE public.workspace_teams (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL CHECK(length(btrim(name)) BETWEEN 1 AND 80),
 created_by text NOT NULL, revision integer NOT NULL DEFAULT 1, archived_at timestamptz, created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE public.conversations ADD COLUMN workspace_team_id uuid REFERENCES public.workspace_teams(id);
CREATE INDEX conversations_workspace_team ON public.conversations(workspace_team_id) WHERE workspace_team_id IS NOT NULL;
CREATE TABLE public.workspace_team_members (
 team_id uuid NOT NULL REFERENCES public.workspace_teams(id), user_id text NOT NULL,
 role text NOT NULL DEFAULT 'member' CHECK(role IN ('admin','member')),
 status text NOT NULL CHECK(status IN ('invited','active','left','removed','declined')),
 invited_by text NOT NULL, joined_at timestamptz, left_at timestamptz,
 PRIMARY KEY(team_id,user_id), CHECK(status<>'active' OR joined_at IS NOT NULL)
);
CREATE INDEX workspace_team_members_own ON public.workspace_team_members(user_id,status,team_id);
CREATE TABLE public.workspace_team_channels (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),team_id uuid NOT NULL REFERENCES public.workspace_teams(id),
 conversation_id uuid NOT NULL UNIQUE REFERENCES public.conversations(id),
 visibility text NOT NULL DEFAULT 'team' CHECK(visibility IN ('team','selected')),
 default_join boolean NOT NULL DEFAULT true,default_write boolean NOT NULL DEFAULT true,archived_at timestamptz
);
CREATE INDEX workspace_team_channels_team ON public.workspace_team_channels(team_id,id);
CREATE TABLE public.workspace_team_channel_access (
 channel_id uuid NOT NULL REFERENCES public.workspace_team_channels(id),user_id text NOT NULL,
 can_see boolean,can_join boolean,can_write boolean,denied boolean NOT NULL DEFAULT false,
 PRIMARY KEY(channel_id,user_id)
);
CREATE TABLE public.workspace_team_preferences(user_id text PRIMARY KEY,show_in_inbox boolean NOT NULL DEFAULT false);
CREATE TABLE public.workspace_team_operations (
 user_id text NOT NULL,request_key text NOT NULL CHECK(request_key ~ '^[A-Za-z0-9_-]{8,128}$'),
 fingerprint bytea NOT NULL,team_id uuid REFERENCES public.workspace_teams(id),result jsonb NOT NULL,
 PRIMARY KEY(user_id,request_key)
);
DO $$ DECLARE tab text;BEGIN
 FOREACH tab IN ARRAY ARRAY['workspace_teams','workspace_team_members','workspace_team_channels','workspace_team_channel_access','workspace_team_preferences','workspace_team_operations'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',tab);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',tab);
 END LOOP;
END $$;

-- Read/join/write remain distinct. A deny overrides both defaults and grants.
CREATE FUNCTION public.workspace_team_right(p_conversation uuid,p_actor text,p_right text DEFAULT 'read') RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM workspace_team_channels WHERE conversation_id=p_conversation) THEN true ELSE EXISTS(
  SELECT 1 FROM workspace_team_channels ch JOIN workspace_teams t ON t.id=ch.team_id AND t.archived_at IS NULL
  JOIN workspace_team_members tm ON tm.team_id=t.id AND tm.user_id=p_actor AND tm.status='active'
  LEFT JOIN workspace_team_channel_access a ON a.channel_id=ch.id AND a.user_id=p_actor
  WHERE ch.conversation_id=p_conversation AND ch.archived_at IS NULL AND NOT coalesce(a.denied,false)
   AND coalesce(a.can_see,ch.visibility='team')
   AND CASE p_right WHEN 'join' THEN coalesce(a.can_join,ch.default_join)
    WHEN 'write' THEN coalesce(a.can_write,ch.default_write) WHEN 'read' THEN true ELSE false END
 ) END;
$$;
-- Metadata for existing messages routes; absence before migration is explicitly
-- handled by the server adapter. The result never grants conversation access.
CREATE FUNCTION public.workspace_team_context(p_actor text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT jsonb_build_object('version',1,'showInInbox',coalesce((SELECT show_in_inbox FROM workspace_team_preferences WHERE user_id=p_actor),false),
 'channels',coalesce((SELECT jsonb_agg(jsonb_build_object('conversationId',ch.conversation_id,'teamId',ch.team_id,'channelId',ch.id,
 'canWrite',public.workspace_team_right(ch.conversation_id,p_actor,'write'))) FROM workspace_team_channels ch JOIN conversation_members cm ON cm.conversation_id=ch.conversation_id AND cm.user_id=p_actor AND cm.left_at IS NULL),'[]'::jsonb));
$$;

CREATE FUNCTION public.workspace_teams_v1(p_actor text,p_action text,p jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='2s' AS $$
DECLARE team uuid;channel uuid;target text;key text;fp bytea;prior workspace_team_operations;current_team workspace_teams;me workspace_team_members;
 ch workspace_team_channels;peer record;output jsonb;name text;at_time timestamptz:=clock_timestamp();mutating boolean;last_admin boolean;
BEGIN
 IF p_actor IS NULL OR p_actor !~ '^[A-Za-z0-9_-]{1,128}$' OR p_actor='cinegenius-support' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='teams_unavailable';END IF;
 IF p_action NOT IN ('list','team','create_team','invite','accept','decline','leave_team','remove_member','promote','create_channel','configure_channel','set_access','join','leave','preference') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='teams_invalid';END IF;
 mutating:=p_action NOT IN ('list','team');
 IF mutating THEN
  key:=p->>'key';IF key IS NULL OR key !~ '^[A-Za-z0-9_-]{8,128}$' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='teams_invalid';END IF;
  IF NOT pg_try_advisory_xact_lock(hashtextextended('workspace-team-op:'||p_actor||':'||key,0)) THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='teams_busy';END IF;
  fp:=sha256(convert_to(jsonb_build_object('action',p_action,'payload',p)::text,'UTF8'));
  SELECT * INTO prior FROM workspace_team_operations WHERE user_id=p_actor AND request_key=key;
  IF FOUND THEN
   IF prior.fingerprint<>fp THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='teams_key_reused';END IF;
   IF prior.team_id IS NOT NULL AND p_action NOT IN ('leave_team','decline') AND NOT EXISTS(SELECT 1 FROM workspace_team_members WHERE team_id=prior.team_id AND user_id=p_actor AND status IN ('active','invited')) THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='teams_unavailable';END IF;
   RETURN prior.result;
  END IF;
 END IF;
 IF p_action='list' THEN
  RETURN jsonb_build_object('version',1,'accountId',p_actor,'showInInbox',coalesce((SELECT show_in_inbox FROM workspace_team_preferences WHERE user_id=p_actor),false),'teams',coalesce((SELECT jsonb_agg(jsonb_build_object('id',wt.id,'name',wt.name,'revision',wt.revision,'role',m.role,'status',m.status) ORDER BY wt.created_at DESC,wt.id) FROM workspace_teams wt JOIN workspace_team_members m ON m.team_id=wt.id AND m.user_id=p_actor AND m.status IN ('active','invited') WHERE wt.archived_at IS NULL),'[]'::jsonb));
 ELSIF p_action='preference' THEN
  IF jsonb_typeof(p->'showInInbox') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='teams_invalid';END IF;
  INSERT INTO workspace_team_preferences VALUES(p_actor,(p->>'showInInbox')::boolean) ON CONFLICT(user_id) DO UPDATE SET show_in_inbox=excluded.show_in_inbox;
  output:=jsonb_build_object('showInInbox',(p->>'showInInbox')::boolean);
 ELSIF p_action='create_team' THEN
  name:=btrim(p->>'name');IF name IS NULL OR length(name) NOT BETWEEN 1 AND 80 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='teams_invalid';END IF;
  -- Serialize the per-account maximum; no silent truncation in lists.
  PERFORM pg_advisory_xact_lock(hashtextextended('workspace-team-account:'||p_actor,0));
  IF (SELECT count(*) FROM workspace_team_members WHERE user_id=p_actor AND status IN ('active','invited'))>=100 THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='teams_full';END IF;
  INSERT INTO workspace_teams(name,created_by) VALUES(name,p_actor) RETURNING id INTO team;
  INSERT INTO workspace_team_members VALUES(team,p_actor,'admin','active',p_actor,at_time,NULL);
  output:=jsonb_build_object('teamId',team);
 ELSE
  team:=(p->>'teamId')::uuid;
  SELECT * INTO current_team FROM workspace_teams WHERE id=team AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='teams_unavailable';END IF;
  SELECT * INTO me FROM workspace_team_members WHERE team_id=team AND user_id=p_actor AND status IN ('active','invited');
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='teams_unavailable';END IF;
  IF p_action='team' THEN
   IF me.status<>'active' THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='teams_unavailable';END IF;
   RETURN jsonb_build_object('version',1,'accountId',p_actor,'id',team,'name',current_team.name,'revision',current_team.revision,'role',me.role,
    'members',coalesce((SELECT jsonb_agg(jsonb_build_object('userId',m.user_id,'name',coalesce(pr.display_name,m.user_id),'role',m.role,'status',m.status) ORDER BY m.role,m.user_id)
     FROM workspace_team_members m LEFT JOIN profiles pr ON pr.user_id=m.user_id WHERE m.team_id=team AND (m.status='active' OR me.role='admin' AND m.status='invited')),'[]'::jsonb),
    'channels',coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'conversationId',c.conversation_id,'name',cv.group_name,'visibility',c.visibility,'defaultJoin',c.default_join,'defaultWrite',c.default_write,
     'joined',cm.user_id IS NOT NULL,'canSee',public.workspace_team_right(c.conversation_id,p_actor,'read'),'canJoin',public.workspace_team_right(c.conversation_id,p_actor,'join'),'canWrite',public.workspace_team_right(c.conversation_id,p_actor,'write'),
     'access',CASE WHEN me.role='admin' THEN coalesce((SELECT jsonb_agg(jsonb_build_object('userId',a.user_id,'canSee',a.can_see,'canJoin',a.can_join,'canWrite',a.can_write,'denied',a.denied)) FROM workspace_team_channel_access a WHERE a.channel_id=c.id),'[]'::jsonb) ELSE '[]'::jsonb END) ORDER BY cv.created_at,c.id)
     FROM workspace_team_channels c JOIN conversations cv ON cv.id=c.conversation_id LEFT JOIN conversation_members cm ON cm.conversation_id=c.conversation_id AND cm.user_id=p_actor AND cm.left_at IS NULL
     WHERE c.team_id=team AND c.archived_at IS NULL AND (me.role='admin' OR public.workspace_team_right(c.conversation_id,p_actor,'read'))),'[]'::jsonb));
  END IF;
  IF me.status<>'active' AND p_action NOT IN ('accept','decline') THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='teams_unavailable';END IF;
  IF coalesce(p->>'revision','') !~ '^[0-9]{1,9}$' OR (p->>'revision')::integer<>current_team.revision THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='teams_changed';END IF;
  -- All membership changes serialize with sends using the same conversation rows.
  PERFORM 1 FROM conversations cv JOIN workspace_team_channels c ON c.conversation_id=cv.id WHERE c.team_id=team ORDER BY cv.id FOR UPDATE OF cv;
  at_time:=clock_timestamp();
  IF p_action IN ('accept','decline') THEN
   IF me.status<>'invited' THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='teams_changed';END IF;
   IF p_action='accept' THEN
    IF NOT public.messaging_recipient_available(p_actor,me.invited_by) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='teams_contact_unavailable';END IF;
    FOR peer IN SELECT user_id FROM workspace_team_members WHERE team_id=team AND status='active' AND user_id<>p_actor ORDER BY user_id LOOP PERFORM public.messaging_assert_group_pair(p_actor,p_actor,peer.user_id);END LOOP;
    UPDATE workspace_team_members SET status='active',joined_at=at_time,left_at=NULL WHERE team_id=team AND user_id=p_actor;
   ELSE UPDATE workspace_team_members SET status='declined',left_at=at_time WHERE team_id=team AND user_id=p_actor;END IF;
  ELSIF p_action IN ('leave_team','remove_member','promote','invite') THEN
   target:=CASE WHEN p_action='leave_team' THEN p_actor ELSE p->>'userId' END;
   IF target IS NULL OR target !~ '^[A-Za-z0-9_-]{1,128}$' OR target='cinegenius-support' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='teams_invalid';END IF;
   IF p_action<>'leave_team' AND me.role<>'admin' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='teams_admin_required';END IF;
   IF p_action='invite' THEN
    IF target=p_actor OR EXISTS(SELECT 1 FROM workspace_team_members WHERE team_id=team AND user_id=target AND status IN ('active','invited')) THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='teams_changed';END IF;
    IF (SELECT count(*) FROM workspace_team_members WHERE team_id=team AND status IN ('active','invited'))>=50 THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='teams_full';END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended('workspace-team-account:'||target,0));
    IF (SELECT count(*) FROM workspace_team_members WHERE user_id=target AND status IN ('active','invited'))>=100 THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='teams_full';END IF;
    IF NOT public.messaging_recipient_available(p_actor,target) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='teams_contact_unavailable';END IF;
    PERFORM public.messaging_assert_group_pair(p_actor,p_actor,target);
    INSERT INTO workspace_team_members VALUES(team,target,'member','invited',p_actor,NULL,NULL) ON CONFLICT(team_id,user_id) DO UPDATE SET role='member',status='invited',invited_by=p_actor,joined_at=NULL,left_at=NULL;
   ELSE
    IF NOT EXISTS(SELECT 1 FROM workspace_team_members WHERE team_id=team AND user_id=target AND status IN ('active','invited')) THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='teams_unavailable';END IF;
    IF p_action='promote' THEN
     UPDATE workspace_team_members SET role='admin' WHERE team_id=team AND user_id=target AND status='active';IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='teams_unavailable';END IF;
    ELSE
     IF EXISTS(SELECT 1 FROM workspace_team_members WHERE team_id=team AND user_id=target AND status='active' AND role='admin')
      AND EXISTS(SELECT 1 FROM workspace_team_members WHERE team_id=team AND user_id<>target AND status IN ('active','invited'))
      AND NOT EXISTS(SELECT 1 FROM workspace_team_members WHERE team_id=team AND user_id<>target AND status='active' AND role='admin') THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='teams_last_admin';END IF;
     UPDATE workspace_team_members SET status=CASE WHEN p_action='leave_team' THEN 'left' ELSE 'removed' END,left_at=at_time WHERE team_id=team AND user_id=target;
     UPDATE conversation_members cm SET left_at=at_time FROM workspace_team_channels c WHERE c.team_id=team AND cm.conversation_id=c.conversation_id AND cm.user_id=target AND cm.left_at IS NULL;
     IF NOT EXISTS(SELECT 1 FROM workspace_team_members WHERE team_id=team AND status='active') THEN UPDATE workspace_teams SET archived_at=at_time WHERE id=team;END IF;
    END IF;
   END IF;
  ELSE
   IF p_action='create_channel' THEN
    IF me.role<>'admin' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='teams_admin_required';END IF;
    name:=btrim(p->>'name');IF name IS NULL OR length(name) NOT BETWEEN 1 AND 80 OR coalesce(p->>'visibility','team') NOT IN ('team','selected') THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='teams_invalid';END IF;
    IF (SELECT count(*) FROM workspace_team_channels WHERE team_id=team AND archived_at IS NULL)>=100 THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='teams_full';END IF;
    INSERT INTO conversations(sender_id,receiver_id,kind,group_name,created_by,workspace_team_id) VALUES(p_actor,NULL,'group',name,p_actor,team) RETURNING id INTO channel;
    INSERT INTO workspace_team_channels(team_id,conversation_id,visibility) VALUES(team,channel,coalesce(p->>'visibility','team')) RETURNING * INTO ch;
   ELSE
    channel:=(p->>'channelId')::uuid;SELECT * INTO ch FROM workspace_team_channels WHERE id=channel AND team_id=team AND archived_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='teams_unavailable';END IF;
    IF p_action IN ('configure_channel','set_access') THEN
     IF me.role<>'admin' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='teams_admin_required';END IF;
     IF p_action='configure_channel' THEN
      name:=btrim(p->>'name');IF name IS NULL OR length(name) NOT BETWEEN 1 AND 80 OR p->>'visibility' IS NULL OR p->>'visibility' NOT IN ('team','selected')
       OR jsonb_typeof(p->'defaultJoin') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p->'defaultWrite') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p->'archived') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='teams_invalid';END IF;
      UPDATE conversations SET group_name=name WHERE id=ch.conversation_id;
      UPDATE workspace_team_channels SET visibility=p->>'visibility',default_join=(p->>'defaultJoin')::boolean,default_write=(p->>'defaultWrite')::boolean,archived_at=CASE WHEN (p->>'archived')::boolean THEN at_time END WHERE id=ch.id;
     ELSE
      target:=p->>'userId';IF NOT EXISTS(SELECT 1 FROM workspace_team_members WHERE team_id=team AND user_id=target AND status='active') THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='teams_unavailable';END IF;
      IF EXISTS(SELECT 1 FROM unnest(ARRAY['canSee','canJoin','canWrite']) k WHERE p?k AND jsonb_typeof(p->k) NOT IN ('boolean','null')) OR jsonb_typeof(p->'denied') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='teams_invalid';END IF;
      INSERT INTO workspace_team_channel_access VALUES(ch.id,target,(p->>'canSee')::boolean,(p->>'canJoin')::boolean,(p->>'canWrite')::boolean,(p->>'denied')::boolean)
       ON CONFLICT(channel_id,user_id) DO UPDATE SET can_see=excluded.can_see,can_join=excluded.can_join,can_write=excluded.can_write,denied=excluded.denied;
     END IF;
     UPDATE conversation_members cm SET left_at=at_time WHERE cm.conversation_id=ch.conversation_id AND cm.left_at IS NULL AND NOT public.workspace_team_right(cm.conversation_id,cm.user_id,'read');
    ELSIF p_action='join' THEN
     IF NOT public.workspace_team_right(ch.conversation_id,p_actor,'join') THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='teams_unavailable';END IF;
     IF NOT EXISTS(SELECT 1 FROM conversation_members WHERE conversation_id=ch.conversation_id AND user_id=p_actor AND left_at IS NULL) THEN
      IF (SELECT count(*) FROM conversation_members WHERE conversation_id=ch.conversation_id AND left_at IS NULL)>=50 THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='teams_full';END IF;
      FOR peer IN SELECT user_id FROM conversation_members WHERE conversation_id=ch.conversation_id AND left_at IS NULL ORDER BY user_id LOOP PERFORM public.messaging_assert_group_pair(p_actor,p_actor,peer.user_id);END LOOP;
      INSERT INTO conversation_members VALUES(ch.conversation_id,p_actor,'member',clock_timestamp(),NULL) ON CONFLICT(conversation_id,user_id) DO UPDATE SET role='member',joined_at=at_time,left_at=NULL;
     END IF;
    ELSIF p_action='leave' THEN
     IF NOT public.workspace_team_right(ch.conversation_id,p_actor,'read') THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='teams_unavailable';END IF;
     UPDATE conversation_members SET left_at=at_time WHERE conversation_id=ch.conversation_id AND user_id=p_actor AND left_at IS NULL;
    ELSE RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='teams_invalid';END IF;
   END IF;
  END IF;
  UPDATE workspace_teams SET revision=revision+1 WHERE id=team;
  output:=jsonb_build_object('teamId',team,'channelId',ch.id);
 END IF;
 INSERT INTO workspace_team_operations VALUES(p_actor,key,fp,team,output);
 RETURN output;
END $$;

CREATE FUNCTION public.workspace_team_draft_access(p_actor text,p_kind text,p_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM workspace_team_members m JOIN workspace_teams t ON t.id=m.team_id AND t.archived_at IS NULL
 WHERE m.user_id=p_actor AND m.status='active' AND ((p_kind='workspace-team' AND t.id=p_id) OR (p_kind='workspace-channel' AND m.role='admin' AND EXISTS(SELECT 1 FROM workspace_team_channels c WHERE c.id=p_id AND c.team_id=t.id AND c.archived_at IS NULL))));
$$;

-- Team channels cannot be added to or renamed through ordinary group controls.
ALTER FUNCTION public.manage_group_conversation(uuid,text,text,text,text) RENAME TO workspace_teams_legacy_manage_group;
CREATE FUNCTION public.manage_group_conversation(p_conversation_id uuid,p_actor_id text,p_action text,p_target_user_id text DEFAULT NULL,p_name text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM workspace_team_channels WHERE conversation_id=p_conversation_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='teams_manage_in_team';END IF;
 PERFORM public.workspace_teams_legacy_manage_group(p_conversation_id,p_actor_id,p_action,p_target_user_id,p_name);
END $$;
-- Trigger keeps all text/file sends behind current write permissions, including
-- pre-existing server paths. The shared row lock serializes against withdrawal.
CREATE FUNCTION public.workspace_team_message_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 PERFORM 1 FROM conversations WHERE id=NEW.conversation_id FOR UPDATE;
 IF NOT public.workspace_team_right(NEW.conversation_id,NEW.sender_id,'write') THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='teams_unavailable';END IF;
 IF EXISTS(SELECT 1 FROM workspace_team_channels WHERE conversation_id=NEW.conversation_id) THEN NEW.created_at:=clock_timestamp();END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER workspace_team_message_guard BEFORE INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.workspace_team_message_guard();
-- A joined Team channel may contain one person. Ordinary free groups keep
-- their two-person send rule and all existing pair, block and consent checks.
CREATE OR REPLACE FUNCTION public.send_conversation_message(p_conversation_id uuid,p_sender_id text,p_content text)
RETURNS SETOF public.messages LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp SET lock_timeout='2s' AS $$
DECLARE conversation public.conversations; recipient record;
BEGIN
  IF nullif(btrim(p_content),'') IS NULL OR length(btrim(p_content))>5000 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='messaging_invalid';
  END IF;
  SELECT * INTO conversation FROM public.conversations WHERE id=p_conversation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='messaging_unavailable'; END IF;
  PERFORM 1 FROM public.conversation_members WHERE conversation_id=p_conversation_id AND user_id=p_sender_id AND left_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='messaging_inactive'; END IF;
  IF conversation.kind='support' THEN
    IF conversation.receiver_id IS DISTINCT FROM p_sender_id THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='messaging_unavailable';
    END IF;
  ELSE
    IF p_sender_id='cinegenius-support' OR EXISTS(SELECT 1 FROM public.conversation_members WHERE conversation_id=p_conversation_id AND left_at IS NULL AND user_id='cinegenius-support') THEN
      RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='messaging_contact_unavailable';
    END IF;
    IF NOT EXISTS(SELECT 1 FROM public.conversation_members WHERE conversation_id=p_conversation_id AND left_at IS NULL AND user_id<>p_sender_id) AND NOT EXISTS(SELECT 1 FROM public.workspace_team_channels WHERE conversation_id=p_conversation_id) THEN
      RAISE EXCEPTION USING ERRCODE='PT404', MESSAGE='messaging_unavailable';
    END IF;
    FOR recipient IN SELECT user_id FROM public.conversation_members WHERE conversation_id=p_conversation_id AND left_at IS NULL AND user_id<>p_sender_id ORDER BY user_id LOOP
      PERFORM public.messaging_assert_pair(p_sender_id,recipient.user_id,false,false);
    END LOOP;
  END IF;
  RETURN QUERY INSERT INTO public.messages(conversation_id,sender_id,content)
    VALUES(p_conversation_id,p_sender_id,btrim(p_content)) RETURNING *;
  UPDATE public.conversations SET updated_at=now() WHERE id=p_conversation_id;
END $$;

create or replace function public.send_message_with_attachments(
 p_actor text,p_content text,p_key text,p_attachments uuid[],p_conversation uuid default null,p_recipient text default null,
 p_listing_id uuid default null,p_listing_title text default null,p_listing_type text default null
) returns jsonb language plpgsql security definer set search_path=public,pg_temp set lock_timeout='2s' as $$
declare payload jsonb;replay jsonb;target uuid:=p_conversation;conversation conversations;recipient record;message messages;attachment message_attachments;destination text;ids uuid[];
begin
 select array_agg(distinct value order by value) into ids from unnest(p_attachments) value;
 if p_actor is null or p_actor='cinegenius-support' or p_content is null or length(btrim(p_content))>5000
  or coalesce(cardinality(ids),0) not between 1 and 5 or cardinality(ids)<>cardinality(p_attachments)
  or (p_conversation is null)=(p_recipient is null) then
  raise exception using errcode='22023',message='messaging_invalid';end if;
 destination:=case when target is null then 'recipient:'||p_recipient else 'conversation:'||target::text end;
 payload:=jsonb_build_object('operation','attachment-send','conversation',target,'recipient',p_recipient,'content',btrim(p_content),'attachments',ids,'listing',p_listing_id,'title',p_listing_title,'type',p_listing_type);
 replay:=public.messaging_operation_replay(p_actor,p_key,payload);
 if replay is not null then
  if exists(select 1 from message_attachments a where a.message_id=(replay->'message'->>'id')::uuid and not exists(select 1 from readable_message_attachment(a.id,p_actor))) then
   raise exception using errcode='PT404',message='messaging_unavailable';end if;
  return jsonb_set(replay,'{message,attachments}',public.message_attachment_json((replay->'message'->>'id')::uuid));
 end if;
 -- Lock unbound uploads before sending. No client URL, filename or MIME grants access.
 foreach target in array ids loop
  select * into attachment from message_attachments where id=target for update;
  if not found or attachment.owner_user_id<>p_actor or attachment.message_id is not null or attachment.destination_key<>destination then
   raise exception using errcode='42501',message='messaging_contact_unavailable';end if;
  if attachment.mime_type like 'image/%' then
   perform 1 from media_assets a where a.reference_url=attachment.reference_url and a.owner_user_id=p_actor and a.source_type is null for update;
   if not found then raise exception using errcode='42501',message='messaging_contact_unavailable';end if;
  end if;
 end loop;
 target:=p_conversation;
 if target is null then
  if p_recipient is null or p_recipient !~ '^[A-Za-z0-9_-]{1,128}$' or p_recipient in (p_actor,'cinegenius-support') or length(coalesce(p_listing_title,''))>300 or length(coalesce(p_listing_type,''))>80 then
   raise exception using errcode='22023',message='messaging_invalid';end if;
  if not pg_try_advisory_xact_lock(hashtextextended('messaging-direct:'||least(p_actor,p_recipient)||':'||greatest(p_actor,p_recipient)||':'||coalesce(p_listing_id::text,'general'),0)) then
   raise exception using errcode='PT409',message='messaging_busy';end if;
  if not public.messaging_recipient_available(p_actor,p_recipient) then raise exception using errcode='42501',message='messaging_contact_unavailable';end if;
  select c.id into target from conversations c where c.kind='direct'
   -- Existing production conversations retain text listing IDs; newer schemas use uuid.
   and ((c.sender_id=p_actor and c.receiver_id=p_recipient) or (c.sender_id=p_recipient and c.receiver_id=p_actor)) and c.listing_id::text is not distinct from p_listing_id::text
   and exists(select 1 from conversation_members cm where cm.conversation_id=c.id and cm.user_id=p_actor and cm.left_at is null)
   and exists(select 1 from conversation_members cm where cm.conversation_id=c.id and cm.user_id=p_recipient and cm.left_at is null)
   order by c.created_at,c.id limit 1 for update;
  if not found then
   insert into conversations(sender_id,receiver_id,kind,created_by,listing_id,listing_title,listing_type) values(p_actor,p_recipient,'direct',p_actor,p_listing_id,p_listing_title,p_listing_type) returning id into target;
   insert into conversation_members(conversation_id,user_id,role,joined_at) values(target,p_actor,'member',now()),(target,p_recipient,'member',now());
  end if;
 end if;
 -- Same conversation lock and current recipient checks as a normal text send.
 select * into conversation from conversations where id=target for update;
 if not found then raise exception using errcode='PT404',message='messaging_unavailable';end if;
 perform 1 from conversation_members where conversation_id=target and user_id=p_actor and left_at is null for update;
 if not found then raise exception using errcode='PT404',message='messaging_inactive';end if;
 if conversation.kind='support' then
  if conversation.receiver_id is distinct from p_actor then raise exception using errcode='42501',message='messaging_unavailable';end if;
 else
  if not exists(select 1 from conversation_members where conversation_id=target and left_at is null and user_id<>p_actor) and not exists(select 1 from workspace_team_channels where conversation_id=target) then raise exception using errcode='PT404',message='messaging_unavailable';end if;
  for recipient in select user_id from conversation_members where conversation_id=target and left_at is null and user_id<>p_actor order by user_id loop
   if recipient.user_id='cinegenius-support' then raise exception using errcode='42501',message='messaging_contact_unavailable';end if;
   perform public.messaging_assert_pair(p_actor,recipient.user_id,false,false);
  end loop;
 end if;
 insert into messages(conversation_id,sender_id,content) values(target,p_actor,btrim(p_content)) returning * into message;
 update message_attachments set message_id=message.id where id=any(ids);
 update media_assets a set source_type='message',source_id=message.id::text where a.reference_url in(select reference_url from message_attachments where message_id=message.id) and a.source_type is null;
 update conversations set updated_at=now() where id=target;
 insert into messaging_operations(actor_user_id,request_key,request_fingerprint,conversation_id,message_id) values(p_actor,p_key,sha256(convert_to(payload::text,'UTF8')),target,message.id);
 return jsonb_build_object('conversationId',target,'message',to_jsonb(message)||jsonb_build_object('attachments',public.message_attachment_json(message.id)),'created',true,'replayed',false);
end $$;

-- Replays recheck the CURRENT join window. A previous send key is never a way
-- to retrieve a message before a fresh voluntary rejoin.
ALTER FUNCTION public.messaging_operation_replay(text,text,jsonb) RENAME TO workspace_teams_legacy_replay;
CREATE FUNCTION public.messaging_operation_replay(p_actor text,p_key text,p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;conv uuid;BEGIN
 result:=public.workspace_teams_legacy_replay(p_actor,p_key,p_payload);IF result IS NULL THEN RETURN NULL;END IF;
 conv:=(result->>'conversationId')::uuid;
 IF NOT public.workspace_team_right(conv,p_actor,'write') OR EXISTS(SELECT 1 FROM workspace_team_channels WHERE conversation_id=conv) AND result->'message'->>'id' IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM conversation_members cm JOIN messages m ON m.conversation_id=cm.conversation_id AND m.id=(result->'message'->>'id')::uuid WHERE cm.conversation_id=conv AND cm.user_id=p_actor AND cm.left_at IS NULL AND m.created_at>=cm.joined_at
 ) THEN RAISE EXCEPTION USING ERRCODE='PT404',MESSAGE='teams_unavailable';END IF;
 RETURN result;
END $$;
ALTER FUNCTION public.message_attachment_target(text,text) RENAME TO workspace_teams_legacy_attachment_target;
CREATE FUNCTION public.message_attachment_target(p_actor text,p_destination text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ BEGIN
 IF p_destination ~ '^conversation:[a-f0-9-]{36}$' AND NOT public.workspace_team_right(substring(p_destination from 14)::uuid,p_actor,'write') THEN RETURN false;END IF;
 RETURN public.workspace_teams_legacy_attachment_target(p_actor,p_destination);
END $$;
-- Ordinary inbox counters include Team channels only after private opt-in.
CREATE OR REPLACE FUNCTION public.unread_message_counts(p_user_id text) RETURNS TABLE(conversation_id text,unread_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT m.conversation_id::text,count(*)::bigint FROM messages m JOIN conversation_members cm ON cm.conversation_id=m.conversation_id AND cm.user_id=p_user_id AND cm.left_at IS NULL AND m.created_at>=cm.joined_at
 WHERE m.sender_id<>p_user_id AND public.workspace_team_right(m.conversation_id,p_user_id,'read')
 AND (NOT EXISTS(SELECT 1 FROM workspace_team_channels WHERE conversation_id=m.conversation_id) OR EXISTS(SELECT 1 FROM workspace_team_preferences WHERE user_id=p_user_id AND show_in_inbox))
 AND NOT EXISTS(SELECT 1 FROM message_reads mr WHERE mr.message_id=m.id AND mr.user_id=p_user_id) GROUP BY m.conversation_id;
$$;
-- Also protect future queued notifications, without enabling Push.
DO $$ BEGIN IF to_regprocedure('native_push_private.message_visible(uuid,text)') IS NOT NULL THEN
 ALTER FUNCTION native_push_private.message_visible(uuid,text) RENAME TO workspace_teams_legacy_message_visible;
 EXECUTE $fn$CREATE FUNCTION native_push_private.message_visible(message_id uuid,recipient text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS '
 SELECT native_push_private.workspace_teams_legacy_message_visible(message_id,recipient) AND EXISTS(SELECT 1 FROM public.messages m WHERE m.id=message_id AND public.workspace_team_right(m.conversation_id,recipient,''read''));'$fn$;
 REVOKE ALL ON FUNCTION native_push_private.message_visible(uuid,text) FROM PUBLIC,anon,authenticated;
END IF;END $$;
DO $$ DECLARE fn record;BEGIN
 FOR fn IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND (p.proname LIKE 'workspace_team%' OR p.proname IN ('manage_group_conversation','messaging_operation_replay','message_attachment_target','unread_message_counts')) LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',fn.signature);
  -- Internal legacy implementations must not remain callable by service RPC.
  IF fn.signature::text LIKE '%legacy%' THEN EXECUTE format('REVOKE ALL ON FUNCTION %s FROM service_role',fn.signature);
  ELSE EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',fn.signature);END IF;
 END LOOP;
END $$;
COMMIT;
