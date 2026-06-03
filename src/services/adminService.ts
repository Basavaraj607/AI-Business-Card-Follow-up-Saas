// src/services/adminService.ts

import { supabase } from '../lib/supabase';
import type { PlatformSettings, AuditLog } from '../types/database';

export interface AdminOverviewData {
  totalTenants: number;
  totalUsers: number;
  totalContacts: number;
  totalMessages: number;
  planBreakdown: {
    free: number;
    pro: number;
    team: number;
    enterprise: number;
  };
  recentLogs: AuditLog[];
  signupsSparkline: { date: string; count: number }[];
}

export interface AdminTenantListItem {
  id: string;
  name: string;
  slug: string;
  plan: 'free' | 'pro' | 'team' | 'enterprise';
  owner_id: string;
  settings: any;
  created_at: string;
  updated_at: string;
  users_count: number;
  contacts_count: number;
  messages_count: number;
}

export interface AdminTenantDetail {
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: 'free' | 'pro' | 'team' | 'enterprise';
    owner_id: string;
    settings: any;
    created_at: string;
  };
  members: any[];
  contacts: any[];
  messages: any[];
}

export interface AdminUserListItem {
  id: string;
  tenant_id: string;
  tenant_name: string;
  full_name: string | null;
  avatar_url: string | null;
  role: string;
  user_type: string;
  email: string;
  phone: string | null;
  created_at: string;
}

class AdminService {
  private async invoke(action: string, params: Record<string, any> = {}) {
    const { data, error } = await supabase.functions.invoke('admin-query', {
      body: { action, params },
    });

    if (error) {
      throw new Error(error.message || `Failed to execute admin action: ${action}`);
    }

    return data;
  }

  async getOverview(): Promise<AdminOverviewData> {
    try {
      return await this.invoke('get-overview');
    } catch (err) {
      console.warn('Edge Function get-overview failed, falling back to direct DB query:', err);
      
      const { count: totalTenants } = await supabase.from('tenants').select('*', { count: 'exact', head: true });
      const { count: totalUsers } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
      const { count: totalContacts } = await supabase.from('contacts').select('*', { count: 'exact', head: true });
      const { count: totalMessages } = await supabase.from('messages').select('*', { count: 'exact', head: true });

      const { data: tenantsPlan } = await supabase.from('tenants').select('plan');
      const planBreakdown = (tenantsPlan || []).reduce((acc: any, t: any) => {
        acc[t.plan] = (acc[t.plan] || 0) + 1;
        return acc;
      }, { free: 0, pro: 0, team: 0, enterprise: 0 });

      const { data: recentLogs } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      // Map performed_by UUIDs to profile emails for log display
      const userIds = (recentLogs || []).map((l: any) => l.performed_by);
      let emailMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: logProfiles } = await supabase.from('profiles').select('id, email').in('id', userIds);
        emailMap = (logProfiles || []).reduce((acc: any, p: any) => {
          acc[p.id] = p.email;
          return acc;
        }, {});
      }

      const mappedLogs = (recentLogs || []).map((l: any) => ({
        id: l.id,
        admin_id: l.performed_by,
        admin_email: emailMap[l.performed_by] || l.metadata?.admin_email || 'System',
        action: l.metadata?.original_action || l.action,
        target_tenant_id: l.target_tenant,
        metadata: l.metadata,
        created_at: l.created_at
      }));

      // Last 7 days signups
      const { data: signups } = await supabase
        .from('profiles')
        .select('created_at')
        .order('created_at', { ascending: false });

