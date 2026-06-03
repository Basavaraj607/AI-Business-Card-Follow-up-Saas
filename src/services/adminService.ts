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
    return this.invoke('get-overview');
  }

  async listTenants(): Promise<AdminTenantListItem[]> {
    return this.invoke('list-tenants');
  }

  async getTenant(tenantId: string): Promise<AdminTenantDetail> {
    return this.invoke('get-tenant', { tenantId });
  }

  async changePlan(tenantId: string, plan: 'free' | 'pro' | 'team' | 'enterprise'): Promise<any> {
    return this.invoke('change-plan', { tenantId, plan });
  }

  async deleteTenant(tenantId: string): Promise<any> {
    return this.invoke('delete-tenant', { tenantId });
  }

  async listUsers(): Promise<AdminUserListItem[]> {
    return this.invoke('list-users');
  }

  async getSettings(): Promise<PlatformSettings> {
    return this.invoke('get-settings');
  }

  async updateSettings(settings: Partial<PlatformSettings>): Promise<PlatformSettings> {
    return this.invoke('update-settings', { settings });
  }
}

export const adminService = new AdminService();
