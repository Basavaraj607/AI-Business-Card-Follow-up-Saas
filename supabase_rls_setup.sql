-- =====================================================================
-- DATABASE MIGRATION: SECURING DATABASE WITH ROW LEVEL SECURITY (RLS)
-- Run this script inside the SQL Editor of your Supabase Dashboard
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. SECURE THE `contacts` TABLE
-- ---------------------------------------------------------------------
-- Enable Row Level Security
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent duplicates
DROP POLICY IF EXISTS "Users can select their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update their own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete their own contacts" ON contacts;

-- SELECT Policy: Users can only view contacts they created
CREATE POLICY "Users can select their own contacts" 
ON contacts FOR SELECT 
TO authenticated
USING (auth.uid() = created_by);

-- INSERT Policy: Users can only insert contacts they created
CREATE POLICY "Users can insert their own contacts" 
ON contacts FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- UPDATE Policy: Users can only update their own contacts
CREATE POLICY "Users can update their own contacts" 
ON contacts FOR UPDATE 
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

-- DELETE Policy: Users can only delete their own contacts
CREATE POLICY "Users can delete their own contacts" 
ON contacts FOR DELETE 
TO authenticated
USING (auth.uid() = created_by);


-- ---------------------------------------------------------------------
-- 2. SECURE THE `profiles` TABLE
-- ---------------------------------------------------------------------
-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;

-- Users can view their own profile
CREATE POLICY "Users can select their own profile" 
ON profiles FOR SELECT 
TO authenticated
USING (auth.uid() = id);

-- Users can insert their own profile record
CREATE POLICY "Users can insert their own profile" 
ON profiles FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = id);

-- Users can update their own profile record
CREATE POLICY "Users can update their own profile" 
ON profiles FOR UPDATE 
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);


-- ---------------------------------------------------------------------
-- 3. SECURE THE `tenants` TABLE
-- ---------------------------------------------------------------------
-- Enable Row Level Security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select their own tenant" ON tenants;
DROP POLICY IF EXISTS "Users can insert their own tenant" ON tenants;
DROP POLICY IF EXISTS "Users can update their own tenant" ON tenants;

-- Users can view tenants they own
CREATE POLICY "Users can select their own tenant" 
ON tenants FOR SELECT 
TO authenticated
USING (auth.uid() = owner_id);

-- Users can insert a tenant record where they are the owner
CREATE POLICY "Users can insert their own tenant" 
ON tenants FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = owner_id);

-- Users can update a tenant record they own
CREATE POLICY "Users can update their own tenant" 
ON tenants FOR UPDATE 
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);


-- ---------------------------------------------------------------------
-- 4. SECURE THE `messages` TABLE
-- ---------------------------------------------------------------------
-- Enable Row Level Security
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can select their own messages" ON messages;
DROP POLICY IF EXISTS "Users can insert their own messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;

-- Users can view messages they sent
CREATE POLICY "Users can select their own messages" 
ON messages FOR SELECT 
TO authenticated
USING (auth.uid() = sent_by);

-- Users can insert messages they sent
CREATE POLICY "Users can insert their own messages" 
ON messages FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = sent_by);

-- Users can delete messages they sent
CREATE POLICY "Users can delete their own messages" 
ON messages FOR DELETE 
TO authenticated
USING (auth.uid() = sent_by);

-- =====================================================================
-- Script complete. Click "Run" in your Supabase SQL Editor.
-- =====================================================================
