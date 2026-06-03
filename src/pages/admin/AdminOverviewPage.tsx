// src/pages/admin/AdminOverviewPage.tsx

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Building2, 
  Users, 
  Contact, 
  MessageSquare, 
  ShieldAlert,
  Loader2,
  Calendar,
  Clock,
  ChevronRight
} from 'lucide-react';
import { adminService, type AdminOverviewData } from '../../services/adminService';
import toast from 'react-hot-toast';

export function AdminSubNav() {
  const location = useLocation();
  const tabs = [
    { to: '/admin', label: 'Overview', exact: true },
    { to: '/admin/tenants', label: 'Tenants', exact: false },
    { to: '/admin/users', label: 'Users', exact: false },
    { to: '/admin/settings', label: 'Settings', exact: false },
  ];

  return (
    <div className="flex border-b border-gray-200 mb-8 gap-6 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.exact 
          ? location.pathname === tab.to 
          : location.pathname.startsWith(tab.to);
        
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
              isActive 
                ? 'border-indigo-600 text-indigo-600 font-bold' 
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

export function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const res = await adminService.getOverview();
        setData(res);
      } catch (err: any) {
        toast.error(err.message || 'Failed to load platform stats');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchOverview();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-gray-900">Failed to load administrator overview</h3>
        <p className="text-gray-500">Please check your network and admin status.</p>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Tenants', value: data.totalTenants, icon: Building2, color: 'text-indigo-600 bg-indigo-50 border-indigo-100', link: '/admin/tenants' },
    { label: 'Total Users', value: data.totalUsers, icon: Users, color: 'text-emerald-600 bg-emerald-50 border-emerald-100', link: '/admin/users' },
    { label: 'Total Contacts', value: data.totalContacts, icon: Contact, color: 'text-violet-600 bg-violet-50 border-violet-100' },
    { label: 'Messages Sent', value: data.totalMessages, icon: MessageSquare, color: 'text-amber-600 bg-amber-50 border-amber-100' },
  ];

  // Determine max signup count to scale sparkline bars
  const maxSignup = Math.max(...data.signupsSparkline.map(s => s.count), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Platform Control Center</h1>
        <p className="text-sm text-gray-500">Multi-tenant performance, security logs, and configuration.</p>
      </div>

      <AdminSubNav />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-5 hover:shadow-md transition-all">
            <div className={`p-4 rounded-xl border ${card.color.split(' ')[1]} ${card.color.split(' ')[2]} flex items-center justify-center`}>
              <card.icon className={`h-6 w-6 ${card.color.split(' ')[0]}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{card.label}</p>
              <h3 className="text-2xl font-bold text-gray-950 mt-1">{card.value}</h3>
              {card.link && (
                <Link to={card.link} className="inline-flex items-center text-xs font-bold text-indigo-600 mt-2 hover:underline">
                  Manage <ChevronRight size={12} />
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Signups and Plans Panel */}
        <div className="lg:col-span-1 space-y-6">
          {/* Plan Breakdown */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5">
            <h3 className="font-bold text-gray-900 text-sm tracking-wide uppercase">Plan Allocation</h3>
            <div className="space-y-3.5">
              {Object.entries(data.planBreakdown).map(([plan, count]) => {
                const colors: Record<string, string> = {
                  free: 'bg-gray-400',
                  pro: 'bg-indigo-600',
                  team: 'bg-violet-600',
                  enterprise: 'bg-emerald-600'
                };
                const percentage = data.totalTenants > 0 ? (count / data.totalTenants) * 100 : 0;
                return (
                  <div key={plan} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-gray-700">
                      <span className="capitalize">{plan}</span>
                      <span>{count} ({percentage.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div className={`${colors[plan] || 'bg-gray-500'} h-full rounded-full transition-all`} style={{ width: `${percentage}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Signups Sparkline */}
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-5">
            <h3 className="font-bold text-gray-900 text-sm tracking-wide uppercase flex items-center justify-between">
              <span>Sign-ups (Last 7 Days)</span>
              <Calendar size={14} className="text-gray-400" />
            </h3>
            <div className="h-28 flex items-end justify-between gap-2.5 pt-2">
              {data.signupsSparkline.map((s, idx) => {
                const heightPercentage = (s.count / maxSignup) * 100;
                const d = new Date(s.date);
                const dayLabel = d.toLocaleDateString(undefined, { weekday: 'narrow' });
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative">
                    {/* Tooltip */}
                    <div className="absolute bottom-full mb-1.5 scale-0 group-hover:scale-100 bg-gray-900 text-white text-[10px] font-bold py-1 px-2 rounded whitespace-nowrap z-10 transition-all pointer-events-none shadow">
                      {s.count} signup{s.count !== 1 ? 's' : ''} on {s.date}
                    </div>
                    <div 
                      className="w-full bg-indigo-100 hover:bg-indigo-600 rounded-md transition-all" 
                      style={{ height: `${Math.max(heightPercentage, 8)}%` }}
                    ></div>
                    <span className="text-[10px] font-bold text-gray-400">{dayLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Security Audit Trail */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
            <h3 className="font-bold text-gray-900 text-sm tracking-wide uppercase">Administrative Audit Logs</h3>
            <Clock size={16} className="text-gray-400" />
          </div>

          <div className="flex-1 overflow-x-auto">
            {data.recentLogs.length === 0 ? (
              <div className="h-full flex items-center justify-center py-12 text-gray-400 text-sm">
                No administrative audit logs recorded yet.
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 uppercase tracking-wider font-semibold">
                    <th className="py-2.5">Admin</th>
                    <th className="py-2.5">Action</th>
                    <th className="py-2.5">Tenant Target</th>
                    <th className="py-2.5 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-gray-700">
                  {data.recentLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-3 font-semibold text-gray-900">{log.admin_email}</td>
                      <td className="py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-800 capitalize border border-slate-200">
                          {log.action.replace('-', ' ')}
                        </span>
                      </td>
                      <td className="py-3 text-gray-500 font-mono text-[10px] truncate max-w-[120px]">{log.target_tenant_id || 'System'}</td>
                      <td className="py-3 text-right text-gray-400">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{' '}
                        {new Date(log.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
