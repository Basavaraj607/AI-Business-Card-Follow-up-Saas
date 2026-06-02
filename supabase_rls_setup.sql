-- 1. Enable Row Level Security (RLS) on the tables
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent conflicts if re-running
DROP POLICY IF EXISTS contacts_select ON public.contacts;
DROP POLICY IF EXISTS contacts_insert ON public.contacts;
DROP POLICY IF EXISTS contacts_update ON public.contacts;
DROP POLICY IF EXISTS contacts_delete ON public.contacts;

DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;
DROP POLICY IF EXISTS profiles_delete ON public.profiles;

DROP POLICY IF EXISTS tenants_select ON public.tenants;
DROP POLICY IF EXISTS tenants_insert ON public.tenants;
DROP POLICY IF EXISTS tenants_update ON public.tenants;
DROP POLICY IF EXISTS tenants_delete ON public.tenants;

DROP POLICY IF EXISTS messages_select ON public.messages;
DROP POLICY IF EXISTS messages_insert ON public.messages;
DROP POLICY IF EXISTS messages_update ON public.messages;
DROP POLICY IF EXISTS messages_delete ON public.messages;

-- 3. Row Level Security Policies for `contacts` table
-- Users can read, insert, update, and delete contacts they created (created_by = auth.uid())
CREATE POLICY contacts_select ON public.contacts
    FOR SELECT
    TO authenticated
    USING (auth.uid() = created_by);

CREATE POLICY contacts_insert ON public.contacts
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY contacts_update ON public.contacts
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY contacts_delete ON public.contacts
    FOR DELETE
    TO authenticated
    USING (auth.uid() = created_by);

-- 4. Row Level Security Policies for `profiles` table
-- Users can only access/manage their own profile record (id = auth.uid())
CREATE POLICY profiles_select ON public.profiles
    FOR SELECT
    TO authenticated
    USING (auth.uid() = id);

CREATE POLICY profiles_insert ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_update ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY profiles_delete ON public.profiles
    FOR DELETE
    TO authenticated
    USING (auth.uid() = id);

-- 5. Row Level Security Policies for `tenants` table
-- Users can read, insert, update, and delete tenants they own (owner_id = auth.uid())
CREATE POLICY tenants_select ON public.tenants
    FOR SELECT
    TO authenticated
    USING (auth.uid() = owner_id);

CREATE POLICY tenants_insert ON public.tenants
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY tenants_update ON public.tenants
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = owner_id)
    WITH CHECK (auth.uid() = owner_id);

CREATE POLICY tenants_delete ON public.tenants
    FOR DELETE
    TO authenticated
    USING (auth.uid() = owner_id);

-- 6. Row Level Security Policies for `messages` table
-- Users can manage follow-up draft/sent messages they sent (sent_by = auth.uid())
CREATE POLICY messages_select ON public.messages
    FOR SELECT
    TO authenticated
    USING (auth.uid() = sent_by);

CREATE POLICY messages_insert ON public.messages
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = sent_by);

CREATE POLICY messages_update ON public.messages
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = sent_by)
    WITH CHECK (auth.uid() = sent_by);

CREATE POLICY messages_delete ON public.messages
    FOR DELETE
    TO authenticated
    USING (auth.uid() = sent_by);
