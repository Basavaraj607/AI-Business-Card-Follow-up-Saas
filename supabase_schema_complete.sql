-- ============================================================
--  CardFollowup — Complete Supabase Schema v2 (Idempotent)
--  Includes: User Registration, Admin Registration,
--            Multi-tenant CRM, RLS, Storage, pg_cron, Triggers
-- ============================================================

-- ── 0. Extensions ─────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";
create extension if not exists "unaccent";
create extension if not exists "pg_cron";

-- ── 1. Enums (Idempotent check via DO block) ──────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'lead_status') then
    create type lead_status as enum ('hot', 'warm', 'cold', 'converted', 'dead');
  end if;
  if not exists (select 1 from pg_type where typname = 'message_channel') then
    create type message_channel as enum ('email', 'whatsapp', 'sms', 'linkedin');
  end if;
  if not exists (select 1 from pg_type where typname = 'message_status') then
    create type message_status as enum ('draft', 'scheduled', 'sent', 'delivered', 'failed', 'replied');
  end if;
  if not exists (select 1 from pg_type where typname = 'followup_status') then
    create type followup_status as enum ('pending', 'sent', 'skipped', 'done');
  end if;
  if not exists (select 1 from pg_type where typname = 'member_role') then
    create type member_role as enum ('owner', 'admin', 'member');
  end if;
  if not exists (select 1 from pg_type where typname = 'plan_tier') then
    create type plan_tier as enum ('free', 'pro', 'team', 'enterprise');
  end if;
  if not exists (select 1 from pg_type where typname = 'user_type') then
    create type user_type as enum ('user', 'admin', 'superadmin');
  end if;
  if not exists (select 1 from pg_type where typname = 'admin_level') then
    create type admin_level as enum ('super', 'limited');
  end if;
  if not exists (select 1 from pg_type where typname = 'audit_action') then
    create type audit_action as enum ('login', 'logout', 'create', 'update', 'delete', 'suspend', 'impersonate', 'export');
  end if;
end
$$;

-- ── 2. updated_at Trigger Helper ──────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function create_updated_at_trigger(tbl text)
returns void language plpgsql as $$
begin
  -- Drop trigger if already exists to avoid errors on duplicate triggers
  execute format('drop trigger if exists trg_updated_at on %I', tbl);
  execute format(
    'create trigger trg_updated_at before update on %I
     for each row execute procedure set_updated_at()',
    tbl
  );
end;
$$;

