-- ====================================================================
-- AI Business Card Follow-up SaaS - Admin Database Setup (Schema v2)
-- Run this SQL in your Supabase SQL Editor (https://supabase.com/dashboard)
-- ====================================================================

-- 1. Create platform_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id TEXT PRIMARY KEY,
  maintenance_mode BOOLEAN DEFAULT false,
  max_contacts_limit INTEGER DEFAULT 100,
  max_messages_limit INTEGER DEFAULT 50,
  default_resend_key TEXT DEFAULT '',
  default_twilio_sid TEXT DEFAULT '',
  default_twilio_token TEXT DEFAULT '',
  default_twilio_phone TEXT DEFAULT '',
  default_meta_token TEXT DEFAULT '',
  default_meta_phone_id TEXT DEFAULT '',
  feature_flags JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Seed default platform settings
INSERT INTO public.platform_settings (id, maintenance_mode, max_contacts_limit, max_messages_limit)
VALUES ('global', false, 100, 50)
ON CONFLICT (id) DO NOTHING;

-- 3. Enable RLS on platform_settings
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- 4. Define policies for platform_settings checking profiles.user_type
DROP POLICY IF EXISTS superadmin_all_settings ON public.platform_settings;
CREATE POLICY superadmin_all_settings ON public.platform_settings
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin'
    )
  );

-- 5. Enable RLS and define policies for audit_logs checking profiles.user_type
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS superadmin_all_logs ON public.audit_logs;
CREATE POLICY superadmin_all_logs ON public.audit_logs
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin'
    )
  );

-- 6. Update contacts RLS Policies to allow superadmin access checking profiles.user_type
DROP POLICY IF EXISTS contacts_select ON public.contacts;
CREATE POLICY contacts_select ON public.contacts
    FOR SELECT
    TO authenticated
    USING (
      auth.uid() = created_by 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin')
    );

DROP POLICY IF EXISTS contacts_insert ON public.contacts;
CREATE POLICY contacts_insert ON public.contacts
    FOR INSERT
    TO authenticated
    WITH CHECK (
      auth.uid() = created_by 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin')
    );

DROP POLICY IF EXISTS contacts_update ON public.contacts;
CREATE POLICY contacts_update ON public.contacts
    FOR UPDATE
    TO authenticated
    USING (
      auth.uid() = created_by 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin')
    )
    WITH CHECK (
      auth.uid() = created_by 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin')
    );

DROP POLICY IF EXISTS contacts_delete ON public.contacts;
CREATE POLICY contacts_delete ON public.contacts
    FOR DELETE
    TO authenticated
    USING (
      auth.uid() = created_by 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin')
    );

-- 7. Update profiles RLS Policies to allow superadmin access checking profiles.user_type
DROP POLICY IF EXISTS profiles_select ON public.profiles;
CREATE POLICY profiles_select ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
      auth.uid() = id 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin')
    );

DROP POLICY IF EXISTS profiles_insert ON public.profiles;
CREATE POLICY profiles_insert ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (
      auth.uid() = id 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin')
    );

DROP POLICY IF EXISTS profiles_update ON public.profiles;
CREATE POLICY profiles_update ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
      auth.uid() = id 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin')
    )
    WITH CHECK (
      auth.uid() = id 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin')
    );

DROP POLICY IF EXISTS profiles_delete ON public.profiles;
CREATE POLICY profiles_delete ON public.profiles
    FOR DELETE
    TO authenticated
    USING (
      auth.uid() = id 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin')
    );

-- 8. Update tenants RLS Policies to allow superadmin access checking profiles.user_type
DROP POLICY IF EXISTS tenants_select ON public.tenants;
CREATE POLICY tenants_select ON public.tenants
    FOR SELECT
    TO authenticated
    USING (
      auth.uid() = owner_id 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin')
    );

DROP POLICY IF EXISTS tenants_insert ON public.tenants;
CREATE POLICY tenants_insert ON public.tenants
    FOR INSERT
    TO authenticated
    WITH CHECK (
      auth.uid() = owner_id 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin')
    );

DROP POLICY IF EXISTS tenants_update ON public.tenants;
CREATE POLICY tenants_update ON public.tenants
    FOR UPDATE
    TO authenticated
    USING (
      auth.uid() = owner_id 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin')
    )
    WITH CHECK (
      auth.uid() = owner_id 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin')
    );

DROP POLICY IF EXISTS tenants_delete ON public.tenants;
CREATE POLICY tenants_delete ON public.tenants
    FOR DELETE
    TO authenticated
    USING (
      auth.uid() = owner_id 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin')
    );

-- 9. Update messages RLS Policies to allow superadmin access checking profiles.user_type
DROP POLICY IF EXISTS messages_select ON public.messages;
CREATE POLICY messages_select ON public.messages
    FOR SELECT
    TO authenticated
    USING (
      auth.uid() = sent_by 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin')
    );

DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (
      auth.uid() = sent_by 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin')
    );

DROP POLICY IF EXISTS messages_update ON public.messages;
CREATE POLICY messages_update ON public.messages
    FOR UPDATE
    TO authenticated
    USING (
      auth.uid() = sent_by 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin')
    )
    WITH CHECK (
      auth.uid() = sent_by 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin')
    );

DROP POLICY IF EXISTS messages_delete ON public.messages;
CREATE POLICY messages_delete ON public.messages
    FOR DELETE
    TO authenticated
    USING (
      auth.uid() = sent_by 
      OR EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.user_type = 'superadmin')
    );
