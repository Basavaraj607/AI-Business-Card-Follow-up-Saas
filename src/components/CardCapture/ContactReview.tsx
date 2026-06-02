// components/CardCapture/ContactReview.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createClient } from '../../lib/supabase/client';
import { useAuth } from '../../lib/auth-context';
import { 
  User, Mail, Phone, Building, Briefcase, Globe,
  FileText, Sparkles, Save
} from 'lucide-react';

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
import toast from 'react-hot-toast';
import { ParsedContact } from '../../utils/ai-parser';

interface Props {
  initial: ParsedContact;
  onSave?: () => void;
  rawOcrText?: string;
  cardImagePath?: string;
}

export function ContactReview({ initial, onSave, rawOcrText = '', cardImagePath = '' }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [contact, setContact] = useState<ParsedContact>(initial);
  const [notes, setNotes] = useState('');
  const [tone, setTone] = useState<'casual' | 'formal' | 'sales' | 'partner'>('casual');
  const [saving, setSaving] = useState(false);

  const update = (field: string, value: string) =>
    setContact(prev => ({ ...prev, [field]: value }));

  async function save() {
    if (!user) {
      toast.error('You must be logged in to save contacts');
      return;
    }

    if (!contact.name || !contact.name.trim()) {
      toast.error('Contact Name is required');
      return;
    }

    setSaving(true);
    const supabase = createClient();

    // Ensure mock tenant and profile exist in database for bypass account
    if (sessionStorage.getItem('mock_user')) {
      try {
        const tenantId = user.user_metadata?.tenant_id ?? user.id;
        const emailSlug = (user.email ?? 'workspace').split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') || 'workspace';
        await supabase.from('tenants').insert({
          id: tenantId,
          name: `${user.email ?? 'Workspace'}'s Workspace`,
          slug: `${emailSlug}-workspace`,
          plan: 'free',
          owner_id: user.id,
          settings: {}
        });
        
        await supabase.from('profiles').insert({
          id: user.id,
          tenant_id: tenantId,
          full_name: user.user_metadata?.full_name ?? user.email ?? 'Local Tester',
          role: 'owner',
          email: user.email || 'tester@example.com'
        });
        console.log('Mock records verified in database.');
      } catch (e) {
        console.warn('Mock profile check finished:', e);
      }
    }

    try {
      const tenantId = user.user_metadata?.tenant_id ?? user.id;

      // Get public URL of the card image if path is provided
      let cardImageUrl = null;
      if (cardImagePath) {
        const { data } = supabase.storage.from('card-images').getPublicUrl(cardImagePath);
        cardImageUrl = data.publicUrl;
      }

      // Map tone to LeadStatus
      let leadStatus: 'hot' | 'warm' | 'cold' = 'warm';
      if (tone === 'sales') leadStatus = 'hot';
      else if (tone === 'casual') leadStatus = 'warm';
      else if (tone === 'partner') leadStatus = 'hot';
      else if (tone === 'formal') leadStatus = 'cold';

      const contactPayload = {
        tenant_id: tenantId,
        created_by: user.id,
        full_name: contact.name,
        email: contact.email || null,
        phone: contact.phone || null,
        role: contact.title || null,
        linkedin_url: contact.linkedin || null,
        card_image_path: cardImagePath || null,
        card_image_url: cardImageUrl,
        raw_ocr_text: rawOcrText,
        ai_structured: {
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          company: contact.company,
          title: contact.title,
          website: contact.website,
          linkedin: contact.linkedin
        },
        context_notes: notes || null,
        lead_status: leadStatus,
        met_at_date: new Date().toISOString().split('T')[0], // yyyy-mm-dd
        tags: [tone],
        is_archived: false
      };

      const { data: inserted, error } = await supabase
        .from('contacts')
        .insert(contactPayload)
        .select();

      console.debug('Supabase insert response:', { inserted, error });

      if (error) throw error;

      toast.success('Contact scanned and saved!');
      if (onSave) {
        onSave();
      } else {
        navigate('/contacts');
      }
    } catch (err: any) {
      console.error('Supabase save failed:', err);
      const errorMsg = err?.message || err?.details || JSON.stringify(err);
      toast.error(`Database Error: ${errorMsg}`, { duration: 6000 });

      // If foreign key to tenants is missing, try to create tenant/profile and retry once
      const fkMissing = err?.code === '23503' || (err?.message && err.message.includes('violates foreign key'))
      if (fkMissing) {
        try {
          const tenantId = user.user_metadata?.tenant_id ?? user.id
          const emailSlug = (user.email ?? 'workspace').split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') || 'workspace'
          await supabase.from('tenants').upsert({ id: tenantId, name: user.email ?? 'Workspace', slug: emailSlug, owner_id: user.id }, { onConflict: 'id' })
          await supabase.from('profiles').upsert({ id: user.id, tenant_id: tenantId, full_name: user.user_metadata?.full_name ?? user.email ?? 'User', email: user.email }, { onConflict: 'id' })
          // retry insert
          const { data: retried, error: retryError } = await supabase.from('contacts').insert(contactPayload).select()
          console.debug('Retry insert response:', { retried, retryError })
          if (!retryError) {
            toast.success('Contact scanned and saved!')
            if (onSave) return onSave()
            return navigate('/contacts')
          }
        } catch (retryErr) {
          console.warn('Retry after creating tenant/profile failed:', retryErr)
        }
      }

      try {
        const local = JSON.parse(localStorage.getItem('local_contacts') || '[]');
        const mockSavedPayload = {
          id: crypto.randomUUID(),
          tenant_id: user.user_metadata?.tenant_id ?? user.id,
          created_by: user.id,
          full_name: contact.name,
          email: contact.email || null,
          phone: contact.phone || null,
          role: contact.title || null,
          linkedin_url: contact.linkedin || null,
          card_image_path: cardImagePath || null,
          card_image_url: null,
          raw_ocr_text: rawOcrText,
          ai_structured: {
            name: contact.name,
            email: contact.email,
            phone: contact.phone,
            company: contact.company,
            title: contact.title,
            website: contact.website,
            linkedin: contact.linkedin
          },
          context_notes: notes || null,
          lead_status: tone === 'sales' || tone === 'partner' ? 'hot' : tone === 'formal' ? 'cold' : 'warm',
          met_at_date: new Date().toISOString().split('T')[0],
          tags: [tone],
          is_archived: false
        };
        local.unshift(mockSavedPayload);
        localStorage.setItem('local_contacts', JSON.stringify(local));
        toast.success('Contact scanned and saved locally!');
        if (onSave) {
          onSave();
        } else {
          navigate('/contacts');
        }
      } catch (localErr) {
        console.error('Local save failed:', localErr);
        toast.error('Failed to save contact locally.');
      }
    } finally {
      setSaving(false);
    }
  }

  const fields = [
    { name: 'name', label: 'Full Name', icon: User, placeholder: 'e.g. John Doe' },
    { name: 'email', label: 'Email', icon: Mail, placeholder: 'e.g. john@domain.com' },
    { name: 'phone', label: 'Phone', icon: Phone, placeholder: 'e.g. (123) 456-7890' },
    { name: 'company', label: 'Company', icon: Building, placeholder: 'e.g. Acme Corp' },
    { name: 'title', label: 'Job Title', icon: Briefcase, placeholder: 'e.g. Software Engineer' },
    { name: 'website', label: 'Website', icon: Globe, placeholder: 'e.g. www.acme.com' },
    { name: 'linkedin', label: 'LinkedIn', icon: Linkedin, placeholder: 'e.g. linkedin.com/in/johndoe' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-4">
        {fields.map(field => (
          <div key={field.name} className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3">
            <label className="text-xs font-semibold text-gray-500 w-full sm:w-24 shrink-0 flex items-center gap-1.5 capitalize">
              <field.icon size={13} className="text-gray-400" />
              {field.label}
            </label>
            <input
              value={contact[field.name] ?? ''}
              onChange={e => update(field.name, e.target.value)}
              placeholder={field.placeholder}
              className="flex-1 text-sm border-b border-gray-200 pb-1.5 bg-transparent
                         focus:outline-none focus:border-brand-400 transition-colors placeholder:text-gray-300 font-medium"
            />
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
          <FileText size={13} className="text-gray-400" />
          Context Notes
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Where did you meet? What did you discuss? Follow-up ideas?"
          rows={3}
          className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none bg-gray-50/30
                     focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 transition-all placeholder:text-gray-400"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
          <Sparkles size={13} className="text-brand-500" />
          Select Preferred Tone (sets follow-up style & priority)
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(['casual', 'formal', 'sales', 'partner'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTone(t)}
              className={`px-3 py-2 text-xs rounded-lg border font-medium transition-all capitalize
                ${tone === t 
                  ? 'bg-brand-500 text-white border-brand-500 shadow-sm scale-[1.01]' 
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full mt-2 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 transition-all duration-150 active:scale-[0.99] cursor-pointer"
      >
        {saving ? (
          <>
            <div className="spinner spinner-sm border-white/30 border-t-white" />
            Saving to CRM...
          </>
        ) : (
          <>
            <Save size={16} />
            Save & Generate Follow-up →
          </>
        )}
      </button>
    </div>
  );
}

export default ContactReview;