-- ====================================================================
-- AI Business Card Follow-up SaaS - Events Feature RLS Migrations
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
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for `events` table
DROP POLICY IF EXISTS events_select ON public.events;
CREATE POLICY events_select ON public.events
  FOR SELECT TO authenticated
  USING (
    (tenant_id = my_tenant_id() AND (status = 'approved' OR created_by = auth.uid() OR is_tenant_admin()))
    OR is_superadmin()
  );

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

DROP POLICY IF EXISTS events_delete ON public.events;
CREATE POLICY events_delete ON public.events
  FOR DELETE TO authenticated
  USING (
    (tenant_id = my_tenant_id() AND is_tenant_admin())
    OR is_superadmin()
  );

-- 4. RLS Policies for `event_registrations` table
DROP POLICY IF EXISTS event_registrations_select ON public.event_registrations;
CREATE POLICY event_registrations_select ON public.event_registrations
  FOR SELECT TO authenticated
  USING (
    (tenant_id = my_tenant_id() AND (user_id = auth.uid() OR is_tenant_admin()))
    OR is_superadmin()
  );

DROP POLICY IF EXISTS event_registrations_insert ON public.event_registrations;
CREATE POLICY event_registrations_insert ON public.event_registrations
  FOR INSERT TO authenticated
  WITH CHECK (
    (tenant_id = my_tenant_id() AND (
      is_tenant_admin()
      OR (user_id = auth.uid() AND registered_by = 'self' AND registration_status = 'registered')
    ))
    OR is_superadmin()
  );

DROP POLICY IF EXISTS event_registrations_update ON public.event_registrations;
CREATE POLICY event_registrations_update ON public.event_registrations
  FOR UPDATE TO authenticated
  USING (
    (tenant_id = my_tenant_id() AND (user_id = auth.uid() OR is_tenant_admin()))
    OR is_superadmin()
  )
  WITH CHECK (
    (tenant_id = my_tenant_id() AND (
      is_tenant_admin()
      OR (user_id = auth.uid() AND registration_status = 'cancelled')
    ))
    OR is_superadmin()
  );

DROP POLICY IF EXISTS event_registrations_delete ON public.event_registrations;
CREATE POLICY event_registrations_delete ON public.event_registrations
  FOR DELETE TO authenticated
  USING (
    (tenant_id = my_tenant_id() AND is_tenant_admin())
    OR is_superadmin()
  );

-- 5. RLS Policies for storage.objects under `event-banners` bucket
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

-- 6. Security Definer RPC for Notification Flipping
CREATE OR REPLACE FUNCTION public.mark_event_notified(target_event_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.events
  SET notified = true
  WHERE id = target_event_id AND created_by = auth.uid();
END;
$$;
