// src/pages/ContactDetailPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Mail, Phone, Globe, Briefcase, Building2,
  Calendar, MapPin, Tag, Edit3, Trash2, CalendarClock,
  Send, Loader2, AlertCircle, MessageSquare, CheckCircle2,
  SkipForward, Clock, Sparkles, FileText, Image as ImageIcon,
  ChevronDown, ChevronUp, Star, TrendingUp, User,
  ExternalLink, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../lib/auth-context';
import { createClient } from '../lib/supabase/client';
import { MessageSendPreviewModal } from '../components/MessageSendPreviewModal';

// ─── LinkedIn SVG (not in this lucide version) ────────────────────────────────
const LinkedInIcon = (props: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" />
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────
interface ContactDetail {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  department: string | null;
  card_image_url: string | null;
  raw_ocr_text: string | null;
  ai_structured: any;
  ai_notes: string | null;
  context_notes: string | null;
  last_interaction_summary: string | null;
  lead_status: string;
  lead_score: number | null;
  opportunity_type: string | null;
  relationship_stage: string;
  met_at_event: string | null;
  met_at_date: string | null;
  met_at_location: string | null;
  tags: string[];
  email_count: number;
  whatsapp_count: number;
  sms_count: number;
  linkedin_url: string | null;
  next_followup_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  channel: string;
  status: string;
  subject: string | null;
  body: string;
  ai_generated: boolean;
  sent_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  created_at: string;
}

interface FollowupItem {
  id: string;
  channel: string;
  status: string;
  due_at: string;
  message_draft: string | null;
  subject_draft: string | null;
  step_number: number;
  notes: string | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const LEAD_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  hot:       { label: 'Hot',       color: 'text-red-700',   bg: 'bg-red-50 border-red-200',    emoji: '🔥' },
  warm:      { label: 'Warm',      color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', emoji: '☀️' },
  cold:      { label: 'Cold',      color: 'text-blue-700',  bg: 'bg-blue-50 border-blue-200',   emoji: '❄️' },
  converted: { label: 'Converted', color: 'text-brand-700', bg: 'bg-brand-50 border-brand-200', emoji: '✅' },
  dead:      { label: 'Dead',      color: 'text-gray-500',  bg: 'bg-gray-100 border-gray-200',  emoji: '💀' },
};

const CHANNEL_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  email:    { label: 'Email',    color: 'text-blue-600',   bg: 'bg-blue-50',   icon: Mail },
  sms:      { label: 'SMS',      color: 'text-violet-600', bg: 'bg-violet-50', icon: MessageSquare },
  whatsapp: { label: 'WhatsApp', color: 'text-green-600',  bg: 'bg-green-50',  icon: Phone },
  linkedin: { label: 'LinkedIn', color: 'text-sky-600',    bg: 'bg-sky-50',    icon: LinkedInIcon },
};

const MSG_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Draft',     color: 'text-gray-500' },
  scheduled: { label: 'Scheduled', color: 'text-amber-600' },
  sent:      { label: 'Sent',      color: 'text-blue-600' },
  delivered: { label: 'Delivered', color: 'text-brand-600' },
  failed:    { label: 'Failed',    color: 'text-red-600' },
  replied:   { label: 'Replied ✓', color: 'text-brand-700' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)    return 'just now';
  if (mins < 60)   return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days < 30)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, className = '' }: {
  title: string; icon: React.ElementType; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={`card overflow-hidden ${className}`}>
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 bg-gray-50/50">
        <Icon size={15} className="text-brand-500" />
        <h3 className="font-bold text-gray-800 text-sm">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, tenantId } = useAuth();

  const [contact,   setContact]   = useState<ContactDetail | null>(null);
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [followups, setFollowups] = useState<FollowupItem[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFollowup, setPreviewFollowup] = useState<FollowupItem | null>(null);
  const [previewInitialText, setPreviewInitialText] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [previewChannel, setPreviewChannel] = useState<'whatsapp' | 'email' | 'linkedin'>('whatsapp');
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [showOcr,   setShowOcr]   = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [showEdit,  setShowEdit]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [editForm,  setEditForm]  = useState({
    full_name: '', role: '', company: '', email: '',
    phone: '', website: '', linkedin: '', lead_status: 'warm', context_notes: '',
  });

  const supabase = createClient();

  // ── Fetch all data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!id || !user) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // 1. Contact
        const { data: c, error: cErr } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', id)
          .eq('created_by', user.id)
          .maybeSingle();

        if (cErr) throw cErr;
        if (!c) throw new Error('Contact not found');
        setContact(c);

        // 2. Messages
        const { data: msgs } = await supabase
          .from('messages')
          .select('id, channel, status, subject, body, ai_generated, sent_at, opened_at, replied_at, created_at')
          .eq('contact_id', id)
          .order('created_at', { ascending: false })
          .limit(20);
        setMessages(msgs ?? []);

        // 3. Follow-ups
        const { data: fups } = await supabase
          .from('followups')
          .select('id, channel, status, due_at, message_draft, subject_draft, step_number, notes')
          .eq('contact_id', id)
          .order('due_at', { ascending: true })
          .limit(10);
        setFollowups(fups ?? []);

      } catch (err: any) {
        setError(err.message || 'Failed to load contact');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, user]);

  // ── Delete contact ───────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!contact || !window.confirm(`Delete ${contact.full_name}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await supabase.from('contacts').delete().eq('id', contact.id);
      toast.success('Contact deleted');
      navigate('/contacts');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete');
      setDeleting(false);
    }
  };

  // ── Save edit ─────────────────────────────────────────────────────────────
  const openEdit = () => {
    if (!contact) return;
    setEditForm({
      full_name:     contact.full_name,
      role:          contact.role ?? '',
      company:       contact.ai_structured?.company ?? '',
      email:         contact.email ?? '',
      phone:         contact.phone ?? '',
      website:       contact.ai_structured?.website ?? '',
      linkedin:      contact.ai_structured?.linkedin ?? '',
      lead_status:   contact.lead_status,
      context_notes: contact.context_notes ?? '',
    });
    setShowEdit(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact || !editForm.full_name.trim()) {
      toast.error('Full name is required'); return;
    }
    setSaving(true);
    try {
      const updated = {
        full_name:     editForm.full_name.trim(),
        email:         editForm.email || null,
        phone:         editForm.phone || null,
        role:          editForm.role || null,
        lead_status:   editForm.lead_status,
        context_notes: editForm.context_notes || null,
        ai_structured: {
          ...contact.ai_structured,
          company:  editForm.company,
          website:  editForm.website,
          linkedin: editForm.linkedin,
        },
      };
      const { error: err } = await supabase.from('contacts').update(updated).eq('id', contact.id);
      if (err) throw err;
      setContact(c => c ? { ...c, ...updated } : c);
      setShowEdit(false);
      toast.success('Contact updated!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── Mark follow-up done ──────────────────────────────────────────────────
  const handleFollowupDone = async (fupId: string) => {
    await supabase.from('followups').update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', fupId);
    setFollowups(prev => prev.filter(f => f.id !== fupId));
    toast.success('Marked as done!');
  };

  // ── Execute follow-up (Send email, open whatsapp/linkedin) ───────────────
  const handleExecuteFollowup = (fup: FollowupItem) => {
    console.log('handleExecuteFollowup triggered. fup:', fup, 'contact:', contact);
    if (!contact) return;

    setPreviewFollowup(fup);
    setPreviewInitialText(fup.message_draft || '');
    setPreviewSubject(fup.subject_draft || 'Follow-up');
    setPreviewChannel(fup.channel as 'whatsapp' | 'email' | 'linkedin');
    setIsPreviewOpen(true);
  };

  const handleConfirmExecuteFollowup = async (editedText: string, editedSubject?: string) => {
    console.log('handleConfirmExecuteFollowup triggered. previewFollowup:', previewFollowup, 'contact:', contact);
    if (!previewFollowup || !contact) return;

    const fup = previewFollowup;
    const body = editedText;
    const subject = editedSubject || fup.subject_draft || 'Follow-up';

    if (fup.channel === 'whatsapp') {
      if (!contact.phone) {
        toast.error('Contact has no phone number');
        return;
      }
      const cleanPhone = contact.phone.replace(/\D/g, '');
      if (!cleanPhone) {
        toast.error('Invalid phone number format');
        return;
      }

      // Open WhatsApp click-to-chat
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(body)}`;
      const newWindow = window.open(waUrl, '_blank');
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        toast.error('Popup was blocked by your browser. Please allow popups for this site.');
      }

      // Increment count
      try {
        const count = contact.whatsapp_count || 0;
        await supabase
          .from('contacts')
          .update({ whatsapp_count: count + 1 })
          .eq('id', contact.id);
        setContact(prev => prev ? { ...prev, whatsapp_count: count + 1 } : null);
      } catch (e) {
        console.warn('Failed to increment WhatsApp count:', e);
      }

      // Log message
      try {
        await supabase.from('messages').insert({
          tenant_id: contact.tenant_id || user?.user_metadata?.tenant_id || user?.id,
          contact_id: contact.id,
          sent_by: user?.id,
          channel: 'whatsapp',
          status: 'sent',
          body,
          ai_generated: true,
          metadata: { sent_via: 'detail_page_execute' }
        });
        
        // Refresh message list
        const { data: msgs } = await supabase
          .from('messages')
          .select('id, channel, status, subject, body, ai_generated, sent_at, opened_at, replied_at, created_at')
          .eq('contact_id', contact.id)
          .order('created_at', { ascending: false })
          .limit(20);
        setMessages(msgs ?? []);
      } catch (e) {
        console.warn('Failed to log WhatsApp message:', e);
      }

      await handleFollowupDone(fup.id);

    } else if (fup.channel === 'email') {
      if (!contact.email) {
        toast.error('Contact has no email address');
        return;
      }

      const { error: invokeError } = await supabase.functions.invoke('send-communication', {
        body: {
          channel: 'email',
          to: contact.email,
          subject,
          body
        }
      });

      if (invokeError) {
        toast.error(invokeError.message || 'Failed to send email');
        throw new Error(invokeError.message || 'Failed to send email');
      }

      // Increment count
      try {
        const count = contact.email_count || 0;
        await supabase
          .from('contacts')
          .update({ email_count: count + 1 })
          .eq('id', contact.id);
        setContact(prev => prev ? { ...prev, email_count: count + 1 } : null);
      } catch (e) {
        console.warn('Failed to increment email count:', e);
      }

      // Log message
      try {
        await supabase.from('messages').insert({
          tenant_id: contact.tenant_id || user?.user_metadata?.tenant_id || user?.id,
          contact_id: contact.id,
          sent_by: user?.id,
          channel: 'email',
          status: 'sent',
          subject,
          body,
          ai_generated: true,
          metadata: { sent_via: 'detail_page_execute' }
        });

        // Refresh message list
        const { data: msgs } = await supabase
          .from('messages')
          .select('id, channel, status, subject, body, ai_generated, sent_at, opened_at, replied_at, created_at')
          .eq('contact_id', contact.id)
          .order('created_at', { ascending: false })
          .limit(20);
        setMessages(msgs ?? []);
      } catch (e) {
        console.warn('Failed to log email message:', e);
      }

      await handleFollowupDone(fup.id);
      toast.success('Email sent successfully!');

    } else if (fup.channel === 'linkedin') {
      const linkedin = contact.linkedin_url || contact.ai_structured?.linkedin;
      if (!linkedin) {
        toast.error('Contact has no LinkedIn URL');
        return;
      }

      const formattedUrl = linkedin.startsWith('http') ? linkedin : `https://${linkedin}`;
      const newWindow = window.open(formattedUrl, '_blank');
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        toast.error('Popup was blocked by your browser. Please allow popups for this site.');
      }

      // Log message
      try {
        await supabase.from('messages').insert({
          tenant_id: contact.tenant_id || user?.user_metadata?.tenant_id || user?.id,
          contact_id: contact.id,
          sent_by: user?.id,
          channel: 'linkedin',
          status: 'sent',
          body: 'LinkedIn profile opened for manual messaging',
          ai_generated: false,
          metadata: { sent_via: 'detail_page_execute' }
        });
        
        // Refresh message list
        const { data: msgs } = await supabase
          .from('messages')
          .select('id, channel, status, subject, body, ai_generated, sent_at, opened_at, replied_at, created_at')
          .eq('contact_id', contact.id)
          .order('created_at', { ascending: false })
          .limit(20);
        setMessages(msgs ?? []);
      } catch (e) {
        console.warn('Failed to log LinkedIn message:', e);
      }

      await handleFollowupDone(fup.id);
    }
  };

  // ── Direct Channel Actions (from header/sidebar buttons) ──────────────────
  const handleDirectChannelAction = async (channel: 'whatsapp' | 'linkedin') => {
    console.log('handleDirectChannelAction triggered. channel:', channel, 'contact:', contact);
    if (!contact) return;

    // Check if there is an existing pending follow-up for this channel
    const pendingFup = followups.find(f => f.channel === channel && f.status === 'pending');
    if (pendingFup) {
      handleExecuteFollowup(pendingFup);
      return;
    }

    // Otherwise, execute a direct send action
    if (channel === 'whatsapp') {
      if (!contact.phone) {
        toast.error('Contact has no phone number');
        return;
      }
      const cleanPhone = contact.phone.replace(/\D/g, '');
      if (!cleanPhone) {
        toast.error('Invalid phone number format');
        return;
      }

      const waUrl = `https://wa.me/${cleanPhone}`;
      const newWindow = window.open(waUrl, '_blank');
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        toast.error('Popup was blocked by your browser. Please allow popups for this site.');
      }

      // Increment count
      try {
        const count = contact.whatsapp_count || 0;
        await supabase
          .from('contacts')
          .update({ whatsapp_count: count + 1 })
          .eq('id', contact.id);
        setContact(prev => prev ? { ...prev, whatsapp_count: count + 1 } : null);
      } catch (e) {
        console.warn('Failed to increment WhatsApp count:', e);
      }

      // Log message
      try {
        await supabase.from('messages').insert({
          tenant_id: contact.tenant_id || user?.user_metadata?.tenant_id || user?.id,
          contact_id: contact.id,
          sent_by: user?.id,
          channel: 'whatsapp',
          status: 'sent',
          body: 'Direct WhatsApp message initiated',
          ai_generated: false,
          metadata: { sent_via: 'detail_page_direct' }
        });
        
        // Refresh message list
        const { data: msgs } = await supabase
          .from('messages')
          .select('id, channel, status, subject, body, ai_generated, sent_at, opened_at, replied_at, created_at')
          .eq('contact_id', contact.id)
          .order('created_at', { ascending: false })
          .limit(20);
        setMessages(msgs ?? []);
      } catch (e) {
        console.warn('Failed to log WhatsApp message:', e);
      }

      toast.success('WhatsApp opened!');

    } else if (channel === 'linkedin') {
      const linkedin = contact.linkedin_url || contact.ai_structured?.linkedin;
      if (!linkedin) {
        toast.error('Contact has no LinkedIn URL');
        return;
      }

      const formattedUrl = linkedin.startsWith('http') ? linkedin : `https://${linkedin}`;
      const newWindow = window.open(formattedUrl, '_blank');
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        toast.error('Popup was blocked by your browser. Please allow popups for this site.');
      }

      // Log message
      try {
        await supabase.from('messages').insert({
          tenant_id: contact.tenant_id || user?.user_metadata?.tenant_id || user?.id,
          contact_id: contact.id,
          sent_by: user?.id,
          channel: 'linkedin',
          status: 'sent',
          body: 'LinkedIn profile opened',
          ai_generated: false,
          metadata: { sent_via: 'detail_page_direct' }
        });
        
        // Refresh message list
        const { data: msgs } = await supabase
          .from('messages')
          .select('id, channel, status, subject, body, ai_generated, sent_at, opened_at, replied_at, created_at')
          .eq('contact_id', contact.id)
          .order('created_at', { ascending: false })
          .limit(20);
        setMessages(msgs ?? []);
      } catch (e) {
        console.warn('Failed to log LinkedIn message:', e);
      }

      toast.success('LinkedIn profile opened!');
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        <p className="text-sm text-gray-500">Loading contact profile…</p>
      </div>
    </div>
  );

  if (error || !contact) return (
    <div className="card p-10 flex flex-col items-center text-center gap-3">
      <AlertCircle size={32} className="text-red-400" />
      <h3 className="font-bold text-gray-900">Contact not found</h3>
      <p className="text-sm text-gray-500">{error}</p>
      <Link to="/contacts" className="btn-primary btn-sm mt-2">← Back to Contacts</Link>
    </div>
  );

  const statusCfg  = LEAD_STATUS_CONFIG[contact.lead_status] ?? LEAD_STATUS_CONFIG.cold;
  const initials   = getInitials(contact.full_name);
  const company    = contact.ai_structured?.company ?? '';
  const website    = contact.ai_structured?.website ?? '';
  const linkedin   = contact.ai_structured?.linkedin ?? '';
  const pendingFups = followups.filter(f => f.status === 'pending' || f.status === 'sent');

  // Lead score colour
  const scoreColor = (s: number) => s >= 70 ? 'bg-brand-400' : s >= 40 ? 'bg-amber-400' : 'bg-red-400';

  return (
    <div className="space-y-6 max-w-4xl mx-auto page-enter">

      {/* ── Back breadcrumb ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/contacts')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors">
          <ArrowLeft size={15} /> Contacts
        </button>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-semibold text-gray-900 truncate">{contact.full_name}</span>
      </div>

      {/* ── Hero Header ────────────────────────────────────────────────────── */}
      <div className="card p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">

          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600
              text-white flex items-center justify-center text-2xl font-black shadow-lg">
              {initials}
            </div>
            <span className={`absolute -bottom-1 -right-1 text-lg`}>{statusCfg.emoji}</span>
          </div>

          {/* Name block */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-start gap-3 mb-1">
              <h1 className="text-2xl font-black text-gray-900">{contact.full_name}</h1>
              <span className={`badge border text-xs font-bold px-3 py-1 ${statusCfg.bg} ${statusCfg.color}`}>
                {statusCfg.label}
              </span>
            </div>

            {(contact.role || company) && (
              <p className="text-gray-500 text-sm mb-3">
                {contact.role}{contact.role && company ? ' · ' : ''}{company}
              </p>
            )}

            {/* Tags */}
            {contact.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-4">
                {contact.tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 text-[11px] px-2.5 py-1
                    bg-gray-100 text-gray-600 rounded-full font-medium">
                    <Tag size={10} />{tag}
                  </span>
                ))}
              </div>
            )}

            {/* Stats row */}
            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Mail size={12} /> {contact.email_count} emails
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare size={12} /> {contact.whatsapp_count} WhatsApp
              </span>
              <span className="flex items-center gap-1">
                <Phone size={12} /> {contact.sms_count} SMS
              </span>
              <span className="flex items-center gap-1 text-gray-400">
                <Clock size={12} /> Added {timeAgo(contact.created_at)}
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="btn-primary btn-sm flex items-center gap-2">
                <Send size={13} /> Send Email
              </a>
            )}
            {contact.phone && (
              <button
                onClick={() => handleDirectChannelAction('whatsapp')}
                className="btn-secondary btn-sm flex items-center gap-2 text-green-600 hover:bg-green-50/50"
              >
                <Phone size={13} /> WhatsApp Chat
              </button>
            )}
            {(contact.linkedin_url || contact.ai_structured?.linkedin) && (
              <button
                onClick={() => handleDirectChannelAction('linkedin')}
                className="btn-secondary btn-sm flex items-center gap-2 text-sky-600 hover:bg-sky-50/50"
              >
                <LinkedInIcon size={13} /> LinkedIn Profile
              </button>
            )}
            <Link to={`/followups`} className="btn-secondary btn-sm flex items-center gap-2">
              <CalendarClock size={13} /> Schedule Follow-up
            </Link>
            <button onClick={openEdit}
              className="btn-ghost btn-sm flex items-center gap-2">
              <Edit3 size={13} /> Edit
            </button>
            <button onClick={handleDelete} disabled={deleting}
              className="btn-danger btn-sm flex items-center gap-2">
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* ── Main Grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left column — contact info + AI insights */}
        <div className="lg:col-span-1 space-y-5">

          {/* Contact Info */}
          <Section title="Contact Info" icon={User}>
            <div className="space-y-3">
              {contact.email && (
                <a href={`mailto:${contact.email}`}
                  className="flex items-center gap-3 text-sm text-gray-700 hover:text-brand-600 group">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Mail size={14} className="text-blue-500" />
                  </div>
                  <span className="truncate group-hover:underline">{contact.email}</span>
                </a>
              )}
              {contact.phone && (
                <a href={`tel:${contact.phone}`}
                  className="flex items-center gap-3 text-sm text-gray-700 hover:text-brand-600 group">
                  <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
                    <Phone size={14} className="text-green-500" />
                  </div>
                  <span className="truncate">{contact.phone}</span>
                </a>
              )}
              {company && (
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                    <Building2 size={14} className="text-gray-400" />
                  </div>
                  <span className="truncate">{company}</span>
                </div>
              )}
              {contact.role && (
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                    <Briefcase size={14} className="text-gray-400" />
                  </div>
                  <span className="truncate">{contact.role}</span>
                </div>
              )}
              {website && (
                <a href={website.startsWith('http') ? website : `https://${website}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-gray-700 hover:text-brand-600 group">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center shrink-0">
                    <Globe size={14} className="text-gray-400" />
                  </div>
                  <span className="truncate group-hover:underline">{website}</span>
                  <ExternalLink size={11} className="text-gray-300 shrink-0" />
                </a>
              )}
              {linkedin && (
                <a href={linkedin.startsWith('http') ? linkedin : `https://${linkedin}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-gray-700 hover:text-sky-600 group">
                  <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center shrink-0">
                    <LinkedInIcon className="text-sky-500" />
                  </div>
                  <span className="truncate group-hover:underline">LinkedIn Profile</span>
                  <ExternalLink size={11} className="text-gray-300 shrink-0" />
                </a>
              )}
              {!contact.email && !contact.phone && !company && !contact.role && (
                <p className="text-sm text-gray-400 italic">No contact details captured</p>
              )}
            </div>
          </Section>

          {/* Where Met */}
          {(contact.met_at_event || contact.met_at_date || contact.met_at_location || contact.context_notes) && (
            <Section title="Where We Met" icon={MapPin}>
              <div className="space-y-2.5 text-sm text-gray-700">
                {contact.met_at_event && (
                  <div className="flex items-center gap-2">
                    <Star size={13} className="text-amber-400 shrink-0" />
                    <span className="font-medium">{contact.met_at_event}</span>
                  </div>
                )}
                {contact.met_at_date && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Calendar size={13} className="shrink-0" />
                    {formatDate(contact.met_at_date)}
                  </div>
                )}
                {contact.met_at_location && (
                  <div className="flex items-center gap-2 text-gray-500">
                    <MapPin size={13} className="shrink-0" />
                    {contact.met_at_location}
                  </div>
                )}
                {contact.context_notes && (
                  <p className="text-gray-600 italic text-xs leading-relaxed border-t border-gray-50 pt-2.5 mt-2.5">
                    "{contact.context_notes}"
                  </p>
                )}
              </div>
            </Section>
          )}

          {/* AI Insights */}
          <Section title="AI Insights" icon={Sparkles}>
            <div className="space-y-4">
              {/* Lead Score */}
              {contact.lead_score !== null && (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-gray-600 flex items-center gap-1">
                      <TrendingUp size={12} /> Lead Score
                    </span>
                    <span className="font-black text-gray-900">{contact.lead_score}/100</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${scoreColor(contact.lead_score)}`}
                      style={{ width: `${contact.lead_score}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Opportunity Type */}
              {contact.opportunity_type && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500">Opportunity:</span>
                  <span className="badge bg-brand-50 text-brand-700 text-xs">{contact.opportunity_type}</span>
                </div>
              )}

              {/* Relationship Stage */}
              {contact.relationship_stage && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-500">Stage:</span>
                  <span className="badge bg-gray-100 text-gray-600 text-xs capitalize">{contact.relationship_stage}</span>
                </div>
              )}

              {/* AI Notes */}
              {contact.ai_notes && (
                <div className="bg-brand-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-brand-700 mb-1.5 flex items-center gap-1">
                    <Sparkles size={11} /> AI Notes
                  </p>
                  <p className="text-xs text-brand-900 leading-relaxed">{contact.ai_notes}</p>
                </div>
              )}

              {/* Last interaction summary */}
              {contact.last_interaction_summary && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Last Interaction</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{contact.last_interaction_summary}</p>
                </div>
              )}

              {!contact.lead_score && !contact.ai_notes && !contact.opportunity_type && (
                <p className="text-sm text-gray-400 italic">No AI insights yet</p>
              )}
            </div>
          </Section>

          {/* Business Card Image */}
          {contact.card_image_url && (
            <Section title="Business Card" icon={ImageIcon}>
              <img
                src={contact.card_image_url}
                alt="Business card"
                className="w-full rounded-xl border border-gray-100 shadow-sm object-contain max-h-48"
              />
              {contact.raw_ocr_text && (
                <div className="mt-3">
                  <button
                    onClick={() => setShowOcr(o => !o)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700"
                  >
                    <FileText size={12} />
                    Raw OCR Text
                    {showOcr ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                  {showOcr && (
                    <pre className="mt-2 bg-gray-50 rounded-lg p-3 text-[10px] text-gray-600
                      font-mono whitespace-pre-wrap max-h-32 overflow-y-auto border border-gray-100">
                      {contact.raw_ocr_text}
                    </pre>
                  )}
                </div>
              )}
            </Section>
          )}
        </div>

        {/* Right column — messages + follow-ups */}
        <div className="lg:col-span-2 space-y-5">

          {/* Pending Follow-ups */}
          {pendingFups.length > 0 && (
            <Section title={`Scheduled Follow-ups (${pendingFups.length})`} icon={CalendarClock}>
              <div className="space-y-3">
                {pendingFups.map(fup => {
                  const chCfg = CHANNEL_CONFIG[fup.channel] ?? CHANNEL_CONFIG.email;
                  const ChIcon = chCfg.icon;
                  const due = new Date(fup.due_at);
                  const isOverdue = due < new Date();
                  return (
                    <div key={fup.id} className={`flex items-start gap-3 p-3 rounded-xl border
                      ${isOverdue ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                      <div className={`w-8 h-8 rounded-lg ${chCfg.bg} flex items-center justify-center shrink-0`}>
                        <ChIcon size={14} className={chCfg.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-gray-700">Step {fup.step_number} · {chCfg.label}</span>
                          {isOverdue && (
                            <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">OVERDUE</span>
                          )}
                        </div>
                        <p className={`text-xs mt-0.5 flex items-center gap-1 ${isOverdue ? 'text-red-600' : 'text-gray-500'}`}>
                          <Clock size={10} />
                          {due.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                          {' · '}{due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {fup.message_draft && (
                          <p className="text-xs text-gray-500 mt-1 truncate italic">"{fup.message_draft}"</p>
                        )}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => handleExecuteFollowup(fup)}
                          className="btn-primary btn-sm flex items-center gap-1 text-[11px]"
                        >
                          {fup.channel === 'whatsapp' ? (
                            <>
                              <Phone size={12} /> Send WhatsApp
                            </>
                          ) : fup.channel === 'linkedin' ? (
                            <>
                              <LinkedInIcon size={12} /> Open LinkedIn
                            </>
                          ) : (
                            <>
                              <Send size={12} /> Send Email
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleFollowupDone(fup.id)}
                          className="btn-secondary btn-sm flex items-center gap-1 text-[11px]"
                          title="Mark done without sending"
                        >
                          <CheckCircle2 size={12} /> Done
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Section>
          )}

          {/* Message History */}
          <Section title={`Message History (${messages.length})`} icon={Mail}>
            {messages.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
                  <Mail size={20} className="text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-500">No messages sent yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Go to{' '}
                  <Link to="/contacts" className="text-brand-600 hover:underline">Contacts</Link>
                  {' '}to compose a follow-up.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map(msg => {
                  const chCfg = CHANNEL_CONFIG[msg.channel] ?? CHANNEL_CONFIG.email;
                  const stCfg = MSG_STATUS_CONFIG[msg.status] ?? { label: msg.status, color: 'text-gray-500' };
                  const ChIcon = chCfg.icon;
                  return (
                    <div key={msg.id} className="flex gap-3">
                      {/* Timeline dot */}
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-lg ${chCfg.bg} flex items-center justify-center shrink-0`}>
                          <ChIcon size={14} className={chCfg.color} />
                        </div>
                        <div className="w-px flex-1 bg-gray-100 mt-2" />
                      </div>

                      <div className="flex-1 pb-4 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-bold text-gray-700">{chCfg.label}</span>
                          <span className={`text-[10px] font-semibold ${stCfg.color}`}>{stCfg.label}</span>
                          {msg.ai_generated && (
                            <span className="text-[10px] bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-0.5">
                              <Sparkles size={9} /> AI
                            </span>
                          )}
                          <span className="text-[10px] text-gray-400 ml-auto">
                            {timeAgo(msg.sent_at ?? msg.created_at)}
                          </span>
                        </div>

                        {msg.subject && (
                          <p className="text-xs font-semibold text-gray-700 mb-1">{msg.subject}</p>
                        )}
                        <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">{msg.body}</p>

                        {/* Tracking pills */}
                        <div className="flex gap-2 mt-2">
                          {msg.opened_at && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                              Opened {timeAgo(msg.opened_at)}
                            </span>
                          )}
                          {msg.replied_at && (
                            <span className="text-[10px] bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full font-medium">
                              Replied {timeAgo(msg.replied_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Section>
        </div>
      </div>
      {/* ── Edit Modal ───────────────────────────────────────────────────── */}
      {showEdit && contact && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowEdit(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-fade-in">

            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Edit Contact</h2>
              <button onClick={() => setShowEdit(false)} className="text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 input-group">
                  <label className="input-label">Full Name *</label>
                  <input className="input" required value={editForm.full_name}
                    onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Job Title</label>
                  <input className="input" value={editForm.role}
                    onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Company</label>
                  <input className="input" value={editForm.company}
                    onChange={e => setEditForm(f => ({ ...f, company: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Email</label>
                  <input className="input" type="email" value={editForm.email}
                    onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Phone</label>
                  <input className="input" type="tel" value={editForm.phone}
                    onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">Website</label>
                  <input className="input" value={editForm.website}
                    onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">LinkedIn URL</label>
                  <input className="input" value={editForm.linkedin}
                    onChange={e => setEditForm(f => ({ ...f, linkedin: e.target.value }))} />
                </div>
                <div className="col-span-2 input-group">
                  <label className="input-label">Lead Status</label>
                  <div className="grid grid-cols-5 gap-2">
                    {(['hot','warm','cold','converted','dead'] as const).map(s => {
                      const cfg = LEAD_STATUS_CONFIG[s];
                      return (
                        <button key={s} type="button"
                          onClick={() => setEditForm(f => ({ ...f, lead_status: s }))}
                          className={`py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer
                            ${ editForm.lead_status === s
                              ? `${cfg.bg} ${cfg.color} border-current`
                              : 'bg-white text-gray-400 border-gray-200 hover:bg-gray-50'}`}>
                          {cfg.emoji} {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="col-span-2 input-group">
                  <label className="input-label">Context Notes</label>
                  <textarea className="input resize-none" rows={3} value={editForm.context_notes}
                    onChange={e => setEditForm(f => ({ ...f, context_notes: e.target.value }))} />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEdit(false)}
                  className="btn-secondary flex-1">Cancel</button>
                <button type="submit" disabled={saving}
                  className="btn-primary flex-1 flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : null}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {previewFollowup && (
        <MessageSendPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => {
            setIsPreviewOpen(false);
            setPreviewFollowup(null);
          }}
          onConfirm={handleConfirmExecuteFollowup}
          channel={previewChannel}
          contactName={contact?.full_name || 'Unknown Contact'}
          initialMessageText={previewInitialText}
          initialEmailSubject={previewSubject}
        />
      )}
    </div>
  );
}

export default ContactDetailPage;
