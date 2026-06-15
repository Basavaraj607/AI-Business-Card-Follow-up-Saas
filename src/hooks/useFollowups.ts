// src/hooks/useFollowups.ts
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '../lib/supabase/client';
import { useAuth } from '../lib/auth-context';
import type { Followup } from '../types/database';

export type FollowupFilter = 'today' | 'upcoming' | 'done' | 'all';

export interface FollowupWithContact extends Followup {
  contact: {
    id: string;
    full_name: string;
    email: string | null;
    phone: string | null;
    company: string | null;
    lead_status: string;
  } | null;
}

export interface CreateFollowupPayload {
  contact_id: string;
  channel: 'email' | 'whatsapp' | 'sms' | 'linkedin';
  due_at: string;
  message_draft?: string;
  subject_draft?: string;
  ai_suggestion?: string;
  step_number?: number;
  notes?: string;
}

export interface ContactOption {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
}

// ─── Day counts for timeline strip ────────────────────────────────────────────
export interface DayCount {
  date: string; // YYYY-MM-DD
  pending: number;
  done: number;
}

export function useFollowups() {
  const { user, tenantId } = useAuth();
  const [followups, setFollowups] = useState<FollowupWithContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayCount, setTodayCount] = useState(0);
  const [dayCounts, setDayCounts] = useState<DayCount[]>([]);
  const [contacts, setContacts] = useState<ContactOption[]>([]);

  const supabase = createClient();

  // ── Build today date strings ───────────────────────────────────────────────
  const getTodayBounds = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return {
      start: start.toISOString(),
      end:   end.toISOString(),
    };
  };

  // ── Fetch follow-ups ───────────────────────────────────────────────────────
  const fetchFollowups = useCallback(async (filter: FollowupFilter = 'today', selectedDate?: string) => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('followups')
        .select(`
          *,
          contact:contacts(id, full_name, email, phone, ai_structured, lead_status)
        `)
        .order('due_at', { ascending: true });

      // Tenant filter — use tenant_id if available, otherwise fall back to created_by via contacts
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      if (filter === 'today') {
        const { start, end } = getTodayBounds();
        query = query
          .lte('due_at', end)
          .in('status', ['pending', 'sent']);
      } else if (filter === 'upcoming') {
        const { end } = getTodayBounds();
        query = query
          .gte('due_at', end)
          .in('status', ['pending']);
      } else if (filter === 'done') {
        query = query.in('status', ['done', 'skipped']);
      }

      // When a specific calendar day is selected
      if (selectedDate) {
        const dayStart = new Date(selectedDate);
        const dayEnd   = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);
        query = query
          .gte('due_at', dayStart.toISOString())
          .lt('due_at',  dayEnd.toISOString());
      }

      const { data, error: fetchError } = await query.limit(50);

      if (fetchError) throw fetchError;

      // Normalize contact field — Supabase returns it as a nested object or array
      const normalized = (data || []).map((row: any) => ({
        ...row,
        contact: Array.isArray(row.contact) ? row.contact[0] ?? null : row.contact,
      })) as FollowupWithContact[];

      setFollowups(normalized);

      // Count today's pending for badge
      if (filter === 'today' || filter === 'all') {
        const { start, end } = getTodayBounds();
        const { count } = await supabase
          .from('followups')
          .select('*', { count: 'exact', head: true })
          .lte('due_at', end)
          .in('status', ['pending', 'sent'])
          .eq(tenantId ? 'tenant_id' : 'assigned_to', tenantId ?? user.id);

        setTodayCount(count ?? 0);
      }

    } catch (err: any) {
      console.error('useFollowups fetch error:', err);
      setError(err.message || 'Failed to load follow-ups');
      setFollowups([]);
    } finally {
      setLoading(false);
    }
  }, [user, tenantId]);

  // ── Fetch 7-day counts for timeline strip ─────────────────────────────────
  const fetchDayCounts = useCallback(async () => {
    if (!user) return;
    const today = new Date();
    const days: DayCount[] = [];

    // Build array of 7 days starting from yesterday
    for (let i = -1; i <= 6; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
      const dayStart = d.toISOString();
      const dayEnd   = new Date(d.getTime() + 86400000).toISOString();
      const dateStr  = d.toISOString().split('T')[0];

      try {
        const { count: pending } = await supabase
          .from('followups')
          .select('*', { count: 'exact', head: true })
          .gte('due_at', dayStart)
          .lt('due_at', dayEnd)
          .in('status', ['pending', 'sent'])
          .eq(tenantId ? 'tenant_id' : 'assigned_to', tenantId ?? user.id);

        const { count: done } = await supabase
          .from('followups')
          .select('*', { count: 'exact', head: true })
          .gte('due_at', dayStart)
          .lt('due_at', dayEnd)
          .in('status', ['done', 'skipped'])
          .eq(tenantId ? 'tenant_id' : 'assigned_to', tenantId ?? user.id);

        days.push({ date: dateStr, pending: pending ?? 0, done: done ?? 0 });
      } catch {
        days.push({ date: dateStr, pending: 0, done: 0 });
      }
    }
    setDayCounts(days);
  }, [user, tenantId]);

  // ── Fetch contacts for "Schedule New" dropdown ─────────────────────────────
  const fetchContacts = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('contacts')
        .select('id, full_name, email, phone, ai_structured, lead_status')
        .eq('created_by', user.id)
        .eq('is_archived', false)
        .order('full_name', { ascending: true })
        .limit(100);

      setContacts(
        (data || []).map((c: any) => ({
          id:         c.id,
          full_name:  c.full_name,
          email:      c.email,
          phone:      c.phone,
          company:    c.ai_structured?.company ?? null,
        }))
      );
    } catch (err) {
      console.warn('Failed to fetch contacts for dropdown:', err);
    }
  }, [user]);

  // ── Mark follow-up as done ────────────────────────────────────────────────
  const markDone = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('followups')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    setFollowups(prev => prev.filter(f => f.id !== id));
    setTodayCount(prev => Math.max(0, prev - 1));
  }, []);

  // ── Skip a follow-up ──────────────────────────────────────────────────────
  const skipFollowup = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('followups')
      .update({ status: 'skipped' })
      .eq('id', id);

    if (error) throw error;

    setFollowups(prev => prev.filter(f => f.id !== id));
    setTodayCount(prev => Math.max(0, prev - 1));
  }, []);

  // ── Update draft ──────────────────────────────────────────────────────────
  const updateDraft = useCallback(async (id: string, message_draft: string, subject_draft?: string) => {
    const { error } = await supabase
      .from('followups')
      .update({ message_draft, subject_draft })
      .eq('id', id);

    if (error) throw error;

    setFollowups(prev =>
      prev.map(f => f.id === id ? { ...f, message_draft, subject_draft: subject_draft ?? f.subject_draft } : f)
    );
  }, []);

  // ── Create a new follow-up ────────────────────────────────────────────────
  const createFollowup = useCallback(async (payload: CreateFollowupPayload) => {
    if (!user || !tenantId) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('followups')
      .insert({
        tenant_id:     tenantId,
        contact_id:    payload.contact_id,
        assigned_to:   user.id,
        status:        'pending',
        channel:       payload.channel,
        due_at:        payload.due_at,
        message_draft: payload.message_draft ?? null,
        subject_draft: payload.subject_draft ?? null,
        ai_suggestion: payload.ai_suggestion ?? null,
        step_number:   payload.step_number ?? 1,
        notes:         payload.notes ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }, [user, tenantId]);

  // ── Initialise ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (user) {
      fetchFollowups('today');
      fetchDayCounts();
      fetchContacts();
    }
  }, [user]);

  return {
    followups,
    loading,
    error,
    todayCount,
    dayCounts,
    contacts,
    fetchFollowups,
    fetchDayCounts,
    markDone,
    skipFollowup,
    updateDraft,
    createFollowup,
  };
}
