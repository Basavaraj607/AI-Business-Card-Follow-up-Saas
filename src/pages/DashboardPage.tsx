// pages/DashboardPage.tsx
import { useState, useEffect } from 'react';
import { useAuth } from '../lib/auth-context';
import { Link, useNavigate } from 'react-router-dom';
import { createClient } from '../lib/supabase/client';
import { 
  Users, Mail, Bell, Flame, Plus, CreditCard, 
  ChevronRight, Calendar, Building, Loader2 
} from 'lucide-react';

interface ContactSummary {
  id: string;
  full_name: string;
  role: string | null;
  ai_structured: any;
  lead_status: string;
  met_at_date: string | null;
  created_at: string;
}

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalContacts: 0,
    hotContacts: 0,
    warmContacts: 0,
    followupsSent: 0
  });
  const [recentContacts, setRecentContacts] = useState<ContactSummary[]>([]);

  const name = user?.user_metadata?.full_name?.split(' ')[0] ?? 'there';

  const loadDashboardData = async () => {
    if (!user) return;
    setLoading(true);
    const supabase = createClient();
    try {
      // 1. Fetch total contacts
      const { count: total, error: totalError } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', user.id);

      if (totalError) throw totalError;

      // 2. Fetch hot contacts
      const { count: hot, error: hotError } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', user.id)
        .eq('lead_status', 'hot');

      if (hotError) throw hotError;

      // 3. Fetch warm contacts
      const { count: warm, error: warmError } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('created_by', user.id)
        .eq('lead_status', 'warm');

      if (warmError) throw warmError;

      // 4. Fetch followups sent (messages)
      const { count: messagesCount, error: msgError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('sent_by', user.id);

      // Silently catch messages table issues, default to 0 if not setup
      const followups = msgError ? 0 : (messagesCount || 0);

      // 5. Fetch recent 3 contacts
      const { data: recents, error: recentsError } = await supabase
        .from('contacts')
        .select('id, full_name, role, ai_structured, lead_status, met_at_date, created_at')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false })
        .limit(3);

      if (recentsError) throw recentsError;

      setStats({
        totalContacts: total || 0,
        hotContacts: hot || 0,
        warmContacts: warm || 0,
        followupsSent: followups
      });
      setRecentContacts(recents || []);

    } catch (err: any) {
      console.error('Supabase dashboard fetch failed:', err);
      setStats({
        totalContacts: 0,
        hotContacts: 0,
        warmContacts: 0,
        followupsSent: 0
      });
      setRecentContacts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [user]);

  const STAT_CARDS = [
    { label: 'Total Contacts', value: stats.totalContacts, icon: Users, color: 'bg-brand-50 text-brand-600' },
    { label: 'Hot Leads 🔥', value: stats.hotContacts, icon: Flame, color: 'bg-red-50 text-red-600' },
    { label: 'Warm Connections', value: stats.warmContacts, icon: Bell, color: 'bg-amber-50 text-amber-600' },
    { label: 'Follow-ups Sent', value: stats.followupsSent, icon: Mail, color: 'bg-blue-50 text-blue-600' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 animate-fade-in">Good morning, {name} 👋</h1>
          <p className="text-gray-500 text-sm mt-0.5">Here's how your business card pipeline is looking.</p>
        </div>
        <Link to="/contacts/upload" className="btn-primary shadow-sm flex items-center gap-1.5 shrink-0 self-start sm:self-auto">
          <Plus size={16} />
          Scan a card
        </Link>
      </div>

      {loading ? (
        <div className="card p-12 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-sm text-gray-500">Loading pipeline statistics...</p>
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STAT_CARDS.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card p-5 hover:shadow-md transition-shadow duration-200">
                <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center mb-3`}>
                  <Icon size={18} />
                </div>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
                <p className="text-xs font-semibold text-gray-500 mt-1 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>

          {/* Recent scans and quick actions */}
          <div className="grid md:grid-cols-3 gap-6">
            
            {/* Recent Contacts Column */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-base">Recent Scans</h3>
                <Link to="/contacts" className="text-xs font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-0.5 hover:underline">
                  View all
                  <ChevronRight size={14} />
                </Link>
              </div>

              {recentContacts.length === 0 ? (
                <div className="card p-8 flex flex-col items-center justify-center text-center">
                  <div className="w-12 h-12 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center mb-3">
                    <CreditCard size={20} />
                  </div>
                  <h4 className="font-semibold text-gray-900 text-sm mb-1">No business cards scanned</h4>
                  <p className="text-xs text-gray-500 max-w-xs mb-4">
                    AI will automatically extract all info and compose draft follow-up templates for you.
                  </p>
                  <Link to="/contacts/upload" className="btn-primary btn-sm flex items-center gap-1">
                    <Plus size={14} />
                    Scan Your First Card
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentContacts.map(contact => {
                    const company = contact.ai_structured?.company || '';
                    const initials = contact.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

                    return (
                      <div 
                        key={contact.id}
                        onClick={() => navigate('/contacts')}
                        className="card p-4 hover:shadow-md transition-shadow cursor-pointer flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-gray-900 text-sm truncate">{contact.full_name}</h4>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                              {contact.role && <span className="truncate">{contact.role}</span>}
                              {contact.role && company && <span>·</span>}
                              {company && <span className="truncate font-semibold">{company}</span>}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`badge px-2 py-0.5 text-[10px] capitalize
                            ${contact.lead_status === 'hot' ? 'bg-red-50 text-red-700' : ''}
                            ${contact.lead_status === 'warm' ? 'bg-amber-50 text-amber-800' : ''}
                            ${contact.lead_status === 'cold' ? 'bg-blue-50 text-blue-700' : ''}
                          `}>
                            {contact.lead_status}
                          </span>
                          <div className="flex items-center gap-1 text-[10px] text-gray-400">
                            <Calendar size={10} />
                            <span>{contact.met_at_date || 'Today'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Tips */}
            <div className="space-y-4">
              <h3 className="font-bold text-gray-900 text-base">Quick Actions</h3>
              <div className="card p-5 space-y-4">
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wider">Useful Tips</h4>
                  <div className="text-xs text-gray-600 space-y-2.5">
                    <p>📸 <strong>Hold steady:</strong> When capturing, align the card edges with the green helper lines for clean text scans.</p>
                    <p>⚡ <strong>Select your tone:</strong> Adjust the tone chip on review. Casual follow-ups are perfect for quick networking, while Sales templates maximize leads.</p>
                    <p>🔑 <strong>AI Power:</strong> Configure your personal Gemini API key in settings to unlock hyper-intelligent field parsing.</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}

export default DashboardPage;
