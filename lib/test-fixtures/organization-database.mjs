// Minimal legacy schema needed by the real organizations migration.
export const organizationTestBootstrap = `create role anon; create role authenticated; create role service_role;
    create table media_assets(storage_path text primary key,reference_url text,owner_user_id text,source_type text,source_id text,mime_type text);
    create table profiles(user_id text primary key,display_name text);
    create table companies(id uuid primary key,published boolean);
    create table listings(id uuid primary key);
    create table projects(id uuid primary key);
    create table project_drafts(id uuid primary key);
    create table community_posts(id uuid primary key);
    create table company_equipment(id uuid primary key);
    create table user_settings(user_id text,profile_visibility text);
    create table friendships(sender_id text,receiver_id text,status text);
    create table blocks(blocker_id text,blocked_id text);
    create function media_company_editor(text,text) returns boolean language sql as 'select false';
    create function media_company_reader(text,text) returns boolean language sql as 'select false';
    create function project_media_has_rights(jsonb,text) returns boolean language sql as 'select false';`;
