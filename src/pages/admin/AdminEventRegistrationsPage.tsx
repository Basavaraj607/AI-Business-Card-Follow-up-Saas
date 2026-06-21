// pages/admin/AdminEventRegistrationsPage.tsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../lib/supabase/client';
import { useAuth } from '../../lib/auth-context';
import { 
  ArrowLeft, Users, UserPlus, Trash2, Mail, 
  Search, ShieldAlert, CheckCircle, X
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

interface Registration {
  id: string;
  event_id: string;
  user_id: string;
  registration_status: 'registered' | 'cancelled';
  registered_by: string;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export function AdminEventRegistrationsPage() {
  const { id: eventId } = useParams<{ id: string }>();
  const { tenantId, role, userType, loading: loadingAuth } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProfileId, setSelectedProfileId] = useState('');

  const supabase = createClient();
  const isAdmin = role === 'admin' || role === 'owner' || userType === 'superadmin';

  // 1. Guard page access (handling async role loading)
  const { user } = useAuth();
  const isRoleLoading = !!user && role === null;

  useEffect(() => {
    if (!loadingAuth && !isRoleLoading && !isAdmin) {
      toast.error('Forbidden: Tenant Admin privileges required');
      navigate('/dashboard');
    }
  }, [isAdmin, loadingAuth, isRoleLoading, navigate]);

  // 2. Fetch Event details
  const { data: event } = useQuery({
    queryKey: ['admin-event-info', eventId],
    queryFn: async () => {
      if (!eventId) return null;
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!eventId && isAdmin,
  });

  // 3. Fetch Event registrations list
  const { data: registrations = [], isLoading: loadingRegs } = useQuery<Registration[]>({
    queryKey: ['admin-event-registrations', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await supabase
        .from('event_registrations')
        .select('*, profiles:user_id(full_name, email)')
        .eq('event_id', eventId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!eventId && isAdmin,
  });

  // 4. Fetch all profiles in the tenant for the search widget
  const { data: tenantProfiles = [] } = useQuery<Profile[]>({
    queryKey: ['tenant-profiles', event?.tenant_id || tenantId],
    queryFn: async () => {
      const targetTenantId = event?.tenant_id || tenantId;
      if (!targetTenantId) return [];
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('tenant_id', targetTenantId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!(event?.tenant_id || tenantId) && isAdmin,
  });

  // 5. Add Registration Mutation
  const addRegistrationMutation = useMutation({
    mutationFn: async (userId: string) => {
      const targetTenantId = event?.tenant_id || tenantId;
      if (!targetTenantId || !eventId) throw new Error('Parameters missing');
      
      // Check if registration already exists
      const existing = registrations.find(r => r.user_id === userId);
      if (existing) {
        if (existing.registration_status === 'registered') {
          throw new Error('User is already registered for this event');
        }
        // Reactivate registration
        const { error } = await supabase
          .from('event_registrations')
          .update({ registration_status: 'registered', registered_by: 'admin' })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Insert new registration
        const { error } = await supabase
          .from('event_registrations')
          .insert({
            tenant_id: targetTenantId,
            event_id: eventId,
            user_id: userId,
            registration_status: 'registered',
            registered_by: 'admin'
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      const targetTenantId = event?.tenant_id || tenantId;
      toast.success('User registered successfully!');
      setSelectedProfileId('');
      setSearchTerm('');
      queryClient.invalidateQueries({ queryKey: ['admin-event-registrations', eventId] });
      queryClient.invalidateQueries({ queryKey: ['registrations', targetTenantId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to register user');
    }
  });

  // 6. Delete/Cancel Registration Mutation
  const removeRegistrationMutation = useMutation({
    mutationFn: async (regId: string) => {
      // We perform delete to fully remove registration in admin list
      const { error } = await supabase
        .from('event_registrations')
        .delete()
        .eq('id', regId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      const targetTenantId = event?.tenant_id || tenantId;
      toast.success('Registration removed successfully.');
      queryClient.invalidateQueries({ queryKey: ['admin-event-registrations', eventId] });
      queryClient.invalidateQueries({ queryKey: ['registrations', targetTenantId] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to remove registration');
    }
  });

  if (loadingAuth || isRoleLoading || loadingRegs) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner border-brand-400 border-t-white" />
      </div>
    );
  }

  // Filter profiles for user-addition search
  const registeredUserIds = new Set(
    registrations
      .filter(r => r.registration_status === 'registered')
      .map(r => r.user_id)
  );

  const eligibleProfiles = tenantProfiles.filter(
    p => !registeredUserIds.has(p.id) &&
         (p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
          p.email.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const activeRegistrants = registrations.filter(r => r.registration_status === 'registered');

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Navigation and title */}
      <div className="space-y-4">
        <button 
          onClick={() => navigate('/admin/events')} 
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={13} />
          Back to Events Management
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-500 flex items-center justify-center">
            <Users size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-gray-900 font-display">Event Registrants</h1>
            <p className="text-xs text-gray-500">
              Manage attendees for: <strong className="text-gray-800 font-semibold">{event?.title}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Grid: Search/Add Attendees + Attendee list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Manual Registrant Add Form */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm space-y-4 h-fit">
          <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
            <UserPlus size={16} className="text-brand-500" />
            Register a User
          </h2>
          
          <div className="space-y-3">
            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search user name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-xl pl-9 pr-4 py-3 bg-gray-50/15
                           focus:outline-none focus:border-brand-400 transition-all font-medium"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')} 
                  className="absolute right-3 top-3.5 text-gray-400 hover:text-gray-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Results Select */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                Select Profile
              </label>
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="w-full text-xs border border-gray-200 rounded-xl p-3 bg-white
                           focus:outline-none focus:border-brand-400 font-medium cursor-pointer"
              >
                <option value="">-- Choose User --</option>
                {eligibleProfiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name ? `${p.full_name} (${p.email})` : p.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Submit Button */}
            <button
              onClick={() => {
                if (selectedProfileId) {
                  addRegistrationMutation.mutate(selectedProfileId);
                } else {
                  toast.error('Please select a profile to register');
                }
              }}
              disabled={!selectedProfileId || addRegistrationMutation.isPending}
              className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all cursor-pointer"
            >
              <UserPlus size={14} />
              Register User
            </button>
          </div>
        </div>

        {/* Right Column: Registrants list */}
        <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Users size={16} className="text-gray-400" />
              Active Attendees List
            </h2>
            <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {activeRegistrants.length} Registered
            </span>
          </div>

          {activeRegistrants.length === 0 ? (
            <div className="text-center py-16 flex flex-col items-center justify-center gap-2">
              <ShieldAlert size={36} className="text-gray-300" />
              <h3 className="font-semibold text-gray-800 text-xs">No registered attendees</h3>
              <p className="text-[11px] text-gray-400">
                Register users manually using the panel on the left, or invite them to register from their dashboard.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {activeRegistrants.map(reg => (
                <div key={reg.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-gray-900 truncate">
                      {reg.profiles?.full_name || 'Unnamed Member'}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-medium mt-0.5">
                      <span className="flex items-center gap-1">
                        <Mail size={10} />
                        {reg.profiles?.email}
                      </span>
                      <span>·</span>
                      <span className="capitalize">Registered: {reg.registered_by}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to remove ${reg.profiles?.full_name || reg.profiles?.email} from this event?`)) {
                        removeRegistrationMutation.mutate(reg.id);
                      }
                    }}
                    disabled={removeRegistrationMutation.isPending}
                    className="p-1.5 bg-white border border-gray-100 hover:bg-red-50 hover:text-red-600 hover:border-red-100 rounded-lg text-gray-400 shadow-sm active:scale-95 transition-all cursor-pointer"
                    title="Remove Registration"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

export default AdminEventRegistrationsPage;
