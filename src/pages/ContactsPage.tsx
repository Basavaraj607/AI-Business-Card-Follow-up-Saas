// pages/ContactsPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '../lib/supabase/client';
import { useAuth } from '../lib/auth-context';
import { 
  Plus, Search, Calendar, Mail, Phone, Building, Briefcase, 
  Trash2, Eye, X, Image as ImageIcon, FileText, Send, Sparkles, AlertCircle,
  Loader2, MessageSquare
} from 'lucide-react';
import toast from 'react-hot-toast';
import { notifications } from '../services/notifications';
import { analytics } from '../services/posthog';
import { inngest } from '../services/inngest';

const Linkedin = (props: any) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

interface ContactRecord {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  card_image_url: string | null;
  raw_ocr_text: string | null;
  ai_structured: any;
  context_notes: string | null;
  lead_status: 'hot' | 'warm' | 'cold' | 'converted' | 'dead';
  met_at_date: string | null;
  tags: string[];
}

export function ContactsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedContact, setSelectedContact] = useState<ContactRecord | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState<{
    fullName: string;
    role: string;
    company: string;
    email: string;
    phone: string;
    website: string;
    linkedin: string;
    leadStatus: 'hot' | 'warm' | 'cold' | 'converted' | 'dead';
    contextNotes: string;
  }>({
    fullName: '',
    role: '',
    company: '',
    email: '',
    phone: '',
    website: '',
    linkedin: '',
    leadStatus: 'warm',
    contextNotes: ''
  });

  const handleSelectContact = (contact: ContactRecord) => {
    setSelectedContact(contact);
    setFollowupDraft('');
    setCustomContext('');
    setEditorMode('preview');
    setIsEditing(false);
    setEditForm({
      fullName: contact.full_name || '',
      role: contact.role || '',
      company: contact.ai_structured?.company || '',
      email: contact.email || '',
      phone: contact.phone || '',
      website: contact.ai_structured?.website || '',
      linkedin: contact.linkedin_url || contact.ai_structured?.linkedin || '',
      leadStatus: contact.lead_status || 'warm',
      contextNotes: contact.context_notes || ''
    });
  };

  const handleSaveContact = async () => {
    if (!selectedContact) return;
    if (!editForm.fullName || !editForm.fullName.trim()) {
      toast.error('Full Name is required');
      return;
    }

    setSavingEdit(true);
    const supabase = createClient();
    try {
      const updatedData = {
        full_name: editForm.fullName,
        email: editForm.email || null,
        phone: editForm.phone || null,
        role: editForm.role || null,
        lead_status: editForm.leadStatus,
        context_notes: editForm.contextNotes || null,
        linkedin_url: editForm.linkedin || null,
        ai_structured: {
          ...selectedContact.ai_structured,
          name: editForm.fullName,
          email: editForm.email,
          phone: editForm.phone,
          company: editForm.company,
          title: editForm.role,
          website: editForm.website,
          linkedin: editForm.linkedin
        }
      };

      const { error } = await supabase
        .from('contacts')
        .update(updatedData)
        .eq('id', selectedContact.id);

      if (error) throw error;

      // Update local state
      const updatedContact: ContactRecord = {
        ...selectedContact,
        full_name: editForm.fullName,
        email: editForm.email || null,
        phone: editForm.phone || null,
        role: editForm.role || null,
        lead_status: editForm.leadStatus,
        context_notes: editForm.contextNotes || null,
        linkedin_url: editForm.linkedin || null,
        ai_structured: updatedData.ai_structured
      };

      setContacts(prev => prev.map(c => c.id === selectedContact.id ? updatedContact : c));
      setSelectedContact(updatedContact);
      setIsEditing(false);
      toast.success('Contact updated successfully!');

    } catch (err: any) {
      console.error('Failed to update contact in database:', err);
      toast.error(`Database Error: ${err?.message || err || 'Failed to update contact'}`);
    } finally {
      setSavingEdit(false);
    }
  };

  // Follow-up generator state
  const [generatingFollowup, setGeneratingFollowup] = useState(false);
  const [followupDraft, setFollowupDraft] = useState('');
  const [followupTone, setFollowupTone] = useState<number>(3); // 1-5 (Casual, Friendly, Professional, Formal, Direct)
  const [followupObjective, setFollowupObjective] = useState<string>('book_meeting');
  const [followupLength, setFollowupLength] = useState<number>(2); // 1-3 (Short, Medium, Long)
  const [customContext, setCustomContext] = useState<string>('');
  const [editorMode, setEditorMode] = useState<'preview' | 'edit'>('preview');

  const getToneLabel = (val: number) => {
    switch (val) {
      case 1: return 'Casual';
      case 2: return 'Friendly';
      case 3: return 'Professional';
      case 4: return 'Formal';
      case 5: return 'Direct';
      default: return 'Professional';
    }
  };

  const getLengthLabel = (val: number) => {
    switch (val) {
      case 1: return 'Short';
      case 2: return 'Medium';
      case 3: return 'Long';
      default: return 'Medium';
    }
  };

  const getObjectiveLabel = (val: string) => {
    switch (val) {
      case 'book_meeting': return 'Book a meeting';
      case 'send_proposal': return 'Send proposal';
      case 'say_thanks': return 'Say thank you';
      case 'general_followup': return 'General follow-up';
      default: return 'Book a meeting';
    }
  };

  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const highlightDraft = (text: string, contact: ContactRecord) => {
    if (!text) return '';
    let escaped = escapeHtml(text);
    
    const company = contact.ai_structured?.company || '';
    const fullName = contact.full_name || '';
    const firstName = fullName.split(' ')[0] || '';
    const role = contact.role || '';
    const senderName = user?.user_metadata?.full_name || '';
    const senderCompany = user?.user_metadata?.company_name || '';
    
    const items: { term: string; className: string; label: string }[] = [];
    
    if (fullName && fullName.trim().length > 2) {
      items.push({ term: fullName.trim(), className: 'bg-green-100 text-green-800 px-1 rounded font-semibold', label: 'Name' });
    }
    if (firstName && firstName.trim().length > 2 && firstName !== fullName) {
      items.push({ term: firstName.trim(), className: 'bg-green-100 text-green-800 px-1 rounded font-semibold', label: 'First Name' });
    }
    if (company && company.trim().length > 2) {
      items.push({ term: company.trim(), className: 'bg-amber-100 text-amber-800 px-1 rounded font-semibold', label: 'Company' });
    }
    if (role && role.trim().length > 2) {
      items.push({ term: role.trim(), className: 'bg-blue-100 text-blue-800 px-1 rounded font-semibold', label: 'Role' });
    }
    if (senderName && senderName.trim().length > 2) {
      items.push({ term: senderName.trim(), className: 'bg-purple-100 text-purple-800 px-1 rounded font-semibold', label: 'Sender' });
    }
    if (senderCompany && senderCompany.trim().length > 2 && senderCompany !== company) {
      items.push({ term: senderCompany.trim(), className: 'bg-purple-100 text-purple-800 px-1 rounded font-semibold', label: 'My Company' });
    }

    if (customContext && customContext.trim().length > 2) {
      const words = customContext.split(/[\s,.:;!?]+/)
        .map(w => w.trim())
        .filter(w => w.length > 4 && !['about', 'their', 'there', 'would', 'could', 'should', 'mention', 'conversation', 'product'].includes(w.toLowerCase()));
      
      words.forEach(word => {
        if (!items.some(item => item.term.toLowerCase() === word.toLowerCase())) {
          items.push({ term: word, className: 'bg-rose-100 text-rose-800 px-1 rounded font-semibold', label: 'Context' });
        }
      });
    }

    items.sort((a, b) => b.term.length - a.term.length);

    const placeholders: { [key: string]: string } = {};
    
    items.forEach((item, index) => {
      const termEscaped = escapeHtml(item.term);
      const regexTerm = termEscaped.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`(${regexTerm})`, 'gi');
      
      escaped = escaped.replace(regex, (match) => {
        const placeholderKey = `__HP_${index}__`;
        placeholders[placeholderKey] = `<span class="${item.className}" title="${item.label}">${match}</span>`;
        return placeholderKey;
      });
    });

    Object.keys(placeholders).forEach(key => {
      escaped = escaped.replaceAll(key, placeholders[key]);
    });

    return escaped;
  };

  const fetchContacts = async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContacts(data || []);
    } catch (err: any) {
      console.error('Supabase fetch failed:', err);
      toast.error('Database Error: Failed to fetch contacts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [user]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this contact?')) return;
    
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Contact deleted');
      setContacts(prev => prev.filter(c => c.id !== id));
      if (selectedContact?.id === id) {
        setSelectedContact(null);
      }
      
    } catch (err: any) {
      console.error('Supabase delete failed:', err);
      toast.error(`Database Error: ${err?.message || err || 'Failed to delete contact'}`);
    }
  };

  // Followup generator utilizing Gemini LLM or local template fallbacks with registered user's custom details
  const generateFollowupDraft = async (
    contact: ContactRecord, 
    toneVal?: number, 
    objVal?: string, 
    lenVal?: number, 
    contextVal?: string
  ) => {
    setGeneratingFollowup(true);
    
    const currentTone = toneVal !== undefined ? toneVal : followupTone;
    const currentObjective = objVal !== undefined ? objVal : followupObjective;
    const currentLength = lenVal !== undefined ? lenVal : followupLength;
    const currentContext = contextVal !== undefined ? contextVal : customContext;

    const senderName = user?.user_metadata?.full_name || 'User';
    const senderPhone = user?.user_metadata?.phone || user?.phone || '';
    const senderCompany = user?.user_metadata?.company_name || '';
    const sign = `${senderName}${senderCompany ? '\n' + senderCompany : ''}${senderPhone ? '\n' + senderPhone : ''}`;

    const key = localStorage.getItem('gemini_api_key') || '';
    const supabase = createClient();
    try {
      const systemPrompt = `You are a professional relationship assistant. Write a follow-up email that sounds authentic, not AI-generated. Do not use generic filler phrases like "Hope this email finds you well" or "I am writing to...".`;
      
      const toneLabel = getToneLabel(currentTone);
      const lengthLabel = getLengthLabel(currentLength);
      const objectiveLabel = getObjectiveLabel(currentObjective);
      
      const userPrompt = `Write a follow-up email to my contact with the following specifications:
- Tone: ${toneLabel}
- Objective: ${objectiveLabel}
- Length: ${lengthLabel}
${currentContext ? `- Custom Context: ${currentContext}` : ''}

Contact Information:
- Contact Name: ${contact.full_name}
- Job Title: ${contact.role || 'N/A'}
- Company: ${contact.ai_structured?.company || 'N/A'}
- Met Date: ${contact.met_at_date || 'recently'}
- Original meeting context notes: ${contact.context_notes || 'N/A'}

My Information:
- Sender Name: ${senderName}
- Sender Phone: ${senderPhone}
- Sender Company: ${senderCompany}

Please include a subject line (starting with "Subject: ...") at the top of the email, followed by the email body. Format with clean spacing.`;

      const { data, error } = await supabase.functions.invoke('extract', {
        body: {
          action: 'generate-followup',
          systemPrompt,
          userPrompt,
          geminiApiKey: key
        }
      });

      if (error) {
        throw error;
      }

      if (data && data.text) {
        setFollowupDraft(data.text.trim());
        setGeneratingFollowup(false);
        return;
      }
    } catch (err) {
      console.warn('Gemini follow-up generation failed, using local template:', err);
    }

    // Fallback template matching
    setTimeout(() => {
      const name = contact.full_name.split(' ')[0];
      const company = contact.ai_structured?.company || 'your company';
      
      let subject = '';
      let greeting = '';
      let bodyText = '';
      let cta = '';
      
      // 1. Build Greeting based on tone
      if (currentTone >= 4) {
        greeting = `Dear ${contact.full_name || name},`;
      } else {
        greeting = `Hi ${name},`;
      }

      // 2. Build Subject Line and CTA based on Objective
      if (currentObjective === 'book_meeting') {
        subject = `Meeting follow-up - Let's connect`;
        cta = `Would you have 15 minutes to spare next week for a brief call? I'd love to learn more about your work at ${company} and discuss how we might collaborate.`;
      } else if (currentObjective === 'send_proposal') {
        subject = `Proposal presentation details for ${company}`;
        cta = `I have compiled a customized draft proposal for your review. Let me know if you would like me to walk you through it on a quick zoom call.`;
      } else if (currentObjective === 'say_thanks') {
        subject = `Great connecting with you!`;
        cta = `Just wanted to say a sincere thank you for sharing your time and insights. Let's make sure to stay in touch!`;
      } else {
        subject = `Connecting following our conversation`;
        cta = `Let's keep the conversation going. I'll reach out again soon, or feel free to ping me if you have any questions!`;
      }

      if (currentTone === 1) {
        subject = `Hey! Great connecting 👋`;
      }

      // 3. Build main body using meeting context and custom context
      let contextPart = '';
      if (currentContext) {
        contextPart = `Following up on our talk about ${currentContext}.`;
      } else if (contact.context_notes) {
        contextPart = `It was great speaking about "${contact.context_notes}" when we met.`;
      } else {
        contextPart = `It was great connecting with you recently.`;
      }

      // Adjust body details based on length and tone
      let detailsPart = '';
      if (currentLength === 1) { // Short
        detailsPart = `I really enjoyed our conversation.`;
        bodyText = `${greeting}\n\n${contextPart} ${detailsPart}\n\n${cta}\n\nBest regards,\n${sign}`;
      } else if (currentLength === 2) { // Medium
        detailsPart = `I found your insights regarding the industry developments at ${company} highly intriguing, and it aligns closely with what we're working on.`;
        bodyText = `${greeting}\n\n${contextPart}\n\n${detailsPart}\n\n${cta}\n\nWarm regards,\n${sign}`;
      } else { // Long
        detailsPart = `I've been thinking more about our conversation. The projects you are spearheading at ${company} are impressive. At my end, we focus on building robust solutions that maximize productivity and streamline workflows, which is why I was excited to connect with you.`;
        bodyText = `${greeting}\n\n${contextPart}\n\n${detailsPart}\n\n${cta}\n\nBest wishes,\n${sign}`;
      }

      const message = `Subject: ${subject}\n\n${bodyText}`;
      setFollowupDraft(message);
      setGeneratingFollowup(false);
    }, 600);
  };

  const filteredContacts = contacts.filter(contact => {
    const searchString = `${contact.full_name} ${contact.email || ''} ${contact.phone || ''} ${contact.role || ''} ${contact.ai_structured?.company || ''} ${contact.context_notes || ''}`.toLowerCase();
    const matchesSearch = searchString.includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || contact.lead_status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'hot': return 'badge-hot';
      case 'warm': return 'badge-warm';
      case 'cold': return 'badge-cold';
      default: return 'badge-gray';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scanned Contacts</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage your extracted leads and follow-ups</p>
        </div>
        <button onClick={() => navigate('/contacts/upload')} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Scan New Card
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex items-center gap-2.5 w-full sm:w-80 px-3 py-2 bg-white border border-gray-200 rounded-md focus-within:ring-2 focus-within:ring-brand-400/30 focus-within:border-brand-400 transition-all duration-150 shadow-sm">
          <Search size={16} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, company, email..."
            className="w-full text-sm bg-transparent border-0 p-0 focus:ring-0 focus:outline-none placeholder:text-gray-400 font-medium"
          />
        </div>

        <div className="flex gap-1.5 bg-gray-100 p-1 rounded-lg w-full sm:w-auto">
          {['all', 'hot', 'warm', 'cold'].map(filter => (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`flex-1 sm:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-md transition-all capitalize cursor-pointer
                ${statusFilter === filter 
                  ? 'bg-white text-gray-900 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-800'}`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Content Layout */}
      {loading ? (
        <div className="card p-16 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-sm text-gray-500">Loading contacts database...</p>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="card p-16 flex flex-col items-center justify-center text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center mb-4">
            <Search size={28} />
          </div>
          <h3 className="font-semibold text-gray-900 text-base mb-1">No contacts found</h3>
          <p className="text-xs text-gray-500 mb-6">
            {searchQuery || statusFilter !== 'all' 
              ? 'Try modifying your filters or search terms.' 
              : 'Scan your first business card to start building your CRM database.'}
          </p>
          <button onClick={() => navigate('/contacts/upload')} className="btn-primary btn-sm flex items-center gap-1.5">
            <Plus size={14} />
            Scan First Card
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredContacts.map(contact => {
            const company = contact.ai_structured?.company || '';
            const initials = contact.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

            return (
              <div 
                key={contact.id} 
                onClick={() => navigate(`/contacts/${contact.id}`)}
                className="card p-5 cursor-pointer card-hover border-gray-100 flex flex-col justify-between min-h-[190px] relative overflow-hidden group"
              >
                {/* Status Indicator Stripe */}
                <div className={`absolute top-0 left-0 right-0 h-1 
                  ${contact.lead_status === 'hot' ? 'bg-red-400' : ''}
                  ${contact.lead_status === 'warm' ? 'bg-amber-400' : ''}
                  ${contact.lead_status === 'cold' ? 'bg-blue-400' : ''}
                `} />

                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-sm">
                        {initials}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-sm group-hover:text-brand-600 transition-colors">{contact.full_name}</h4>
                        <p className="text-xs text-gray-500 font-medium">{contact.role || 'No title'}</p>
                      </div>
                    </div>
                    <span className={`badge ${getStatusBadge(contact.lead_status)} capitalize`}>
                      {contact.lead_status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-gray-500 mb-4">
                    {company && (
                      <div className="flex items-center gap-2">
                        <Building size={12} className="text-gray-400 shrink-0" />
                        <span className="truncate">{company}</span>
                      </div>
                    )}
                    {contact.email && (
                      <div className="flex items-center gap-2">
                        <Mail size={12} className="text-gray-400 shrink-0" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    )}
                    {contact.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={12} className="text-gray-400 shrink-0" />
                        <span>{contact.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-400">
                  <div className="flex items-center gap-1">
                    <Calendar size={11} />
                    <span>Scanned {contact.met_at_date || 'recently'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      className="p-1 rounded-md text-gray-400 hover:text-brand-600 hover:bg-brand-50"
                      onClick={(e) => { e.stopPropagation(); navigate(`/contacts/${contact.id}`); }}
                      title="View Profile"
                    >
                      <Eye size={14} />
                    </button>
                    <button 
                      className="p-1 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50"
                      onClick={(e) => handleDelete(contact.id, e)}
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Side Slide-Over Inspection Drawer */}
      {selectedContact && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedContact(null)} />
          
          <aside className="relative flex flex-col w-full max-w-xl bg-white h-full shadow-2xl p-6 overflow-y-auto animate-fade-in-right z-10 space-y-6">
            
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-800 flex items-center justify-center font-bold text-sm">
                  {selectedContact.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-base">{selectedContact.full_name}</h2>
                  <p className="text-xs text-gray-500 font-medium">{selectedContact.role || 'No title'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button 
                      onClick={handleSaveContact} 
                      disabled={savingEdit}
                      className="btn-primary btn-sm flex items-center gap-1 font-semibold"
                    >
                      {savingEdit ? 'Saving...' : 'Save'}
                    </button>
                    <button 
                      onClick={() => setIsEditing(false)} 
                      className="btn-secondary btn-sm font-semibold"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button 
                    onClick={() => setIsEditing(true)} 
                    className="btn-secondary btn-sm flex items-center gap-1 font-semibold"
                  >
                    Edit
                  </button>
                )}
                <button onClick={() => setSelectedContact(null)} className="p-1 rounded-md hover:bg-gray-100">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Main Inspection Sections */}
            <div className="space-y-6 flex-1">
              {/* Image Preview */}
              {selectedContact.card_image_url ? (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1.5">
                    <ImageIcon size={12} />
                    Business Card Capture
                  </h4>
                  <div className="border border-gray-100 rounded-xl overflow-hidden p-2 bg-gray-50 max-h-[200px] flex items-center justify-center">
                    <img 
                      src={selectedContact.card_image_url} 
                      alt="Business Card" 
                      className="max-w-full max-h-[180px] object-contain rounded-lg hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center gap-2 text-xs text-gray-400">
                  <ImageIcon size={16} />
                  <span>No business card photo uploaded.</span>
                </div>
              )}

              {isEditing ? (
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase">Edit Contact Information</h4>
                  
                  <div className="grid grid-cols-1 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Full Name</label>
                      <input 
                        type="text" 
                        value={editForm.fullName}
                        onChange={e => setEditForm(prev => ({ ...prev, fullName: e.target.value }))}
                        className="input"
                        placeholder="e.g. John Doe"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Job Title</label>
                        <input 
                          type="text" 
                          value={editForm.role}
                          onChange={e => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                          className="input"
                          placeholder="e.g. CEO"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Company</label>
                        <input 
                          type="text" 
                          value={editForm.company}
                          onChange={e => setEditForm(prev => ({ ...prev, company: e.target.value }))}
                          className="input"
                          placeholder="e.g. Acme Corp"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Email Address</label>
                        <input 
                          type="email" 
                          value={editForm.email}
                          onChange={e => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                          className="input"
                          placeholder="e.g. name@domain.com"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Phone Number</label>
                        <input 
                          type="text" 
                          value={editForm.phone}
                          onChange={e => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                          className="input"
                          placeholder="e.g. (123) 456-7890"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Website</label>
                        <input 
                          type="text" 
                          value={editForm.website}
                          onChange={e => setEditForm(prev => ({ ...prev, website: e.target.value }))}
                          className="input"
                          placeholder="e.g. domain.com"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">LinkedIn URL</label>
                        <input 
                          type="text" 
                          value={editForm.linkedin}
                          onChange={e => setEditForm(prev => ({ ...prev, linkedin: e.target.value }))}
                          className="input"
                          placeholder="e.g. linkedin.com/in/username"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Lead Status</label>
                      <select 
                        value={editForm.leadStatus}
                        onChange={e => setEditForm(prev => ({ ...prev, leadStatus: e.target.value as any }))}
                        className="input"
                      >
                        <option value="hot">Hot 🔥</option>
                        <option value="warm">Warm ☀️</option>
                        <option value="cold">Cold ❄️</option>
                        <option value="converted">Converted 🤝</option>
                        <option value="dead">Dead 🪦</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Context Notes (Where/when you met)</label>
                      <textarea 
                        value={editForm.contextNotes}
                        onChange={e => setEditForm(prev => ({ ...prev, contextNotes: e.target.value }))}
                        className="input font-medium"
                        rows={3}
                        placeholder="e.g. Met at TechConf 2026, interested in workflow automation."
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={handleSaveContact} 
                      disabled={savingEdit}
                      className="flex-1 btn-primary py-2.5 flex items-center justify-center gap-1.5 shadow-sm hover:shadow font-semibold"
                    >
                      {savingEdit ? 'Saving Changes...' : 'Save Changes'}
                    </button>
                    <button 
                      onClick={() => setIsEditing(false)} 
                      className="btn-secondary px-4 py-2.5 font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* CRM Info Grid */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase">Contact Credentials</h4>
                    <div className="card p-4 space-y-3 bg-gray-50/50">
                      <div className="grid grid-cols-3 text-xs py-1 border-b border-gray-100">
                        <span className="text-gray-400">Company</span>
                        <span className="col-span-2 font-semibold text-gray-800">{selectedContact.ai_structured?.company || '—'}</span>
                      </div>
                      <div className="grid grid-cols-3 text-xs py-1 border-b border-gray-100">
                        <span className="text-gray-400">Email</span>
                        <span className="col-span-2 text-gray-800 font-medium">{selectedContact.email || '—'}</span>
                      </div>
                      <div className="grid grid-cols-3 text-xs py-1 border-b border-gray-100">
                        <span className="text-gray-400">Phone</span>
                        <span className="col-span-2 text-gray-800 font-medium">{selectedContact.phone || '—'}</span>
                      </div>
                      <div className="grid grid-cols-3 text-xs py-1 border-b border-gray-100">
                        <span className="text-gray-400">Website</span>
                        <a href={selectedContact.ai_structured?.website} target="_blank" rel="noreferrer" className="col-span-2 text-brand-600 font-medium hover:underline truncate">
                          {selectedContact.ai_structured?.website || '—'}
                        </a>
                      </div>
                      <div className="grid grid-cols-3 text-xs py-1">
                        <span className="text-gray-400">LinkedIn</span>
                        <a href={selectedContact.linkedin_url || selectedContact.ai_structured?.linkedin} target="_blank" rel="noreferrer" className="col-span-2 text-brand-600 font-medium hover:underline truncate">
                          {selectedContact.linkedin_url || selectedContact.ai_structured?.linkedin || '—'}
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Context Notes */}
                  {selectedContact.context_notes && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-1.5">
                        <FileText size={12} />
                        Context Notes
                      </h4>
                      <div className="p-3 bg-brand-50/20 border border-brand-100/50 rounded-xl text-xs text-gray-700 leading-relaxed font-medium">
                        {selectedContact.context_notes}
                      </div>
                    </div>
                  )}

                  {/* AI Follow-Up Generator Box */}
                  <div className="space-y-4 border-t border-gray-100 pt-5">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={14} className="text-brand-500 font-semibold" />
                      <h4 className="text-xs font-bold text-gray-900 uppercase">AI Follow-up Composer</h4>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                      {/* Tone Slider */}
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-gray-600">Tone</span>
                          <span className="text-brand-600 font-bold">{getToneLabel(followupTone)}</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" 
                          max="5" 
                          value={followupTone} 
                          onChange={e => setFollowupTone(parseInt(e.target.value))}
                          className="w-full accent-brand-500 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-[9px] text-gray-400 font-semibold px-0.5">
                          <span>Casual</span>
                          <span>Friendly</span>
                          <span>Professional</span>
                          <span>Formal</span>
                          <span>Direct</span>
                        </div>
                      </div>

                      {/* Length Slider */}
                      <div className="flex flex-col gap-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-gray-600">Length</span>
                          <span className="text-brand-600 font-bold">{getLengthLabel(followupLength)}</span>
                        </div>
                        <input 
                          type="range" 
                          min="1" 
                          max="3" 
                          value={followupLength} 
                          onChange={e => setFollowupLength(parseInt(e.target.value))}
                          className="w-full accent-brand-500 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-[9px] text-gray-400 font-semibold px-0.5">
                          <span>Short</span>
                          <span>Medium</span>
                          <span>Long</span>
                        </div>
                      </div>

                      {/* Objective Dropdown */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Objective</label>
                        <select 
                          value={followupObjective}
                          onChange={e => setFollowupObjective(e.target.value)}
                          className="input py-1.5 text-xs font-semibold"
                        >
                          <option value="book_meeting">Book a meeting</option>
                          <option value="send_proposal">Send proposal</option>
                          <option value="say_thanks">Say thank you</option>
                          <option value="general_followup">General follow-up</option>
                        </select>
                      </div>

                      {/* Custom Context Prompt */}
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">Custom Context (Optional)</label>
                        <textarea 
                          value={customContext}
                          onChange={e => setCustomContext(e.target.value)}
                          className="input py-1.5 text-xs resize-none"
                          rows={2}
                          placeholder="e.g. Mention our product launch discussion"
                        />
                      </div>
                    </div>

                    {!(!!localStorage.getItem('gemini_api_key')) && customContext && (
                      <div className="p-2.5 bg-amber-50 border border-amber-100 rounded-lg flex items-start gap-2 text-[10px] text-amber-800">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        <span>Using local template fallback because Gemini API Key is missing. Custom context will be merged as a sentence.</span>
                      </div>
                    )}

                    {followupDraft ? (
                      <div className="space-y-3">
                        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                          {/* Tab Headers */}
                          <div className="flex border-b border-gray-100 bg-gray-50 px-2 justify-between items-center">
                            <div className="flex gap-1 py-1.5">
                              <button
                                onClick={() => setEditorMode('preview')}
                                className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer ${
                                  editorMode === 'preview'
                                    ? 'bg-white text-gray-900 shadow-sm border border-gray-100'
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                              >
                                Interactive Preview
                              </button>
                              <button
                                onClick={() => setEditorMode('edit')}
                                className={`px-2.5 py-1 text-[11px] font-semibold rounded transition-all cursor-pointer ${
                                  editorMode === 'edit'
                                    ? 'bg-white text-gray-900 shadow-sm border border-gray-100'
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                              >
                                Edit Plain Text
                              </button>
                            </div>
                            
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(followupDraft);
                                toast.success('Draft copied to clipboard!');
                              }}
                              className="btn-secondary btn-sm bg-white text-[10px] px-2 py-1 border border-gray-200 hover:bg-gray-50 font-semibold cursor-pointer"
                            >
                              Copy
                            </button>
                          </div>

                          {/* Content Area */}
                          <div className="p-3 bg-gray-50/30">
                            {editorMode === 'preview' ? (
                              <div 
                                className="w-full text-xs font-mono min-h-[160px] whitespace-pre-wrap leading-relaxed select-text"
                                dangerouslySetInnerHTML={{ __html: highlightDraft(followupDraft, selectedContact) }}
                              />
                            ) : (
                              <textarea
                                value={followupDraft}
                                onChange={e => setFollowupDraft(e.target.value)}
                                rows={8}
                                className="w-full text-xs font-mono border-0 p-0 bg-transparent resize-none focus:ring-0 focus:outline-none"
                                placeholder="Edit email body here..."
                              />
                            )}
                          </div>
                        </div>

                        {/* Interactive Highlights Legend */}
                        {editorMode === 'preview' && (
                          <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[10px] text-gray-500 mt-1 px-1 font-medium bg-gray-50 p-2 rounded-lg border border-gray-100/50">
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded bg-green-100 border border-green-300 inline-block" />
                              Contact Name
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded bg-amber-100 border border-amber-300 inline-block" />
                              Company
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded bg-blue-100 border border-blue-300 inline-block" />
                              Job Title
                            </span>
                            <span className="flex items-center gap-1">
                              <span className="w-2 h-2 rounded bg-purple-100 border border-purple-300 inline-block" />
                              My Info
                            </span>
                            {customContext && (
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded bg-rose-100 border border-rose-300 inline-block" />
                                Custom Context
                              </span>
                            )}
                          </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <a 
                            href={`mailto:${selectedContact.email || ''}?subject=${encodeURIComponent(followupDraft.split('\n')[0].replace('Subject: ', ''))}&body=${encodeURIComponent(followupDraft.split('\n').slice(2).join('\n'))}`}
                            className="btn-primary btn-sm flex items-center justify-center gap-1.5 shadow-sm hover:shadow text-center font-semibold cursor-pointer"
                          >
                            <Mail size={12} />
                            Email
                          </a>
                          
                          <a 
                            href={`https://wa.me/${selectedContact.phone ? selectedContact.phone.replace(/[^0-9+]/g, '') : ''}?text=${encodeURIComponent(followupDraft)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-secondary btn-sm flex items-center justify-center gap-1.5 shadow-sm hover:shadow text-center bg-green-50 text-green-700 border-green-200 hover:bg-green-100 font-semibold cursor-pointer"
                          >
                            <MessageSquare size={12} />
                            WhatsApp
                          </a>

                          <a 
                            href={`sms:${selectedContact.phone ? selectedContact.phone.replace(/[^0-9+]/g, '') : ''}?body=${encodeURIComponent(followupDraft)}`}
                            className="btn-secondary btn-sm flex items-center justify-center gap-1.5 shadow-sm hover:shadow text-center bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 font-semibold cursor-pointer"
                          >
                            <Send size={12} />
                            SMS
                          </a>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              try {
                                const hasEmail = !!selectedContact.email;
                                const channel = hasEmail ? 'email' : 'sms';
                                const recipient = hasEmail ? selectedContact.email : (selectedContact.phone || '');
                                
                                if (!recipient) {
                                  toast.error('No email or phone number to send to.');
                                  return;
                                }

                                toast.promise(
                                  notifications.send({
                                    channel,
                                    to: recipient,
                                    subject: followupDraft.split('\n')[0].replace('Subject: ', ''),
                                    body: followupDraft.split('\n').slice(2).join('\n') || followupDraft,
                                    contactId: selectedContact.id
                                  }).then(async (res) => {
                                    // Track in analytics and Inngest workflow scheduler
                                    await analytics.track({
                                      name: 'followup_sent',
                                      distinctId: user?.id || 'anonymous',
                                      properties: { channel, contactId: selectedContact.id }
                                    });

                                    await inngest.sendEvent({
                                      name: 'cardfollowup/sequence.start',
                                      data: {
                                        channel,
                                        to: recipient,
                                        body: followupDraft,
                                        contactId: selectedContact.id
                                      }
                                    });

                                    // Create message log in Supabase
                                    const { error: msgErr } = await createClient()
                                      .from('messages')
                                      .insert({
                                        tenant_id: user?.user_metadata?.tenant_id || user?.id,
                                        contact_id: selectedContact.id,
                                        sent_by: user?.id,
                                        channel,
                                        status: 'sent',
                                        subject: followupDraft.split('\n')[0].replace('Subject: ', ''),
                                        body: followupDraft.split('\n').slice(2).join('\n') || followupDraft,
                                        ai_generated: true,
                                        metadata: { sent_via: 'direct_dashboard' }
                                      });
                                    if (msgErr) console.warn('Database message logging failed:', msgErr);

                                    if (res.simulated) {
                                      return 'Follow-up simulated successfully!';
                                    }
                                    return 'Follow-up sent successfully!';
                                  }),
                                  {
                                    loading: 'Sending follow-up via pipeline...',
                                    success: (msg) => msg,
                                    error: 'Failed to send follow-up.'
                                  }
                                );
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                            className="flex-1 btn bg-brand hover:bg-brand-600 text-white rounded-xl py-2.5 font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Sparkles size={14} className="text-brand-100" />
                            Send via Server Pipeline
                          </button>
                          
                          <button
                            onClick={() => generateFollowupDraft(selectedContact)}
                            disabled={generatingFollowup}
                            className="btn-secondary py-2.5 px-3.5 flex items-center justify-center gap-1.5 hover:bg-gray-50 cursor-pointer"
                            title="Regenerate draft"
                          >
                            {generatingFollowup ? (
                              <Loader2 size={14} className="animate-spin text-brand-500" />
                            ) : (
                              <Sparkles size={14} className="text-brand-500" />
                            )}
                            Regenerate
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => generateFollowupDraft(selectedContact)}
                        disabled={generatingFollowup}
                        className="w-full btn bg-brand hover:bg-brand-600 text-white py-3 flex items-center justify-center gap-2 cursor-pointer shadow-md hover:shadow-lg font-bold rounded-xl"
                      >
                        {generatingFollowup ? (
                          <>
                            <Loader2 size={14} className="animate-spin text-brand-100" />
                            Generating sequence...
                          </>
                        ) : (
                          <>
                            <Sparkles size={14} className="text-brand-100" />
                            Generate instant follow-up
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Raw OCR logs */}
                  {selectedContact.raw_ocr_text && (
                    <div className="space-y-2 border-t border-gray-100 pt-5">
                      <details className="group">
                        <summary className="text-xs font-semibold text-gray-400 hover:text-gray-600 cursor-pointer flex items-center gap-1 select-none focus:outline-none">
                          <span>View raw OCR scanned text logs</span>
                        </summary>
                        <pre className="mt-3 p-3 bg-gray-100 rounded-xl text-[10px] text-gray-600 font-mono whitespace-pre-wrap overflow-x-auto max-h-[150px]">
                          {selectedContact.raw_ocr_text}
                        </pre>
                      </details>
                    </div>
                  )}
                </>
              )}

            </div>
          </aside>
        </div>
      )}

    </div>
  );
}

export default ContactsPage;