      const last7Days: any = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStr = d.toISOString().split('T')[0];
        last7Days[dayStr] = 0;
      }
      (signups || []).forEach((s: any) => {
        if (s.created_at) {
          const dateStr = s.created_at.split('T')[0];
          if (dateStr in last7Days) {
            last7Days[dateStr]++;
          }
        }
      });
      const signupsSparkline = Object.entries(last7Days).map(([date, count]) => ({ date, count }));

      return {
        totalTenants: totalTenants || 0,
        totalUsers: totalUsers || 0,
        totalContacts: totalContacts || 0,
        totalMessages: totalMessages || 0,
        planBreakdown,
        recentLogs: mappedLogs as any,
        signupsSparkline
      };
    }
  }

  async listTenants(): Promise<AdminTenantListItem[]> {
    try {
      return await this.invoke('list-tenants');
    } catch (err) {
      console.warn('Edge Function list-tenants failed, falling back to direct DB query:', err);

      const { data: tenantsList, error: tErr } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (tErr) throw tErr;

      const { data: contactsCount } = await supabase.from('contacts').select('tenant_id');
      const contactCountsMap = (contactsCount || []).reduce((acc: any, c: any) => {
        acc[c.tenant_id] = (acc[c.tenant_id] || 0) + 1;
        return acc;
      }, {});

      const { data: messagesCount } = await supabase.from('messages').select('tenant_id');
      const messageCountsMap = (messagesCount || []).reduce((acc: any, m: any) => {
        acc[m.tenant_id] = (acc[m.tenant_id] || 0) + 1;
        return acc;
      }, {});

      const { data: profilesList } = await supabase.from('profiles').select('tenant_id');
      const userCountsMap = (profilesList || []).reduce((acc: any, p: any) => {
        acc[p.tenant_id] = (acc[p.tenant_id] || 0) + 1;
        return acc;
      }, {});

      return (tenantsList || []).map((t: any) => ({
        ...t,
        users_count: userCountsMap[t.id] || 0,
        contacts_count: contactCountsMap[t.id] || 0,
        messages_count: messageCountsMap[t.id] || 0
      }));
    }
  }

  async getTenant(tenantId: string): Promise<AdminTenantDetail> {
    try {
      return await this.invoke('get-tenant', { tenantId });
    } catch (err) {
      console.warn('Edge Function get-tenant failed, falling back to direct DB query:', err);

      const { data: tenantDetails } = await supabase.from('tenants').eq('id', tenantId).single();
      if (!tenantDetails) throw new Error('Tenant not found');

      const { data: members } = await supabase.from('profiles').eq('tenant_id', tenantId);
      const { data: contacts } = await supabase
        .from('contacts')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      const { data: messages } = await supabase
        .from('messages')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      return {
        tenant: tenantDetails,
        members: members || [],
        contacts: contacts || [],
        messages: messages || []
      };
    }
  }

  async changePlan(tenantId: string, plan: 'free' | 'pro' | 'team' | 'enterprise'): Promise<any> {
    try {
      return await this.invoke('change-plan', { tenantId, plan });
    } catch (err) {
      console.warn('Edge Function change-plan failed, falling back to direct DB query:', err);

      const { data, error } = await supabase
        .from('tenants')
        .update({ plan, updated_at: new Date().toISOString() })
        .eq('id', tenantId)
        .select()
        .single();

      if (error) throw error;

      // Log audit activity
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('audit_logs').insert({
          performed_by: user.id,
          action: 'update',
          target_type: 'tenant',
          target_id: tenantId,
          target_tenant: tenantId,
          metadata: { original_action: 'change-plan', newPlan: plan }
        });
      }

      return { success: true, tenant: data };
    }
  }

  async deleteTenant(tenantId: string): Promise<any> {
    try {
      return await this.invoke('delete-tenant', { tenantId });
    } catch (err) {
      console.warn('Edge Function delete-tenant failed, falling back to direct DB query:', err);

      // Cascade manually just in case constraints don't cascade on user delete
      await supabase.from('messages').delete().eq('tenant_id', tenantId);
      await supabase.from('contacts').delete().eq('tenant_id', tenantId);
      await supabase.from('profiles').delete().eq('tenant_id', tenantId);
      const { error: tErr } = await supabase.from('tenants').delete().eq('id', tenantId);
      if (tErr) throw tErr;

      // Log audit activity
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('audit_logs').insert({
          performed_by: user.id,
          action: 'delete',
          target_type: 'tenant',
          target_id: tenantId,
          target_tenant: tenantId,
          metadata: { original_action: 'delete-tenant' }
        });
      }

      return { success: true };
    }
  }

  async listUsers(): Promise<AdminUserListItem[]> {
    try {
      return await this.invoke('list-users');
    } catch (err) {
      console.warn('Edge Function list-users failed, falling back to direct DB query:', err);

      const { data: usersList, error: uErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (uErr) throw uErr;

      const { data: tenantsName } = await supabase.from('tenants').select('id, name');
      const tenantsMap = (tenantsName || []).reduce((acc: any, t: any) => {
        acc[t.id] = t.name;
        return acc;
      }, {});

      return (usersList || []).map((u: any) => ({
        ...u,
        tenant_name: tenantsMap[u.tenant_id] || 'Unknown'
      }));
    }
  }

  async getSettings(): Promise<PlatformSettings> {
    try {
      return await this.invoke('get-settings');
    } catch (err) {
      console.warn('Edge Function get-settings failed, falling back to direct DB query:', err);
      const { data, error } = await supabase
        .from('platform_settings')
        .eq('id', 'global')
        .single();
      if (error) throw error;
      return data;
    }
  }

  async updateSettings(settings: Partial<PlatformSettings>): Promise<PlatformSettings> {
    try {
      return await this.invoke('update-settings', { settings });
    } catch (err) {
      console.warn('Edge Function update-settings failed, falling back to direct DB query:', err);
      const { data, error } = await supabase
        .from('platform_settings')
        .update({
          ...settings,
          updated_at: new Date().toISOString()
        })
        .eq('id', 'global')
        .select()
        .single();
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('audit_logs').insert({
          performed_by: user.id,
          action: 'update',
          target_type: 'tenant',
          metadata: { original_action: 'update-settings', changes: Object.keys(settings) }
        });
      }
      return data;
    }
  }
}

export const adminService = new AdminService();
