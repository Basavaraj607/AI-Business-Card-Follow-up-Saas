import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: 'Missing environment variables on server' }), { status: 500, headers: corsHeaders })
    }

    // 1. Authenticate user using client JWT
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid token' }), { status: 401, headers: corsHeaders })
    }

    // 2. Verify Superadmin role using service role bypass
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('user_type, email')
      .eq('id', user.id)
      .single()

    if (profileError || !profile || profile.user_type !== 'superadmin') {
      return new Response(JSON.stringify({ error: 'Forbidden: Superadmin access required' }), { status: 403, headers: corsHeaders })
    }

    // 3. Route action calls
    const body = await req.json().catch(() => ({}))
    const { action, params = {} } = body

    if (!action) {
      return new Response(JSON.stringify({ error: 'Missing action parameter' }), { status: 400, headers: corsHeaders })
    }

    let responseData: any = null

    // Helper to log audits conforming to audit_logs Schema v2
    const logAudit = async (actionName: string, targetTenantId: string | null, metadata: any = {}) => {
      let dbAction: 'create' | 'update' | 'delete' | 'suspend' | 'impersonate' | 'login' | 'logout' | 'export' = 'update';
      if (actionName === 'delete-tenant') dbAction = 'delete';
      else if (actionName === 'suspend-tenant') dbAction = 'suspend';
      else if (actionName === 'impersonate') dbAction = 'impersonate';

      await adminClient.from('audit_logs').insert({
        performed_by: user.id,
        action: dbAction,
        target_type: 'tenant',
        target_id: targetTenantId || null,
        target_tenant: targetTenantId || null,
        metadata: {
          ...metadata,
          original_action: actionName,
          admin_email: profile.email || user.email
        }
      })
    }

    if (action === 'get-overview') {
      // Platform Analytics
      const { count: totalTenants } = await adminClient.from('tenants').select('*', { count: 'exact', head: true })
      const { count: totalUsers } = await adminClient.from('profiles').select('*', { count: 'exact', head: true })
      const { count: totalContacts } = await adminClient.from('contacts').select('*', { count: 'exact', head: true })
      const { count: totalMessages } = await adminClient.from('messages').select('*', { count: 'exact', head: true })

      // Plan breakdown
      const { data: tenantsPlan } = await adminClient.from('tenants').select('plan')
      const planBreakdown = (tenantsPlan || []).reduce((acc: any, t: any) => {
        acc[t.plan] = (acc[t.plan] || 0) + 1
        return acc
      }, { free: 0, pro: 0, team: 0, enterprise: 0 })

      // Audit logs (Map Schema v2 fields to original schema format for UI compatibility)
      const { data: recentLogs } = await adminClient
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)

      const mappedLogs = (recentLogs || []).map((l: any) => ({
        id: l.id,
        admin_id: l.performed_by,
        admin_email: l.metadata?.admin_email || 'System',
        action: l.metadata?.original_action || l.action,
        target_tenant_id: l.target_tenant,
        metadata: l.metadata,
        created_at: l.created_at
      }))

      // Sign-ups last 7 days
      const { data: signups } = await adminClient
        .from('profiles')
        .select('created_at')
        .order('created_at', { ascending: false })

      // Calculate daily signups for last 7 days
      const last7Days: any = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        const dayStr = d.toISOString().split('T')[0]
        last7Days[dayStr] = 0
      }
      (signups || []).forEach((s: any) => {
        if (s.created_at) {
          const dateStr = s.created_at.split('T')[0]
          if (dateStr in last7Days) {
            last7Days[dateStr]++
          }
        }
      })
      const signupsSparkline = Object.entries(last7Days).map(([date, count]) => ({ date, count }))

      responseData = {
        totalTenants: totalTenants || 0,
        totalUsers: totalUsers || 0,
        totalContacts: totalContacts || 0,
        totalMessages: totalMessages || 0,
        planBreakdown,
        recentLogs: mappedLogs,
        signupsSparkline
      }

    } else if (action === 'list-tenants') {
      // List all tenants with details
      const { data: tenantsList, error: tErr } = await adminClient
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false })

      if (tErr) throw tErr

      // Fetch contacts counts grouped by tenant_id
      const { data: contactsCount } = await adminClient.from('contacts').select('tenant_id')
      const contactCountsMap = (contactsCount || []).reduce((acc: any, c: any) => {
        acc[c.tenant_id] = (acc[c.tenant_id] || 0) + 1
        return acc
      }, {})

      // Fetch messages counts grouped by tenant_id
      const { data: messagesCount } = await adminClient.from('messages').select('tenant_id')
      const messageCountsMap = (messagesCount || []).reduce((acc: any, m: any) => {
        acc[m.tenant_id] = (acc[m.tenant_id] || 0) + 1
        return acc
      }, {})

      // Fetch profiles grouped by tenant_id
      const { data: profilesList } = await adminClient.from('profiles').select('tenant_id')
      const userCountsMap = (profilesList || []).reduce((acc: any, p: any) => {
        acc[p.tenant_id] = (acc[p.tenant_id] || 0) + 1
        return acc
      }, {})

      responseData = (tenantsList || []).map((t: any) => ({
        ...t,
        users_count: userCountsMap[t.id] || 0,
        contacts_count: contactCountsMap[t.id] || 0,
        messages_count: messageCountsMap[t.id] || 0
      }))

    } else if (action === 'get-tenant') {
      const { tenantId } = params
      if (!tenantId) {
        return new Response(JSON.stringify({ error: 'Missing tenantId parameter' }), { status: 400, headers: corsHeaders })
      }

      // Fetch tenant details
      const { data: tenantDetails } = await adminClient.from('tenants').eq('id', tenantId).single()
      if (!tenantDetails) {
        return new Response(JSON.stringify({ error: 'Tenant not found' }), { status: 404, headers: corsHeaders })
      }

      // Fetch team members (profiles)
      const { data: members } = await adminClient.from('profiles').eq('tenant_id', tenantId)

      // Fetch contacts
      const { data: contacts } = await adminClient
        .from('contacts')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      // Fetch messages
      const { data: messages } = await adminClient
        .from('messages')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false })

      responseData = {
        tenant: tenantDetails,
        members: members || [],
        contacts: contacts || [],
        messages: messages || []
      }

    } else if (action === 'change-plan') {
      const { tenantId, plan } = params
      if (!tenantId || !plan) {
        return new Response(JSON.stringify({ error: 'Missing tenantId or plan' }), { status: 400, headers: corsHeaders })
      }

      const { data, error } = await adminClient
        .from('tenants')
        .update({ plan, updated_at: new Date().toISOString() })
        .eq('id', tenantId)
        .select()
        .single()

      if (error) throw error

      await logAudit('change-plan', tenantId, { newPlan: plan })
      responseData = { success: true, tenant: data }

    } else if (action === 'delete-tenant') {
      const { tenantId } = params
      if (!tenantId) {
        return new Response(JSON.stringify({ error: 'Missing tenantId' }), { status: 400, headers: corsHeaders })
      }

      // Delete cascades
      await adminClient.from('messages').delete().eq('tenant_id', tenantId)
      await adminClient.from('contacts').delete().eq('tenant_id', tenantId)
      await adminClient.from('profiles').delete().eq('tenant_id', tenantId)
      const { error: tErr } = await adminClient.from('tenants').delete().eq('id', tenantId)
      if (tErr) throw tErr

      await logAudit('delete-tenant', tenantId)
      responseData = { success: true }

    } else if (action === 'list-users') {
      // List all profiles/users across platform
      const { data: usersList, error: uErr } = await adminClient
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      if (uErr) throw uErr

      // Add tenant names
      const { data: tenantsName } = await adminClient.from('tenants').select('id, name')
      const tenantsMap = (tenantsName || []).reduce((acc: any, t: any) => {
        acc[t.id] = t.name
        return acc
      }, {})

      responseData = (usersList || []).map((u: any) => ({
        ...u,
        tenant_name: tenantsMap[u.tenant_id] || 'Unknown'
      }))

    } else if (action === 'get-settings') {
      const { data, error } = await adminClient
        .from('platform_settings')
        .eq('id', 'global')
        .single()

      if (error) throw error
      responseData = data

    } else if (action === 'update-settings') {
      const { settings } = params
      if (!settings) {
        return new Response(JSON.stringify({ error: 'Missing settings parameter' }), { status: 400, headers: corsHeaders })
      }

      const { data, error } = await adminClient
        .from('platform_settings')
        .update({
          ...settings,
          updated_at: new Date().toISOString()
        })
        .eq('id', 'global')
        .select()
        .single()

      if (error) throw error

      await logAudit('update-settings', null, { changes: Object.keys(settings) })
      responseData = data

    } else {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: corsHeaders })
    }

    return new Response(JSON.stringify(responseData), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || err }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
