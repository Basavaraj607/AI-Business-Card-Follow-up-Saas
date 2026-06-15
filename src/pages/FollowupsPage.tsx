// src/pages/FollowupsPage.tsx
import { useState, useRef } from 'react';
import {
  CalendarClock, Mail, MessageSquare, Phone, Link2,
  CheckCircle2, SkipForward, Pencil, Plus, X, ChevronLeft,
  ChevronRight, Loader2, AlertCircle, Sparkles, Clock,
  CalendarDays, ListChecks, Save,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useFollowups, type FollowupFilter, type FollowupWithContact } from '../hooks/useFollowups';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CHANNEL_META: Record<string, { icon: React.ElementType; label: string; color: string; bg: string }> = {
  email:    { icon: Mail,           label: 'Email',     color: 'text-blue-600',   bg: 'bg-blue-50' },
  sms:      { icon: MessageSquare,  label: 'SMS',       color: 'text-violet-600', bg: 'bg-violet-50' },
  whatsapp: { icon: Phone,          label: 'WhatsApp',  color: 'text-green-600',  bg: 'bg-green-50' },
  linkedin: { icon: Link2,         label: 'LinkedIn',  color: 'text-sky-600',    bg: 'bg-sky-50' },
};

const STATUS_BADGE: Record<string, string> = {
  pending:  'bg-amber-50 text-amber-700',
  sent:     'bg-blue-50 text-blue-700',
  done:     'bg-brand-50 text-brand-700',
  skipped:  'bg-gray-100 text-gray-500',
};

function formatDue(due: string) {
  const d = new Date(due);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isPast  = d < now;

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday && isPast) return { label: `Overdue · ${time}`, overdue: true };
  if (isToday)           return { label: `Today · ${time}`,   overdue: false };

  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (d.toDateString() === tomorrow.toDateString()) return { label: `Tomorrow · ${time}`, overdue: false };

  return {
    label: d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) + ` · ${time}`,
    overdue: false,
  };
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function getTodayStr() {
  return new Date().toISOString().split('T')[0];
}

// ─── Schedule Modal ────────────────────────────────────────────────────────────
interface ScheduleModalProps {
  contacts: { id: string; full_name: string; email: string | null; phone: string | null; company: string | null }[];
  onClose: () => void;
  onSave: (payload: {
    contact_id: string; channel: string; due_at: string;
    message_draft: string; subject_draft: string; step_number: number; notes: string;
  }) => Promise<void>;
}

