// src/pages/DashboardPage.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Database } from '../types/database';
import {
  Users, Mail, Flame, Plus, CreditCard,
  ChevronRight, Calendar, Loader2, TrendingUp,
  TrendingDown, Minus, CalendarClock, CheckCircle2,
  Clock, ArrowRight, Zap, Target, BarChart2,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface DashStats {
  totalContacts: number;
  hotContacts: number;
  warmContacts: number;
  coldContacts: number;
  convertedContacts: number;
  followupsSent: number;
  conversionRate: number;
}

interface RecentContact {
  id: string;
  full_name: string;
  role: string | null;
  ai_structured: any;
  lead_status: string;
  met_at_date: string | null;
  created_at: string;
}

interface TodayFollowup {
  id: string;
  channel: string;
  due_at: string;
  status: string;
  step_number: number;
  contact: { id: string; full_name: string } | null;
}

interface DayActivity {
  date: string;   // YYYY-MM-DD
  count: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const LEAD_STATUS_COLORS: Record<string, { bar: string; badge: string }> = {
  hot:       { bar: 'bg-red-400',   badge: 'bg-red-50 text-red-700' },
  warm:      { bar: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700' },
  cold:      { bar: 'bg-blue-400',  badge: 'bg-blue-50 text-blue-700' },
  converted: { bar: 'bg-brand-400', badge: 'bg-brand-50 text-brand-700' },
};

const CHANNEL_ICONS: Record<string, string> = {
  email: '✉️', sms: '💬', whatsapp: '📱', linkedin: '🔗',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ─── Mini Sparkline (pure CSS bars) ──────────────────────────────────────────
function Sparkline({ data, color = 'bg-brand-400' }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((v, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm opacity-80 ${color} transition-all`}
          style={{ height: `${Math.max((v / max) * 100, 4)}%` }}
        />
      ))}
    </div>
  );
}

// ─── Trend indicator ──────────────────────────────────────────────────────────
function Trend({ value }: { value: number }) {
  if (value > 0) return (
    <span className="flex items-center gap-0.5 text-[11px] font-bold text-brand-600">
      <TrendingUp size={11} /> +{value}%
    </span>
  );
  if (value < 0) return (
    <span className="flex items-center gap-0.5 text-[11px] font-bold text-red-500">
      <TrendingDown size={11} /> {value}%
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-[11px] font-bold text-gray-400">
      <Minus size={11} /> 0%
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashStats>({
    totalContacts: 0, hotContacts: 0, warmContacts: 0,
    coldContacts: 0, convertedContacts: 0,
    followupsSent: 0, conversionRate: 0,
  });
  const [recentContacts,  setRecentContacts]  = useState<RecentContact[]>([]);
  const [todayFollowups,  setTodayFollowups]  = useState<TodayFollowup[]>([]);
  const [activityData,    setActivityData]    = useState<DayActivity[]>([]);
  const [markingDone,     setMarkingDone]     = useState<string | null>(null);

  const name = user?.user_metadata?.full_name?.split(' ')[0] ?? 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // ── 1. Pipeline counts ────────────────────────────────────────────────
      const statusCounts = await Promise.all(
        ['hot', 'warm', 'cold', 'converted'].map(status =>
          supabase.from('contacts').select('*', { count: 'exact', head: true })
            .eq('created_by', user.id).eq('lead_status', status)
        )
      );
      const [hot, warm, cold, converted] = statusCounts.map(r => r.count ?? 0);
      const total = hot + warm + cold + converted +
        ((await supabase.from('contacts').select('*', { count: 'exact', head: true })
          .eq('created_by', user.id).eq('lead_status', 'dead')).count ?? 0);

      // ── 2. Follow-ups sent ────────────────────────────────────────────────
      const { count: fupCount } = await supabase
        .from('messages').select('*', { count: 'exact', head: true })
        .eq('sent_by', user.id);

      // ── 3. Recent 5 contacts ─────────────────────────────────────────────
      const { data: recents } = await supabase
        .from('contacts')
        .select('id, full_name, role, ai_structured, lead_status, met_at_date, created_at')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(5);

      // ── 4. Today's follow-ups ─────────────────────────────────────────────
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd   = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const { data: fups } = await supabase
        .from('followups')
        .select('id, channel, due_at, status, step_number, contact:contacts(id, full_name)')
        .lte('due_at', todayEnd.toISOString())
        .gte('due_at', new Date(Date.now() - 86400000 * 2).toISOString()) // include overdue
        .in('status', ['pending', 'sent'])
        .order('due_at', { ascending: true })
        .limit(5);

      // ── 5. Activity last 7 days ───────────────────────────────────────────
      const days: DayActivity[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
        const dEnd = new Date(d); dEnd.setHours(23, 59, 59, 999);
        const { count } = await supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('created_by', user.id)
          .gte('created_at', d.toISOString())
          .lte('created_at', dEnd.toISOString());
        days.push({ date: d.toISOString().split('T')[0], count: count ?? 0 });
      }

      setStats({
        totalContacts: total,
        hotContacts: hot,
        warmContacts: warm,
        coldContacts: cold,
        convertedContacts: converted,
        followupsSent: fupCount ?? 0,
        conversionRate: total > 0 ? Math.round((converted / total) * 100) : 0,
      });
      setRecentContacts(recents ?? []);
      setTodayFollowups(
        (fups ?? []).map((f: any) => ({
          ...f,
          contact: Array.isArray(f.contact) ? f.contact[0] ?? null : f.contact,
        }))
      );
      setActivityData(days);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user]);

  const handleMarkDone = async (id: string) => {
    setMarkingDone(id);
    try {
      const { error } = await (supabase.from('followups') as any)
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      setTodayFollowups(prev => prev.filter(f => f.id !== id));
    } finally { setMarkingDone(null); }
  };

  // ── KPI cards config ─────────────────────────────────────────────────────
  const kpiCards = [
    {
      label: 'Total Contacts', value: stats.totalContacts,
      icon: Users, trend: 12, color: 'text-brand-600', bg: 'bg-brand-50',
      sparkData: activityData.map(d => d.count),
      sparkColor: 'bg-brand-400',
    },
    {
      label: 'Hot Leads 🔥', value: stats.hotContacts,
      icon: Flame, trend: 5, color: 'text-red-600', bg: 'bg-red-50',
      sparkData: [2, 1, 3, 2, 4, 3, stats.hotContacts],
      sparkColor: 'bg-red-400',
    },
    {
      label: 'Follow-ups Sent', value: stats.followupsSent,
      icon: Mail, trend: 20, color: 'text-blue-600', bg: 'bg-blue-50',
      sparkData: [1, 3, 2, 5, 4, 6, stats.followupsSent > 0 ? 7 : 0],
      sparkColor: 'bg-blue-400',
    },
    {
      label: 'Conversion Rate', value: `${stats.conversionRate}%`,
      icon: Target, trend: stats.conversionRate > 0 ? 3 : 0, color: 'text-amber-600', bg: 'bg-amber-50',
      sparkData: [5, 8, 6, 10, 9, 12, stats.conversionRate],
      sparkColor: 'bg-amber-400',
    },
  ];

  const pipelineStages = [
    { key: 'hot',       label: 'Hot',       count: stats.hotContacts,       emoji: '🔥' },
    { key: 'warm',      label: 'Warm',      count: stats.warmContacts,      emoji: '☀️' },
    { key: 'cold',      label: 'Cold',      count: stats.coldContacts,      emoji: '❄️' },
    { key: 'converted', label: 'Converted', count: stats.convertedContacts, emoji: '✅' },
  ];
  const pipelineMax = Math.max(...pipelineStages.map(s => s.count), 1);

  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  if (loading) return (
    <div className="card p-16 flex flex-col items-center justify-center gap-3">
      <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
      <p className="text-sm text-gray-500">Loading your pipeline…</p>
    </div>
  );

  return (
    <div className="space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{greeting}, {name} 👋</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {stats.totalContacts === 0
              ? 'Scan your first business card to get started.'
              : `You have ${stats.hotContacts} hot leads and ${todayFollowups.length} follow-ups due today.`}
          </p>
        </div>
        <Link to="/contacts/upload" className="btn-primary shadow-sm flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
          <Plus size={16} /> Scan a Card
        </Link>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map(({ label, value, icon: Icon, trend, color, bg, sparkData, sparkColor }) => (
          <div key={label} className="card p-5 hover:shadow-md transition-shadow duration-200 space-y-3">
            <div className="flex items-start justify-between">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon size={17} className={color} />
              </div>
              <Trend value={trend} />
            </div>
            <div>
              <p className="text-2xl font-black text-gray-900">{value}</p>
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mt-0.5">{label}</p>
            </div>
            <Sparkline data={sparkData} color={sparkColor} />
          </div>
        ))}
      </div>

      {/* ── Middle Row: Pipeline + Today's Agenda ──────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-5">

        {/* Pipeline Funnel */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <BarChart2 size={16} className="text-brand-500" />
              Lead Pipeline
            </h3>
            <Link to="/contacts" className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-0.5">
              View all <ChevronRight size={13} />
            </Link>
          </div>

          {stats.totalContacts === 0 ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400">No contacts yet — scan a card to start!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pipelineStages.map(({ key, label, count, emoji }) => {
                const cfg = LEAD_STATUS_COLORS[key];
                const pct = Math.round((count / pipelineMax) * 100);
                return (
                  <div key={key}
                    onClick={() => navigate(`/contacts?status=${key}`)}
                    className="group cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold text-gray-700 flex items-center gap-1.5">
                        {emoji} {label}
                      </span>
                      <span className="font-black text-gray-900">{count}</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${cfg.bar}
                          group-hover:opacity-80`}
                        style={{ width: `${Math.max(pct, count > 0 ? 6 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Today's Agenda */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <CalendarClock size={16} className="text-brand-500" />
              Today's Follow-ups
            </h3>
            <Link to="/followups" className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-0.5">
              View all <ChevronRight size={13} />
            </Link>
          </div>

          {todayFollowups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="text-3xl mb-2">🎉</div>
              <p className="text-sm font-semibold text-gray-700">All caught up!</p>
              <p className="text-xs text-gray-400 mt-1">No follow-ups due today.</p>
              <Link to="/followups" className="btn-primary btn-sm mt-3 flex items-center gap-1.5">
                <Plus size={13} /> Schedule one
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {todayFollowups.map(fup => {
                const due = new Date(fup.due_at);
                const isOverdue = due < new Date();
                return (
                  <div key={fup.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border
                      ${isOverdue ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                    <span className="text-base shrink-0">{CHANNEL_ICONS[fup.channel] ?? '📨'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-800 truncate">
                        {fup.contact?.full_name ?? 'Unknown Contact'}
                      </p>
                      <p className={`text-[10px] flex items-center gap-1 mt-0.5
                        ${isOverdue ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                        <Clock size={9} />
                        {isOverdue ? 'Overdue · ' : ''}
                        {due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {' · '}Step {fup.step_number}
                      </p>
                    </div>
                    <button
                      onClick={() => handleMarkDone(fup.id)}
                      disabled={markingDone === fup.id}
                      className="btn-primary btn-sm shrink-0 flex items-center gap-1 text-[11px] px-2.5"
                    >
                      {markingDone === fup.id
                        ? <Loader2 size={11} className="animate-spin" />
                        : <CheckCircle2 size={11} />}
                      Done
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Row: Activity Chart + Recent Contacts ─────────────────── */}
      <div className="grid md:grid-cols-3 gap-5">

        {/* 7-day Activity Chart */}
        <div className="card p-5">
          <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2 mb-5">
            <Zap size={16} className="text-brand-500" />
            Cards Scanned — Last 7 Days
          </h3>
          <div className="flex items-end gap-1.5 h-24">
            {activityData.map((day, i) => {
              const max = Math.max(...activityData.map(d => d.count), 1);
              const pct = Math.max((day.count / max) * 100, day.count > 0 ? 8 : 3);
              const isToday = i === activityData.length - 1;
              return (
                <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center" style={{ height: '72px' }}>
                    <div
                      className={`w-full rounded-t-md transition-all duration-500
                        ${isToday ? 'bg-brand-400' : 'bg-gray-200 hover:bg-brand-300'}`}
                      style={{ height: `${pct}%` }}
                      title={`${day.count} card${day.count !== 1 ? 's' : ''}`}
                    />
                  </div>
                  <span className="text-[9px] text-gray-400 font-medium">
                    {DAY_LABELS[new Date(day.date + 'T12:00:00').getDay() === 0 ? 6 :
                      new Date(day.date + 'T12:00:00').getDay() - 1]}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
            <span>Total: <strong className="text-gray-700">{activityData.reduce((s, d) => s + d.count, 0)}</strong> cards</span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-sm bg-brand-400 inline-block" /> Today
            </span>
          </div>
        </div>

        {/* Recent Contacts */}
        <div className="md:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Users size={16} className="text-brand-500" />
              Recent Contacts
            </h3>
            <Link to="/contacts" className="text-xs font-semibold text-brand-600 hover:underline flex items-center gap-0.5">
              View all <ChevronRight size={13} />
            </Link>
          </div>

          {recentContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-gray-50 text-gray-300 flex items-center justify-center mb-3">
                <CreditCard size={20} />
              </div>
              <h4 className="font-semibold text-gray-700 text-sm mb-1">No contacts yet</h4>
              <p className="text-xs text-gray-400 max-w-xs mb-4">
                Scan a business card and the AI will extract all contact details automatically.
              </p>
              <Link to="/contacts/upload" className="btn-primary btn-sm flex items-center gap-1.5">
                <Plus size={14} /> Scan Your First Card
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentContacts.map(contact => {
                const company   = contact.ai_structured?.company ?? '';
                const initials  = contact.full_name.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase();
                const statusCfg = LEAD_STATUS_COLORS[contact.lead_status];
                return (
                  <div
                    key={contact.id}
                    onClick={() => navigate(`/contacts/${contact.id}`)}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl
                      hover:bg-gray-50 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-700
                        flex items-center justify-center font-bold text-xs shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-gray-900 text-sm truncate">{contact.full_name}</h4>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                          {contact.role && <span className="truncate">{contact.role}</span>}
                          {contact.role && company && <span>·</span>}
                          {company && <span className="font-semibold truncate">{company}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize
                        ${statusCfg?.badge ?? 'bg-gray-100 text-gray-500'}`}>
                        {contact.lead_status}
                      </span>
                      <span className="text-[10px] text-gray-400">{timeAgo(contact.created_at)}</span>
                      <ArrowRight size={14} className="text-gray-300 group-hover:text-brand-500 transition-colors" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default DashboardPage;
