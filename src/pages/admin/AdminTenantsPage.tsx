// src/pages/admin/AdminTenantsPage.tsx

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building2, 
  Search, 
  Trash2, 
  ArrowUpRight,
  Loader2,
  Calendar
} from 'lucide-react';
import { adminService, type AdminTenantListItem } from '../../services/adminService';
import { AdminSubNav } from './AdminOverviewPage';
import toast from 'react-hot-toast';

export function AdminTenantsPage() {
  const [tenants, setTenants] = useState<AdminTenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchTenants = async () => {
    try {
      const res = await adminService.listTenants();
      setTenants(res);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch tenants');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handlePlanChange = async (tenantId: string, newPlan: 'free' | 'pro' | 'team' | 'enterprise') => {
    const loadingToast = toast.loading('Updating plan...');
    try {
      await adminService.changePlan(tenantId, newPlan);
      setTenants(prev => 
        prev.map(t => t.id === tenantId ? { ...t, plan: newPlan } : t)
      );
      toast.success('Tenant plan updated successfully', { id: loadingToast });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update plan', { id: loadingToast });
    }
  };

  const handleDeleteTenant = async (tenantId: string, name: string) => {
    if (!window.confirm(`CRITICAL WARNING: Are you absolutely sure you want to delete "${name}"?\nThis will permanently delete all contacts, team members, and messages associated with this workspace.`)) {
      return;
    }

    const loadingToast = toast.loading('Deleting workspace...');
    try {
      await adminService.deleteTenant(tenantId);
      setTenants(prev => prev.filter(t => t.id !== tenantId));
      toast.success('Workspace deleted successfully', { id: loadingToast });
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete workspace', { id: loadingToast });
    }
  };

  const filteredTenants = tenants.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const planBadges: Record<string, string> = {
    free: 'bg-gray-100 text-gray-800 border-gray-200',
    pro: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    team: 'bg-violet-50 text-violet-700 border-violet-200',
    enterprise: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Workspace Directory</h1>
          <p className="text-sm text-gray-500">Manage multi-tenant subscriptions, view usage, and delete accounts.</p>
        </div>
      </div>

      <AdminSubNav />

      {/* Control Bar */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search workspaces by name, slug, or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 hover:bg-gray-100/75 focus:bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg outline-none transition-all"
          />
        </div>
        <div className="text-xs font-semibold text-gray-400">
          Showing {filteredTenants.length} of {tenants.length} tenants
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-24 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : filteredTenants.length === 0 ? (
          <div className="py-24 text-center text-gray-500">
            <Building2 className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">No workspaces found</p>
            <p className="text-xs mt-1">Try refining your search terms or keywords.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-3.5 px-6">Workspace / Owner ID</th>
                  <th className="py-3.5 px-4">Slug</th>
                  <th className="py-3.5 px-4">Plan Level</th>
                  <th className="py-3.5 px-4 text-center">Users</th>
                  <th className="py-3.5 px-4 text-center">Contacts</th>
                  <th className="py-3.5 px-4 text-center">Messages</th>
                  <th className="py-3.5 px-4">Created</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredTenants.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4.5 px-6">
                      <div>
                        <div className="font-bold text-gray-900 flex items-center gap-1.5">
                          {t.name}
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5 select-all">
                          ID: {t.id}
                        </div>
                      </div>
                    </td>
                    <td className="py-4.5 px-4 font-mono text-xs text-gray-500">
                      /{t.slug}
                    </td>
                    <td className="py-4.5 px-4">
                      <select
                        value={t.plan}
                        onChange={(e) => handlePlanChange(t.id, e.target.value as any)}
                        className={`text-xs font-semibold py-1 px-2.5 rounded-full border outline-none cursor-pointer transition-all ${
                          planBadges[t.plan] || 'bg-gray-100 border-gray-200'
                        }`}
                      >
                        <option value="free">Free</option>
                        <option value="pro">Pro</option>
                        <option value="team">Team</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </td>
                    <td className="py-4.5 px-4 text-center font-semibold text-gray-900">
                      {t.users_count}
                    </td>
                    <td className="py-4.5 px-4 text-center font-semibold text-gray-900">
                      {t.contacts_count}
                    </td>
                    <td className="py-4.5 px-4 text-center font-semibold text-gray-900">
                      {t.messages_count}
                    </td>
                    <td className="py-4.5 px-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(t.created_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </td>
                    <td className="py-4.5 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link 
                          to={`/admin/tenants/${t.id}`}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 border border-transparent hover:border-indigo-100 rounded-lg transition-all"
                          title="View workspace details"
                        >
                          <ArrowUpRight size={16} />
                        </Link>
                        <button
                          onClick={() => handleDeleteTenant(t.id, t.name)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 rounded-lg transition-all"
                          title="Delete workspace"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