function ScheduleModal({ contacts, onClose, onSave }: ScheduleModalProps) {
  const [contactId, setContactId]     = useState('');
  const [channel, setChannel]         = useState<'email' | 'sms' | 'whatsapp' | 'linkedin'>('email');
  const [dueDate, setDueDate]         = useState('');
  const [dueTime, setDueTime]         = useState('09:00');
  const [draft, setDraft]             = useState('');
  const [subject, setSubject]         = useState('');
  const [stepNumber, setStepNumber]   = useState(1);
  const [notes, setNotes]             = useState('');
  const [saving, setSaving]           = useState(false);

  const selectedContact = contacts.find(c => c.id === contactId);

  const handleSave = async () => {
    if (!contactId || !dueDate) {
      toast.error('Please select a contact and due date');
      return;
    }
    setSaving(true);
    try {
      const due_at = new Date(`${dueDate}T${dueTime}:00`).toISOString();
      await onSave({ contact_id: contactId, channel, due_at, message_draft: draft, subject_draft: subject, step_number: stepNumber, notes });
      toast.success('Follow-up scheduled!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
              <CalendarClock size={18} className="text-brand-600" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">Schedule Follow-up</h2>
              <p className="text-xs text-gray-500">Set a reminder and draft your message</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Contact */}
          <div className="input-group">
            <label className="input-label">Contact *</label>
            <select
              value={contactId}
              onChange={e => setContactId(e.target.value)}
              className="input"
            >
              <option value="">— Select a contact —</option>
              {contacts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.full_name}{c.company ? ` · ${c.company}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Channel */}
          <div className="input-group">
            <label className="input-label">Channel</label>
            <div className="grid grid-cols-4 gap-2">
              {(['email', 'sms', 'whatsapp', 'linkedin'] as const).map(ch => {
                const meta = CHANNEL_META[ch];
                const Icon = meta.icon;
                const active = channel === ch;
                return (
                  <button
                    key={ch}
                    onClick={() => setChannel(ch)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-xs font-semibold transition-all
                      ${active
                        ? `border-brand-400 ${meta.bg} ${meta.color}`
                        : 'border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                  >
                    <Icon size={18} />
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="input-group">
              <label className="input-label">Due Date *</label>
              <input
                type="date"
                value={dueDate}
                min={getTodayStr()}
                onChange={e => setDueDate(e.target.value)}
                className="input"
              />
            </div>
            <div className="input-group">
              <label className="input-label">Time</label>
              <input
                type="time"
                value={dueTime}
                onChange={e => setDueTime(e.target.value)}
                className="input"
              />
            </div>
          </div>

          {/* Step number */}
          <div className="input-group">
            <label className="input-label">Follow-up Step</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => setStepNumber(n)}
                  className={`w-9 h-9 rounded-lg text-sm font-bold transition-all border
                    ${stepNumber === n ? 'bg-brand-400 text-white border-brand-400' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                >
                  {n}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-1">Which step in the sequence is this?</p>
          </div>

          {/* Subject (email only) */}
          {channel === 'email' && (
            <div className="input-group">
              <label className="input-label">Email Subject</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder={`Following up${selectedContact ? ` with ${selectedContact.full_name}` : ''}…`}
                className="input"
              />
            </div>
          )}

          {/* Message draft */}
          <div className="input-group">
            <label className="input-label">Message Draft</label>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              placeholder="Write your follow-up message here…"
              rows={4}
              className="input resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              <Sparkles size={10} className="inline mr-1" />
              You can use the AI composer in Contacts to generate this.
            </p>
          </div>

          {/* Notes */}
          <div className="input-group">
            <label className="input-label">Internal Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Met at SaaStr, interested in Q3 deal…"
              className="input"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving || !contactId || !dueDate}
            className="btn-primary btn-sm flex items-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />}
            {saving ? 'Scheduling…' : 'Schedule Follow-up'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Edit Draft Modal ─────────────────────────────────────────────────────────
interface EditDraftModalProps {
  followup: FollowupWithContact;
  onClose: () => void;
  onSave: (id: string, draft: string, subject?: string) => Promise<void>;
}

function EditDraftModal({ followup, onClose, onSave }: EditDraftModalProps) {
  const [draft,   setDraft]   = useState(followup.message_draft ?? '');
  const [subject, setSubject] = useState(followup.subject_draft ?? '');
  const [saving,  setSaving]  = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(followup.id, draft, subject);
      toast.success('Draft saved!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const meta = CHANNEL_META[followup.channel];
  const Icon = meta.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center`}>
              <Icon size={18} className={meta.color} />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 text-base">Edit Draft</h2>
              <p className="text-xs text-gray-500">{followup.contact?.full_name} · {meta.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* AI Suggestion preview */}
          {followup.ai_suggestion && (
            <div className="bg-brand-50 border border-brand-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-brand-700 flex items-center gap-1.5 mb-2">
                <Sparkles size={12} /> AI Suggestion
              </p>
              <p className="text-sm text-brand-900 leading-relaxed">{followup.ai_suggestion}</p>
            </div>
          )}

          {followup.channel === 'email' && (
            <div className="input-group">
              <label className="input-label">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="input"
                placeholder="Email subject…"
              />
            </div>
          )}

          <div className="input-group">
            <label className="input-label">Message</label>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={6}
              className="input resize-none"
              placeholder="Your follow-up message…"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={onClose} className="btn-secondary btn-sm">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary btn-sm flex items-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save Draft'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Follow-up Card ───────────────────────────────────────────────────────────
interface FollowupCardProps {
  followup: FollowupWithContact;
  onDone:   (id: string) => void;
  onSkip:   (id: string) => void;
  onEdit:   (f: FollowupWithContact) => void;
}

function FollowupCard({ followup, onDone, onSkip, onEdit }: FollowupCardProps) {
  const [expanded,    setExpanded]    = useState(false);
  const [doneLoading, setDoneLoading] = useState(false);
  const [skipLoading, setSkipLoading] = useState(false);

  const meta    = CHANNEL_META[followup.channel] ?? CHANNEL_META.email;
  const Icon    = meta.icon;
  const due     = formatDue(followup.due_at);
  const contact = followup.contact;
  const initials = contact ? getInitials(contact.full_name) : '??';

  const handleDone = async () => {
    setDoneLoading(true);
    try { await onDone(followup.id); }
    finally { setDoneLoading(false); }
  };

  const handleSkip = async () => {
    setSkipLoading(true);
    try { await onSkip(followup.id); }
    finally { setSkipLoading(false); }
  };

  return (
    <div className={`card card-hover p-0 overflow-hidden transition-all duration-200
      ${due.overdue ? 'border-red-200 shadow-red-50' : ''}`}
    >
      {/* Overdue accent bar */}
      {due.overdue && <div className="h-0.5 w-full bg-gradient-to-r from-red-400 to-rose-400" />}

      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-4">

          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-sm shrink-0">
            {initials}
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-gray-900 text-sm">
                    {contact?.full_name ?? 'Unknown Contact'}
                  </h3>
                  {/* Step badge */}
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    Step {followup.step_number}
                  </span>
                </div>
                {contact?.full_name && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {followup.contact?.email ?? followup.contact?.phone ?? ''}
                  </p>
                )}
              </div>

              {/* Channel badge */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg ${meta.bg} shrink-0`}>
                <Icon size={12} className={meta.color} />
                <span className={`text-[11px] font-semibold ${meta.color}`}>{meta.label}</span>
              </div>
            </div>

            {/* Due time */}
            <div className={`flex items-center gap-1.5 mt-2 text-xs font-medium
              ${due.overdue ? 'text-red-600' : 'text-gray-500'}`}
            >
              <Clock size={12} />
              {due.label}
              {due.overdue && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-50 text-red-600 text-[10px] font-bold">
                  OVERDUE
                </span>
              )}
            </div>

            {/* Draft preview (collapsible) */}
            {(followup.message_draft || followup.ai_suggestion) && (
              <div className="mt-3">
                <button
                  onClick={() => setExpanded(e => !e)}
                  className="text-xs text-brand-600 font-semibold hover:underline flex items-center gap-1"
                >
                  {expanded ? 'Hide' : 'View'} draft
                  <ChevronRight size={12} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
                </button>
                {expanded && (
                  <div className="mt-2 bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
                    {followup.message_draft || followup.ai_suggestion}
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {followup.notes && (
              <p className="mt-2 text-xs text-gray-400 italic truncate">📝 {followup.notes}</p>
            )}
          </div>
        </div>

        {/* Action Row */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-50">
          <button
            onClick={handleDone}
            disabled={doneLoading}
            className="btn-primary btn-sm flex-1 flex items-center justify-center gap-1.5"
          >
            {doneLoading
              ? <Loader2 size={13} className="animate-spin" />
              : <CheckCircle2 size={13} />
            }
            Done
          </button>

          <button
            onClick={() => onEdit(followup)}
            className="btn-secondary btn-sm flex items-center gap-1.5"
          >
            <Pencil size={13} />
            Edit Draft
          </button>

          <button
            onClick={handleSkip}
            disabled={skipLoading}
            className="btn-ghost btn-sm flex items-center gap-1.5 text-gray-400 hover:text-gray-600"
          >
            {skipLoading
              ? <Loader2 size={13} className="animate-spin" />
              : <SkipForward size={13} />
            }
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Timeline Strip ───────────────────────────────────────────────────────────
interface TimelineStripProps {
  dayCounts: { date: string; pending: number; done: number }[];
  selectedDate: string | null;
  onSelectDate: (date: string | null) => void;
}

function TimelineStrip({ dayCounts, selectedDate, onSelectDate }: TimelineStripProps) {
  const todayStr = getTodayStr();
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -160 : 160, behavior: 'smooth' });
  };

  const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
          <CalendarDays size={16} className="text-brand-500" />
          7-Day Timeline
        </h3>
        <div className="flex gap-1">
          <button onClick={() => scroll('left')}  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><ChevronLeft  size={16} /></button>
          <button onClick={() => scroll('right')} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div ref={scrollRef} className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {/* "All" pill */}
        <button
          onClick={() => onSelectDate(null)}
          className={`flex-shrink-0 flex flex-col items-center justify-center px-4 py-3 rounded-xl border-2 text-xs font-semibold transition-all
            ${!selectedDate
              ? 'border-brand-400 bg-brand-50 text-brand-700'
              : 'border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50'
            }`}
        >
          <span className="text-[10px] uppercase tracking-wider mb-0.5">All</span>
          <span className="text-lg font-black leading-none">–</span>
        </button>

        {dayCounts.map(({ date, pending, done }) => {
          const d       = new Date(date + 'T12:00:00');
          const isToday = date === todayStr;
          const isSelected = date === selectedDate;
          const total   = pending + done;

          return (
            <button
              key={date}
              onClick={() => onSelectDate(isSelected ? null : date)}
              className={`flex-shrink-0 flex flex-col items-center gap-1 px-4 py-3 rounded-xl border-2 min-w-[72px] transition-all
                ${isSelected
                  ? 'border-brand-400 bg-brand-50 text-brand-700'
                  : isToday
                    ? 'border-brand-200 bg-brand-50/50 text-brand-800'
                    : 'border-gray-100 text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                }`}
            >
              <span className="text-[10px] uppercase tracking-wider font-semibold text-gray-400">
                {DAY_LABELS[d.getDay()]}
              </span>
              <span className={`text-lg font-black leading-none ${isToday ? 'text-brand-600' : ''}`}>
                {d.getDate()}
              </span>
              <span className="text-[9px] text-gray-400 font-medium">
                {MONTH_NAMES[d.getMonth()]}
              </span>

              {/* Dot indicators */}
              <div className="flex gap-1 mt-1">
                {pending > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title={`${pending} pending`} />
                )}
                {done > 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400" title={`${done} done`} />
                )}
                {total === 0 && (
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 px-1">
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <span className="w-2 h-2 rounded-full bg-amber-400" /> Pending
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <span className="w-2 h-2 rounded-full bg-brand-400" /> Done
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
          <span className="w-2 h-2 rounded-full bg-gray-200" /> None
        </div>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ filter, onSchedule }: { filter: FollowupFilter; onSchedule: () => void }) {
  const messages: Record<FollowupFilter, { icon: string; title: string; subtitle: string }> = {
    today:    { icon: '🎉', title: "You're all caught up!",         subtitle: "No follow-ups due today. Schedule your next one." },
    upcoming: { icon: '📅', title: 'Nothing scheduled yet',        subtitle: 'Plan ahead by scheduling your follow-ups.' },
    done:     { icon: '📋', title: 'No completed follow-ups yet',  subtitle: 'Mark follow-ups as done and they\'ll appear here.' },
    all:      { icon: '📭', title: 'No follow-ups found',          subtitle: 'Create your first follow-up to get started.' },
  };
  const { icon, title, subtitle } = messages[filter];

  return (
    <div className="empty-state">
      <div className="empty-icon text-4xl">{icon}</div>
      <h3 className="font-bold text-gray-900 text-base mb-1">{title}</h3>
      <p className="text-sm text-gray-500 max-w-xs mb-5">{subtitle}</p>
      <button onClick={onSchedule} className="btn-primary btn-sm flex items-center gap-2">
        <Plus size={14} />
        Schedule a Follow-up
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const FILTER_TABS: { key: FollowupFilter; label: string; icon: React.ElementType }[] = [
  { key: 'today',    label: 'Today',    icon: Clock },
  { key: 'upcoming', label: 'Upcoming', icon: CalendarDays },
  { key: 'done',     label: 'Done',     icon: ListChecks },
];

export function FollowupsPage() {
  const {
    followups, loading, error, todayCount, dayCounts, contacts,
    fetchFollowups, fetchDayCounts, markDone, skipFollowup, updateDraft, createFollowup,
  } = useFollowups();

  const [activeFilter,  setActiveFilter]  = useState<FollowupFilter>('today');
  const [selectedDate,  setSelectedDate]  = useState<string | null>(null);
  const [showSchedule,  setShowSchedule]  = useState(false);
  const [editingFollowup, setEditingFollowup] = useState<FollowupWithContact | null>(null);

  const handleFilterChange = (filter: FollowupFilter) => {
    setActiveFilter(filter);
    setSelectedDate(null);
    fetchFollowups(filter);
  };

  const handleDateSelect = (date: string | null) => {
    setSelectedDate(date);
    fetchFollowups(activeFilter, date ?? undefined);
  };

  const handleDone = async (id: string) => {
    await markDone(id);
    fetchDayCounts();
  };

  const handleSkip = async (id: string) => {
    await skipFollowup(id);
    fetchDayCounts();
  };

  const handleCreate = async (payload: any) => {
    await createFollowup(payload);
    fetchFollowups(activeFilter);
    fetchDayCounts();
  };

  const handleUpdateDraft = async (id: string, draft: string, subject?: string) => {
    await updateDraft(id, draft, subject);
  };

  return (
    <div className="space-y-6">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            <CalendarClock size={24} className="text-brand-500" />
            Follow-up Scheduler
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage your relationship pipeline, one follow-up at a time.
          </p>
        </div>

        <button
          onClick={() => setShowSchedule(true)}
          className="btn-primary shadow-sm flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <Plus size={16} />
          Schedule Follow-up
        </button>
      </div>

      {/* ── Stats Row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[
          { label: 'Due Today',    value: dayCounts.find(d => d.date === getTodayStr())?.pending ?? 0, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Upcoming',     value: dayCounts.filter(d => d.date > getTodayStr()).reduce((s, d) => s + d.pending, 0), color: 'text-brand-600', bg: 'bg-brand-50' },
          { label: 'Done This Week', value: dayCounts.reduce((s, d) => s + d.done, 0), color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="card p-4 text-center">
            <p className={`text-2xl font-black ${color}`}>{value}</p>
            <p className="text-xs font-semibold text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Timeline Strip ──────────────────────────────────────────────────── */}
      <TimelineStrip
        dayCounts={dayCounts}
        selectedDate={selectedDate}
        onSelectDate={handleDateSelect}
      />

      {/* ── Filter Tabs ─────────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {FILTER_TABS.map(({ key, label, icon: TabIcon }) => (
          <button
            key={key}
            onClick={() => handleFilterChange(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all
              ${activeFilter === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
              }`}
          >
            <TabIcon size={15} />
            {label}
            {key === 'today' && todayCount > 0 && (
              <span className="ml-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-400 text-white text-[10px] font-bold flex items-center justify-center">
                {todayCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Selected date label ──────────────────────────────────────────────── */}
      {selectedDate && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-700">
            Showing: {new Date(selectedDate + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </span>
          <button
            onClick={() => handleDateSelect(null)}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <X size={12} /> Clear
          </button>
        </div>
      )}

      {/* ── Follow-up List ───────────────────────────────────────────────────── */}
      {error && (
        <div className="card p-4 flex items-center gap-3 text-red-600 bg-red-50 border-red-200">
          <AlertCircle size={18} />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="card p-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-sm text-gray-500">Loading follow-ups…</p>
        </div>
      ) : followups.length === 0 ? (
        <EmptyState filter={activeFilter} onSchedule={() => setShowSchedule(true)} />
      ) : (
        <div className="space-y-3">
          {followups.map(followup => (
            <FollowupCard
              key={followup.id}
              followup={followup}
              onDone={handleDone}
              onSkip={handleSkip}
              onEdit={setEditingFollowup}
            />
          ))}
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {showSchedule && (
        <ScheduleModal
          contacts={contacts}
          onClose={() => setShowSchedule(false)}
          onSave={handleCreate}
        />
      )}
      {editingFollowup && (
        <EditDraftModal
          followup={editingFollowup}
          onClose={() => setEditingFollowup(null)}
          onSave={handleUpdateDraft}
        />
      )}
    </div>
  );
}

export default FollowupsPage;
