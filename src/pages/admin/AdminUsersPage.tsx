// src/pages/admin/AdminUsersPage.tsx

import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Users, 
  Search, 
  UserSquare2,
  Loader2,
  Calendar,
  Building2
} from 'lucide-react';
import { adminService, type AdminUserListItem } from '../../services/adminService';
import { useAuth } from '../../lib/auth-context';
import { AdminSubNav } from './AdminOverviewPage';
import toast from 'react-hot-toast';

export function AdminUsersPage() {
  const navigate = useNavigate();
  const { impersonateUser } = useAuth();
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await adminService.listUsers();
      setUsers(res);
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch platform users');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleImpersonate = (user: AdminUserListItem) => {
    impersonateUser({
      id: user.id,
      email: user.email,
      full_name: user.full_name || user.email.split('@')[0],
      tenant_id: user.tenant_id
    });
    navigate('/dashboard');
  };

  const filteredUsers = users.filter(u => 
    (u.full_name && u.full_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.tenant_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">User Registry</h1>
        <p className="text-sm text-gray-500">Query all registered profiles across workspaces and test user sessions.</p>
      </div>

      <AdminSubNav />

      {/* Control Bar */}
      <div className="flex items-center gap-3 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search users by name, email, or workspace..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 hover:bg-gray-100/75 focus:bg-white border border-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg outline-none transition-all"
          />
        </div>
        <div className="text-xs font-semibold text-gray-400">
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-24 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-24 text-center text-gray-500">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">No users found</p>
            <p className="text-xs mt-1">Try refining your search terms or keywords.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-gray-400 uppercase tracking-wider text-[10px] font-bold">
                  <th className="py-3.5 px-6">User Details</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Workspace (Tenant)</th>
                  <th className="py-3.5 px-4 text-center">Profile Role</th>
                  <th className="py-3.5 px-4">Registered</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-700">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">
                        {(u.full_name || u.email).substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900">{u.full_name || 'No Name Set'}</div>
                        <div className="text-[10px] text-gray-400 font-mono select-all">ID: {u.id}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4 font-semibold text-gray-900">
                      {u.email}
                      {u.phone && <div className="text-xs font-normal text-gray-400 mt-0.5">{u.phone}</div>}
                    </td>
                    <td className="py-4 px-4">
                      <Link 
                        to={`/admin/tenants/${u.tenant_id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                      >
                        <Building2 size={12} />
                        {u.tenant_name}
                      </Link>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        u.user_type === 'superadmin' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 font-bold' :
                        u.role === 'owner' ? 'bg-orange-50 border-orange-200 text-orange-700' :
                        'bg-gray-50 border-gray-200 text-gray-600'
                      }`}>
                        {u.user_type === 'superadmin' ? 'superadmin' : u.role}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(u.created_at).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => handleImpersonate(u)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-600 hover:text-white rounded-lg transition-all shadow-sm"
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
    </div>
  );
}