-- ── 3. Workspace / Tenants Table ──────────────────────────
create table if not exists tenants (
  id           uuid        primary key default uuid_generate_v4(),
  name         text        not null,
  slug         text        not null unique,
  plan         plan_tier   not null default 'free',
  owner_id     uuid        not null,
  settings     jsonb       not null default '{}',
  is_suspended boolean     not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

select create_updated_at_trigger('tenants');

comment on table tenants is 'One workspace per user/organisation. Admins can see all tenants.';

-- ── 4. Profiles Table ─────────────────────────────────────
create table if not exists profiles (
  id                uuid        primary key references auth.users on delete cascade,
  tenant_id         uuid        not null references tenants (id) on delete cascade,
  email             text        not null,
  full_name         text,
  avatar_url        text,

  -- Role within a tenant workspace
  role              member_role not null default 'member',

  -- Platform-level type (drives routing + access)
  user_type         user_type   not null default 'user',

  -- Sender identity for follow-up messages
  sender_name       text,                   -- "From" display name in emails
  sender_phone      text,                   -- E.164, used for WhatsApp + SMS
  email_signature   text,                   -- appended to outbound emails

  -- MFA (applies to both users and admins)
  mfa_enabled       boolean     not null default false,
  mfa_secret        text,                   -- encrypted TOTP secret

  -- Account flags
  is_suspended      boolean     not null default false,
  suspended_at      timestamptz,
  suspended_by      uuid,                   -- admin who suspended

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

select create_updated_at_trigger('profiles');

create index if not exists idx_profiles_tenant    on profiles (tenant_id);
create index if not exists idx_profiles_type      on profiles (user_type);
create index if not exists idx_profiles_suspended on profiles (is_suspended) where is_suspended = true;

comment on table  profiles           is '1:1 with auth.users. Thin record — signup details in user_registrations / admin_registrations.';
comment on column profiles.user_type is 'user = regular tenant user. admin = limited admin. superadmin = full platform access.';
comment on column profiles.sender_phone is 'E.164 format. Must match number registered with Twilio / Meta WhatsApp API.';

-- ── 5. User Registration Table ────────────────────────────
create table if not exists user_registrations (
  id                uuid        primary key references auth.users on delete cascade,

  -- Required fields
  first_name        text        not null,
  last_name         text        not null,
  email             text        not null unique,

  -- Optional profile fields
  mobile_number     text,
  company_name      text,
  job_title         text,
  country           text,
  industry          text,

  -- Legal
  consent_given     boolean     not null default false,
  consent_given_at  timestamptz,           -- timestamp when consent was checked

  -- Account state
  is_active         boolean     not null default true,
  is_verified       boolean     not null default false,  -- email verified
  last_login_at     timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

select create_updated_at_trigger('user_registrations');

create index if not exists idx_user_reg_email    on user_registrations (email);
create index if not exists idx_user_reg_company  on user_registrations (company_name);
create index if not exists idx_user_reg_country  on user_registrations (country);

comment on table  user_registrations              is 'Extended signup fields for regular users. 1:1 with auth.users.';
comment on column user_registrations.consent_given_at is 'Exact timestamp consent checkbox was accepted — required for GDPR.';

-- ── 6. Admin Registration Table ───────────────────────────
create table if not exists admin_registrations (
  id                uuid        primary key references auth.users on delete cascade,

  -- Required fields
  full_name         text        not null,
  email             text        not null unique,
  mobile_number     text        not null,   -- required for admins (2FA)
  company_name      text        not null,
  admin_level       admin_level not null default 'limited',

  -- Optional fields
  designation       text,                   -- job title / role
  department        text,
  backup_contact    text,                   -- fallback phone/email

  -- Security
  mfa_enabled       boolean     not null default false,
  mfa_verified_at   timestamptz,           -- when MFA was successfully set up

  -- Legal
  consent_given     boolean     not null default false,
  consent_given_at  timestamptz,

  -- Account state
  is_active         boolean     not null default true,
  is_suspended      boolean     not null default false,
  suspended_reason  text,
  last_login_at     timestamptz,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

select create_updated_at_trigger('admin_registrations');

create index if not exists idx_admin_reg_email       on admin_registrations (email);
create index if not exists idx_admin_reg_level       on admin_registrations (admin_level);
create index if not exists idx_admin_reg_company     on admin_registrations (company_name);

comment on table  admin_registrations            is 'Registration data for admin accounts. Stricter than user_registrations.';
comment on column admin_registrations.admin_level is 'super = full platform access. limited = read + limited write.';
comment on column admin_registrations.mfa_verified_at is 'Null means MFA is enrolled but not yet verified.';

-- ── 7. Companies Table ────────────────────────────────────
create table if not exists companies (
  id           uuid        primary key default uuid_generate_v4(),
  tenant_id    uuid        not null references tenants(id) on delete cascade,
  name         text        not null,
  domain       text,
  industry     text,
  website      text,
  linkedin_url text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint unique_tenant_company_name unique (tenant_id, name)
);

select create_updated_at_trigger('companies');

-- ── 8. Contacts Table ─────────────────────────────────────
create table if not exists contacts (
  id uuid primary key default uuid_generate_v4(),

  -- Multi-tenant
  tenant_id uuid not null
    references tenants(id) on delete cascade,

  created_by uuid
    references profiles(id) on delete set null,

  owner_id uuid
    references profiles(id) on delete set null,

  company_id uuid
    references companies(id) on delete set null,

  -- Core Contact Information
  full_name text not null,
  email text,
  phone text,
  role text,
  department text,

  -- Company / Social
  linkedin_url text,
  twitter_handle text,

  -- Source Tracking
  source text not null default 'business_card',

  -- Business Card Storage
  card_image_url text,
  card_image_path text,

  -- OCR + AI Processing
  raw_ocr_text text,

  ai_structured jsonb default '{}',

  ai_notes text,
  last_interaction_summary text,

  -- Lead Intelligence
  lead_status lead_status not null default 'warm',

  lead_score int
    check (lead_score between 0 and 100),

  opportunity_type text,

  -- Relationship Tracking
  relationship_stage text
    not null default 'new',

  -- Meeting Context
  met_at_event text,
  met_at_date date,
  met_at_location text,
  context_notes text,

  -- Communication Statistics
  email_count int not null default 0,
  whatsapp_count int not null default 0,
  sms_count int not null default 0,

  -- Follow-up
  followup_status text default 'pending',

  last_contacted_at timestamptz,
  next_followup_at timestamptz,

  -- Tags
  tags text[] not null default '{}',

  -- Duplicate Detection
  contact_hash text unique,

  -- Archive
  is_archived boolean not null default false,

  -- Search
  search_vector tsvector,

  -- Audit
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select create_updated_at_trigger('contacts');

create index if not exists idx_contacts_tenant on contacts (tenant_id);
create index if not exists idx_contacts_created_by on contacts (created_by);
create index if not exists idx_contacts_lead_status on contacts (lead_status);

-- ── 9. Messages Table ─────────────────────────────────────
create table if not exists messages (
  id             uuid            primary key default uuid_generate_v4(),
  tenant_id      uuid            not null references tenants(id) on delete cascade,
  contact_id     uuid            not null references contacts(id) on delete cascade,
  sent_by        uuid            not null references profiles(id) on delete set null,
  channel        message_channel not null default 'email',
  status         message_status  not null default 'draft',
  subject        text,
  body           text            not null,
  ai_generated   boolean         not null default false,
  scheduled_for  timestamptz,
  sent_at        timestamptz,
  opened_at      timestamptz,
  replied_at     timestamptz,
  external_id    text,
  metadata       jsonb           not null default '{}',
  created_at     timestamptz     not null default now(),
  updated_at     timestamptz     not null default now()
);

select create_updated_at_trigger('messages');

create index if not exists idx_messages_tenant on messages (tenant_id);
create index if not exists idx_messages_contact on messages (contact_id);

-- ── 10. Follow-ups Table ──────────────────────────────────
create table if not exists followups (
  id             uuid            primary key default uuid_generate_v4(),
  tenant_id      uuid            not null references tenants(id) on delete cascade,
  contact_id     uuid            not null references contacts(id) on delete cascade,
  assigned_to    uuid            not null references profiles(id) on delete set null,
  status         followup_status not null default 'pending',
  channel        message_channel not null default 'email',
  due_at         timestamptz     not null,
  message_draft  text,
  subject_draft  text,
  ai_suggestion  text,
  completed_at   timestamptz,
  notes          text,
  step_number    int             not null default 1,
  created_at     timestamptz     not null default now(),
  updated_at     timestamptz     not null default now()
);

select create_updated_at_trigger('followups');

create index if not exists idx_followups_tenant on followups (tenant_id);
create index if not exists idx_followups_contact on followups (contact_id);

-- ── 11. Platform Settings Table ───────────────────────────
create table if not exists platform_settings (
  id                    text            primary key,
  maintenance_mode      boolean         not null default false,
  max_contacts_limit    int             not null default 100,
  max_messages_limit    int             not null default 50,
  default_resend_key    text,
  default_twilio_sid    text,
  default_twilio_token  text,
  default_twilio_phone  text,
  default_meta_token    text,
  default_meta_phone_id text,
  feature_flags         jsonb           not null default '{}'::jsonb,
  created_at            timestamptz     not null default now(),
  updated_at            timestamptz     not null default now()
);

select create_updated_at_trigger('platform_settings');

-- Seed default global settings
insert into platform_settings (id, maintenance_mode, max_contacts_limit, max_messages_limit)
values ('global', false, 100, 50)
on conflict (id) do nothing;

-- ── 12. Audit Logs Table ──────────────────────────────────
create table if not exists audit_logs (
  id            uuid         primary key default uuid_generate_v4(),
  performed_by  uuid         not null references auth.users on delete cascade,
  action        audit_action not null,
  target_type   text,
  target_id     uuid,
  target_tenant uuid         references tenants(id) on delete set null,
  metadata      jsonb        not null default '{}',
  ip_address    inet,
  user_agent    text,
  created_at    timestamptz  not null default now()
);

create index if not exists idx_audit_by      on audit_logs (performed_by);
create index if not exists idx_audit_target  on audit_logs (target_type, target_id);
create index if not exists idx_audit_tenant  on audit_logs (target_tenant);
create index if not exists idx_audit_created on audit_logs (created_at desc);

comment on table audit_logs is 'Immutable log of all admin actions. No RLS delete allowed.';

-- ── 13. Security Helper Functions for RLS ─────────────────
create or replace function my_tenant_id()
returns uuid language sql stable security definer as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

create or replace function is_superadmin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles 
    where id = auth.uid() and user_type = 'superadmin'
  )
$$;

-- ── 14. Signup Trigger Function ───────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
declare
  new_tenant_id uuid;
  user_company_name text;
  user_first_name text;
  user_last_name text;
  user_type_val public.user_type;
  is_first_user boolean;
begin
  -- Check if this is the first profile in the system. If so, make them superadmin.
  select not exists (select 1 from public.profiles) into is_first_user;
  
  if is_first_user then
    user_type_val := 'superadmin'::public.user_type;
  else
    -- Read from metadata or default to user
    user_type_val := coalesce(
      (new.raw_user_meta_data->>'user_type')::public.user_type,
      'user'::public.user_type
    );
  end if;

  -- Extract company name, first name, last name from metadata
  user_company_name := coalesce(new.raw_user_meta_data->>'company_name', split_part(new.email, '@', 1) || ' Corp');
  user_first_name := coalesce(new.raw_user_meta_data->>'first_name', split_part(new.email, '@', 1));
  user_last_name := coalesce(new.raw_user_meta_data->>'last_name', '');

  -- 1. Create a personal tenant for the new user
  insert into public.tenants (name, slug, plan, owner_id, settings)
  values (
    user_company_name || ' Workspace',
    lower(regexp_replace(user_company_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substring(new.id::text from 1 for 8),
    'free',
    new.id,
    '{}'::jsonb
  )
  returning id into new_tenant_id;

  -- 2. Create profile
  insert into public.profiles (
    id,
    tenant_id,
    email,
    full_name,
    role,
    user_type,
    sender_name
  ) values (
    new.id,
    new_tenant_id,
    new.email,
    user_first_name || case when user_last_name = '' then '' else ' ' || user_last_name end,
    'owner',
    user_type_val,
    user_first_name || case when user_last_name = '' then '' else ' ' || user_last_name end
  );

  -- 3. Insert signup details based on admin level vs standard user
  if user_type_val = 'superadmin' or user_type_val = 'admin' then
    insert into public.admin_registrations (
      id,
      full_name,
      email,
      mobile_number,
      company_name,
      admin_level,
      designation,
      consent_given,
      consent_given_at
    ) values (
      new.id,
      user_first_name || case when user_last_name = '' then '' else ' ' || user_last_name end,
      new.email,
      coalesce(new.raw_user_meta_data->>'mobile_number', 'Not Specified'),
      user_company_name,
      case when user_type_val = 'superadmin' then 'super'::public.admin_level else 'limited'::public.admin_level end,
      new.raw_user_meta_data->>'job_title',
      true,
      now()
    );
  else
    insert into public.user_registrations (
      id,
      first_name,
      last_name,
      email,
      mobile_number,
      company_name,
      job_title,
      consent_given,
      consent_given_at
    ) values (
      new.id,
      user_first_name,
      user_last_name,
      new.email,
      new.raw_user_meta_data->>'mobile_number',
      user_company_name,
      new.raw_user_meta_data->>'job_title',
      true,
      now()
    );
  end if;

  return new;
end;
$$;

-- Trigger binding
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── 15. Row Level Security Policies ───────────────────────
alter table tenants enable row level security;
alter table profiles enable row level security;
alter table user_registrations enable row level security;
alter table admin_registrations enable row level security;
alter table companies enable row level security;
alter table contacts enable row level security;
alter table messages enable row level security;
alter table followups enable row level security;
alter table platform_settings enable row level security;
alter table audit_logs enable row level security;

-- 15.1 Tenants Policies
drop policy if exists tenants_select on tenants;
drop policy if exists tenants_insert on tenants;
drop policy if exists tenants_update on tenants;
drop policy if exists tenants_delete on tenants;
create policy tenants_select on tenants for select to authenticated using (auth.uid() = owner_id or is_superadmin());
create policy tenants_insert on tenants for insert to authenticated with check (auth.uid() = owner_id or is_superadmin());
create policy tenants_update on tenants for update to authenticated using (auth.uid() = owner_id or is_superadmin()) with check (auth.uid() = owner_id or is_superadmin());
create policy tenants_delete on tenants for delete to authenticated using (auth.uid() = owner_id or is_superadmin());

-- 15.2 Profiles Policies
drop policy if exists profiles_select on profiles;
drop policy if exists profiles_insert on profiles;
drop policy if exists profiles_update on profiles;
drop policy if exists profiles_delete on profiles;
create policy profiles_select on profiles for select to authenticated using (auth.uid() = id or is_superadmin());
create policy profiles_insert on profiles for insert to authenticated with check (auth.uid() = id or is_superadmin());
create policy profiles_update on profiles for update to authenticated using (auth.uid() = id or is_superadmin()) with check (auth.uid() = id or is_superadmin());
create policy profiles_delete on profiles for delete to authenticated using (auth.uid() = id or is_superadmin());

-- 15.3 User Registrations Policies
drop policy if exists user_reg_select on user_registrations;
drop policy if exists user_reg_insert on user_registrations;
drop policy if exists user_reg_update on user_registrations;
create policy user_reg_select on user_registrations for select to authenticated using (auth.uid() = id or is_superadmin());
create policy user_reg_insert on user_registrations for insert to authenticated with check (auth.uid() = id or is_superadmin());
create policy user_reg_update on user_registrations for update to authenticated using (auth.uid() = id or is_superadmin()) with check (auth.uid() = id or is_superadmin());

-- 15.4 Admin Registrations Policies
drop policy if exists admin_reg_select on admin_registrations;
drop policy if exists admin_reg_insert on admin_registrations;
drop policy if exists admin_reg_update on admin_registrations;
create policy admin_reg_select on admin_registrations for select to authenticated using (auth.uid() = id or is_superadmin());
create policy admin_reg_insert on admin_registrations for insert to authenticated with check (auth.uid() = id or is_superadmin());
create policy admin_reg_update on admin_registrations for update to authenticated using (auth.uid() = id or is_superadmin()) with check (auth.uid() = id or is_superadmin());

-- 15.5 Companies Policies
drop policy if exists companies_select on companies;
drop policy if exists companies_insert on companies;
drop policy if exists companies_update on companies;
drop policy if exists companies_delete on companies;
create policy companies_select on companies for select to authenticated using (tenant_id = my_tenant_id() or is_superadmin());
create policy companies_insert on companies for insert to authenticated with check (tenant_id = my_tenant_id() or is_superadmin());
create policy companies_update on companies for update to authenticated using (tenant_id = my_tenant_id() or is_superadmin()) with check (tenant_id = my_tenant_id() or is_superadmin());
create policy companies_delete on companies for delete to authenticated using (tenant_id = my_tenant_id() or is_superadmin());

-- 15.6 Contacts Policies
drop policy if exists contacts_select on contacts;
drop policy if exists contacts_insert on contacts;
drop policy if exists contacts_update on contacts;
drop policy if exists contacts_delete on contacts;
create policy contacts_select on contacts for select to authenticated using (tenant_id = my_tenant_id() or is_superadmin());
create policy contacts_insert on contacts for insert to authenticated with check (tenant_id = my_tenant_id() or is_superadmin());
create policy contacts_update on contacts for update to authenticated using (tenant_id = my_tenant_id() or is_superadmin()) with check (tenant_id = my_tenant_id() or is_superadmin());
create policy contacts_delete on contacts for delete to authenticated using (tenant_id = my_tenant_id() or is_superadmin());

-- 15.7 Messages Policies
drop policy if exists messages_select on messages;
drop policy if exists messages_insert on messages;
drop policy if exists messages_update on messages;
drop policy if exists messages_delete on messages;
create policy messages_select on messages for select to authenticated using (tenant_id = my_tenant_id() or is_superadmin());
create policy messages_insert on messages for insert to authenticated with check (tenant_id = my_tenant_id() or is_superadmin());
create policy messages_update on messages for update to authenticated using (tenant_id = my_tenant_id() or is_superadmin()) with check (tenant_id = my_tenant_id() or is_superadmin());
create policy messages_delete on messages for delete to authenticated using (tenant_id = my_tenant_id() or is_superadmin());

-- 15.8 Followups Policies
drop policy if exists followups_select on followups;
drop policy if exists followups_insert on followups;
drop policy if exists followups_update on followups;
drop policy if exists followups_delete on followups;
create policy followups_select on followups for select to authenticated using (tenant_id = my_tenant_id() or is_superadmin());
create policy followups_insert on followups for insert to authenticated with check (tenant_id = my_tenant_id() or is_superadmin());
create policy followups_update on followups for update to authenticated using (tenant_id = my_tenant_id() or is_superadmin()) with check (tenant_id = my_tenant_id() or is_superadmin());
create policy followups_delete on followups for delete to authenticated using (tenant_id = my_tenant_id() or is_superadmin());

-- 15.9 Platform Settings Policies
drop policy if exists settings_select on platform_settings;
drop policy if exists settings_all on platform_settings;
create policy settings_select on platform_settings for select to authenticated using (true);
create policy settings_all on platform_settings for all to authenticated using (is_superadmin()) with check (is_superadmin());

-- 15.10 Audit Logs Policies
drop policy if exists audit_select on audit_logs;
drop policy if exists audit_insert on audit_logs;
create policy audit_select on audit_logs for select to authenticated using (is_superadmin());
create policy audit_insert on audit_logs for insert to authenticated with check (auth.uid() = performed_by);
