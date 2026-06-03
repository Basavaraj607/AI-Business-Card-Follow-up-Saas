// src/pages/admin/AdminTenantDetailPage.tsx

import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  Contact, 
  MessageSquare, 
  UserSquare2,
  ChevronLeft,
  Loader2,
  Calendar,
  Send
} from 'lucide-react';
import { adminService, type AdminTenantDetail } from '../../services/adminService';
import { useAuth } from '../../lib/auth-context';
import toast from 'react-hot-toast';

export function AdminTenantDetailPage() {
  const { id: tenantId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { impersonateUser } = useAuth();
  const [data, setData] = useState<AdminTenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'members' | 'contacts' | 'messages'>('members');

  const fetchTenantDetails = async () => {
    if (!tenantId) return;
    try {
      const res = await adminService.getTenant(tenantId);
      setData(res);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load workspace details');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenantDetails();
  }, [tenantId]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!data || !data.tenant) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 text-lg font-bold">Workspace not found</div>
        <Link to="/admin/tenants" className="text-indigo-600 hover:underline inline-flex items-center gap-1 mt-4">
          <ChevronLeft size={16} /> Back to Directory
        </Link>
      </div>
    );
  }

  const { tenant, members, contacts, messages } = data;

  const handleImpersonate = (member: any) => {
    impersonateUser({
      id: member.id,
      email: member.email,
      full_name: member.full_name || member.email.split('@')[0],
      tenant_id: tenant.id
    });
    navigate('/dashboard');
  };

  const planBadges: Record<string, string> = {
    free: 'bg-gray-100 text-gray-800 border-gray-200',
    pro: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    team: 'bg-violet-50 text-violet-700 border-violet-200',
    enterprise: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  };

  return (
    <div className="space-y-6">
      {/* Header and Back Link */}
      <div className="space-y-2">
        <Link 
          to="/admin/tenants" 
          className="inline-flex items-center text-xs font-bold text-gray-500 hover:text-indigo-600 transition-colors gap-1"
        >
          <ChevronLeft size={14} /> Back to Directory
        </Link>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center text-white">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">{tenant.name}</h1>
              <p className="text-xs font-mono text-gray-400">Tenant ID: {tenant.id}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold py-1.5 px-3.5 rounded-full border ${planBadges[tenant.plan] || 'bg-gray-100'}`}>
              Plan: {tenant.plan.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600"><Users size={20} /></div>
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Team Members</div>
            <div className="text-xl font-bold text-gray-950 mt-0.5">{members.length}</div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600"><Contact size={20} /></div>
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Contacts Captured</div>
            <div className="text-xl font-bold text-gray-950 mt-0.5">{contacts.length}</div>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 rounded-lg text-amber-600"><MessageSquare size={20} /></div>
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Follow-up Messages</div>
            <div className="text-xl font-bold text-gray-950 mt-0.5">{messages.length}</div>
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Navigation tabs */}
        <div className="flex border-b border-gray-100 px-6 bg-gray-50/50">
          <button 
            onClick={() => setActiveTab('members')}
            className={`py-4 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'members' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            Team Members ({members.length})
          </button>
          <button 
            onClick={() => setActiveTab('contacts')}
            className={`py-4 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'contacts' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            Contacts ({contacts.length})
          </button>
          <button 
            onClick={() => setActiveTab('messages')}
            className={`py-4 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === 'messages' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-400 hover:text-gray-700'
            }`}
          >
            Sent Messages ({messages.length})
          </button>
        </div>

        {/* Tab content panel */}
        <div className="p-6">
          {activeTab === 'members' && (
            <div className="space-y-4">
              {members.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">No team members registered.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                        <th className="pb-3">Name / User ID</th>
                        <th className="pb-3">Email Address</th>
                        <th className="pb-3">Tenant Role</th>
                        <th className="pb-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-gray-700">
                      {members.map((m) => (
                        <tr key={m.id} className="hover:bg-gray-50/25 transition-colors">
                          <td className="py-4 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs">
                              {(m.full_name || m.email).substring(0,2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-gray-900">{m.full_name || 'No Name'}</div>
                              <div className="text-[10px] text-gray-400 font-mono select-all">ID: {m.id}</div>
                            </div>
                          </td>
                          <td className="py-4 font-semibold text-gray-900">{m.email}</td>
                          <td className="py-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                              m.role === 'owner' ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}>
                              {m.role}
                            </span>
                          </td>
                          <td className="py-4 text-right">
                            <button
                              onClick={() => handleImpersonate(m)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-600 hover:text-white rounded-lg transition-all shadow-sm"
                            >
                              <UserSquare2 size={13} />
                              Impersonate
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'contacts' && (
            <div className="space-y-4">
              {contacts.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">No contacts captured by this workspace.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                        <th className="pb-3">Contact</th>
                        <th className="pb-3">Company / Role</th>
                        <th className="pb-3 text-center">Status</th>
                        <th className="pb-3">Created By</th>
                        <th className="pb-3 text-right">Date Met</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-gray-700">
                      {contacts.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50/25 transition-colors">
                          <td className="py-4.5">
                            <div>
                              <div className="font-bold text-gray-900">{c.full_name}</div>
                              <div className="text-xs text-gray-500">{c.email || 'No email'}</div>
                            </div>
                          </td>
                          <td className="py-4.5">
                            <div className="font-semibold text-gray-800">{(c.ai_structured as any)?.company || 'Unknown'}</div>
                            <div className="text-xs text-gray-400">{c.role || 'No title'}</div>
                          </td>
                          <td className="py-4.5 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${
                              c.lead_status === 'hot' ? 'bg-red-50 border-red-200 text-red-700' :
                              c.lead_status === 'warm' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                              c.lead_status === 'converted' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                              'bg-gray-50 border-gray-200 text-gray-600'
                            }`}>
                              {c.lead_status}
                            </span>
                          </td>
                          <td className="py-4.5 font-mono text-[10px] text-gray-400 select-all">{c.created_by}</td>
                          <td className="py-4.5 text-right text-xs text-gray-400">
                            {c.met_at_date || new Date(c.created_at).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">No follow-up messages sent by this workspace.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                        <th className="pb-3">Recipient ID</th>
                        <th className="pb-3">Channel</th>
                        <th className="pb-3">Subject / Body Snippet</th>
                        <th className="pb-3 text-center">Status</th>
                        <th className="pb-3 text-right">Sent Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-gray-700">
                      {messages.map((m) => (
                        <tr key={m.id} className="hover:bg-gray-50/25 transition-colors">
                          <td className="py-4.5 font-semibold text-gray-900">
                            <span className="font-mono text-[10px] text-gray-400 select-all">{m.contact_id}</span>
                          </td>
                          <td className="py-4.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs bg-slate-100 border border-slate-200 font-medium capitalize">
                              <Send size={11} className="text-gray-400" />
                              {m.channel}
                            </span>
                          </td>
                          <td className="py-4.5 max-w-[280px]">
                            {m.subject && <div className="font-bold text-gray-900 truncate text-xs">{m.subject}</div>}
                            <div className="text-xs text-gray-500 truncate">{m.body}</div>
                          </td>
                          <td className="py-4.5 text-center">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              m.status === 'sent' || m.status === 'delivered' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                              m.status === 'failed' ? 'bg-red-50 border-red-200 text-red-700' :
                              'bg-gray-50 border-gray-200 text-gray-600'
                            }`}>
                              {m.status}
                            </span>
                          </td>
                          <td className="py-4.5 text-right text-xs text-gray-400">
                            {new Date(m.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
