-- ====================================================================
-- AI Business Card Follow-up SaaS - Events Feature RLS Migrations
-- ARCHITECTURE: Events are GLOBAL. Any authenticated user can see and
-- register for any APPROVED event, regardless of which tenant created it.
-- Only pending/rejected drafts remain tenant-scoped (visible only to
-- the creator and their tenant admin). Admin moderation stays tenant-scoped.
-- ====================================================================

-- 1. Security Helper Function for Tenant Admins
CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() 
      AND (role = 'admin' OR role = 'owner' OR user_type = 'superadmin')
  )
$$;

-- 2. Enable RLS on events and registrations
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- 3. RLS Policies for `events` table
-- =====================================================================

-- SELECT: APPROVED events are global (any authenticated user).
--         Pending/rejected are private to creator + their tenant admin.
DROP POLICY IF EXISTS events_select ON public.events;
CREATE POLICY events_select ON public.events
  FOR SELECT TO authenticated
  USING (
    -- Any authenticated user can see ANY approved event
    status = 'approved'
    -- A user can always see their own submissions (any status) within their tenant
    OR (tenant_id = my_tenant_id() AND created_by = auth.uid())
    -- Tenant admins see all events in their tenant for moderation
    OR (tenant_id = my_tenant_id() AND is_tenant_admin())
    -- Superadmins see everything
    OR is_superadmin()
  );

-- INSERT: Users can submit pending events in their own tenant.
--         Admins can create any-status events in their tenant.
DROP POLICY IF EXISTS events_insert ON public.events;
CREATE POLICY events_insert ON public.events
  FOR INSERT TO authenticated
  WITH CHECK (
    (tenant_id = my_tenant_id() AND (
      is_tenant_admin()
      OR (status = 'pending' AND created_by = auth.uid())
    ))
    OR is_superadmin()
  );

-- UPDATE: Only tenant admins can update events (approving, rejecting, editing).
DROP POLICY IF EXISTS events_update ON public.events;
CREATE POLICY events_update ON public.events
  FOR UPDATE TO authenticated
  USING (
    (tenant_id = my_tenant_id() AND is_tenant_admin())
    OR is_superadmin()
  )
  WITH CHECK (
    (tenant_id = my_tenant_id() AND is_tenant_admin())
    OR is_superadmin()
  );

-- DELETE: Only tenant admins can delete events.
DROP POLICY IF EXISTS events_delete ON public.events;
CREATE POLICY events_delete ON public.events
  FOR DELETE TO authenticated
  USING (
    (tenant_id = my_tenant_id() AND is_tenant_admin())
    OR is_superadmin()
  );

-- =====================================================================
-- 4. RLS Policies for `event_registrations` table
-- =====================================================================

-- SELECT: Users see ALL their own registrations (cross-tenant, since events are global).
--         Admins see all registrations for events in their own tenant.
DROP POLICY IF EXISTS event_registrations_select ON public.event_registrations;
CREATE POLICY event_registrations_select ON public.event_registrations
  FOR SELECT TO authenticated
  USING (
    -- A user always sees their own registrations regardless of which tenant the event is in
    user_id = auth.uid()
    -- Tenant admins see all registrations scoped to their tenant
    OR (tenant_id = my_tenant_id() AND is_tenant_admin())
    -- Superadmins see everything
    OR is_superadmin()
  );

-- INSERT: Any authenticated user can self-register for any approved event.
--         The registration record is tagged to the registering user's own tenant.
--         Admins can manually register people within their own tenant only.
DROP POLICY IF EXISTS event_registrations_insert ON public.event_registrations;
CREATE POLICY event_registrations_insert ON public.event_registrations
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Self-registration: user registers themselves for any approved event.
    -- tenant_id on the registration record must be the user's own tenant.
    (
      user_id = auth.uid()
      AND registered_by = 'self'
      AND registration_status = 'registered'
      AND tenant_id = my_tenant_id()
    )
    -- Admin-managed registration: scoped to admin's own tenant only.
    OR (tenant_id = my_tenant_id() AND is_tenant_admin())
    -- Superadmins can insert anything.
    OR is_superadmin()
  );

-- UPDATE: Users can update (cancel) their own registrations.
--         Admins can update any registration in their tenant.
DROP POLICY IF EXISTS event_registrations_update ON public.event_registrations;
CREATE POLICY event_registrations_update ON public.event_registrations
  FOR UPDATE TO authenticated
  USING (
    -- User can update their own registration (e.g., cancel it)
    user_id = auth.uid()
    -- Admin can update any registration in their tenant
    OR (tenant_id = my_tenant_id() AND is_tenant_admin())
    OR is_superadmin()
  )
  WITH CHECK (
    -- User can only change their own registration status to 'cancelled' (not re-approve)
    (user_id = auth.uid() AND registration_status = 'cancelled')
    -- Admin can make any update within their tenant
    OR (tenant_id = my_tenant_id() AND is_tenant_admin())
    OR is_superadmin()
  );

-- DELETE: Only tenant admins can hard-delete registrations.
DROP POLICY IF EXISTS event_registrations_delete ON public.event_registrations;
CREATE POLICY event_registrations_delete ON public.event_registrations
  FOR DELETE TO authenticated
  USING (
    (tenant_id = my_tenant_id() AND is_tenant_admin())
    OR is_superadmin()
  );

-- =====================================================================
-- 5. RLS Policies for storage.objects under `event-banners` bucket
-- =====================================================================
DROP POLICY IF EXISTS "Public Read Access for Event Banners" ON storage.objects;
CREATE POLICY "Public Read Access for Event Banners" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'event-banners');

DROP POLICY IF EXISTS "Upload Event Banners" ON storage.objects;
CREATE POLICY "Upload Event Banners" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'event-banners'
    AND split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND split_part(name, '/', 1)::uuid = my_tenant_id()
  );

DROP POLICY IF EXISTS "Modify/Delete Event Banners" ON storage.objects;
CREATE POLICY "Modify/Delete Event Banners" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'event-banners'
    AND split_part(name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND split_part(name, '/', 1)::uuid = my_tenant_id()
    AND (
      is_tenant_admin()
      OR (
        split_part(name, '/', 2) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        AND EXISTS (
          SELECT 1 FROM public.events e
          WHERE e.id = split_part(name, '/', 2)::uuid
            AND e.created_by = auth.uid()
        )
      )
    )
  );

-- =====================================================================
-- 6. Security Definer RPC for Notification Flipping
-- =====================================================================
CREATE OR REPLACE FUNCTION public.mark_event_notified(target_event_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.events
  SET notified = true
  WHERE id = target_event_id AND created_by = auth.uid();
END;
$$;
