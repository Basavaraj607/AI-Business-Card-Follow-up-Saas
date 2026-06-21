// pages/admin/AdminEventsPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../../lib/supabase/client';
import { useAuth } from '../../lib/auth-context';
import { EventCreateEditForm } from '../../components/events/EventCreateEditForm';
import { 
  Calendar, MapPin, Clock, Edit2, Trash2, Check, X, 
  User, Mail, ArrowLeft, Plus, Users, CalendarRange
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AdminEvent {
  id: string;
  tenant_id: string;
  title: string;
  description?: string;
  location: string;
  start_time: string;
  end_time: string;
  banner_image_path?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requires_approval: boolean;
  notified: boolean;
  created_by: string;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
}

export function AdminEventsPage() {
  const { user, tenantId, role, userType, loading: loadingAuth } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'cancelled'>('all');
  const [editingEvent, setEditingEvent] = useState<AdminEvent | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const supabase = createClient();
  const isAdmin = role === 'admin' || role === 'owner' || userType === 'superadmin';

  // 1. Guard page access (handling async role loading)
  const isRoleLoading = !!user && role === null;

  useEffect(() => {
    if (!loadingAuth && !isRoleLoading && !isAdmin) {
      toast.error('Forbidden: Tenant Admin privileges required');
      navigate('/dashboard');
    }
  }, [isAdmin, loadingAuth, isRoleLoading, navigate]);

  // 2. Query events in the tenant (with creator profiles joined)
  const { data: events = [], isLoading } = useQuery<AdminEvent[]>({
    queryKey: ['admin-events', tenantId, userType],
    queryFn: async () => {
      let query = supabase
        .from('events')
        .select('*, profiles:created_by(full_name, email)')
        .order('start_time', { ascending: true });
      
      if (userType !== 'superadmin') {
        if (!tenantId) return [];
        query = query.eq('tenant_id', tenantId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: (!!tenantId || userType === 'superadmin') && isAdmin,
  });

  // 3. Status Change Mutations (Approve, Reject, Cancel)
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AdminEvent['status'] }) => {
      const { error } = await supabase
        .from('events')
        .update({ 
          status, 
          approved_by: status === 'approved' ? user?.id : null,
          notified: false // Flip notified to false to trigger a toast for the creator
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      toast.success(`Event status updated to: ${variables.status}`);
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] }); // Refresh user-facing cache too
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update event status');
    }
  });

  // 4. Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Event deleted successfully.');
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete event');
    }
  });

  // Helper date formatter
  const formatEventDate = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);
    return `${start.toLocaleDateString()} ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  if (loadingAuth || isRoleLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner border-brand-400 border-t-white" />
      </div>
    );
  }

  // Filter events list
  const filteredEvents = events.filter(e => filter === 'all' || e.status === filter);

  if (showCreateForm || editingEvent) {
    return (
      <div className="space-y-6 max-w-xl mx-auto">
        <button 
          onClick={() => { setShowCreateForm(false); setEditingEvent(null); }} 
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={13} />
          Back to Events Management
        </button>

        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h1 className="text-lg font-bold text-gray-900 mb-4">
            {editingEvent ? `Edit Event: ${editingEvent.title}` : 'Create New Event'}
          </h1>
          <EventCreateEditForm
            initialData={editingEvent || undefined}
            isUserSubmission={false}
            onSubmitSuccess={() => {
              setShowCreateForm(false);
              setEditingEvent(null);
              queryClient.invalidateQueries({ queryKey: ['admin-events', tenantId] });
            }}
            onCancel={() => {
              setShowCreateForm(false);
              setEditingEvent(null);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      
      {/* Title block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 font-display">Manage Workspace Events</h1>
          <p className="text-xs text-gray-500 mt-1">
            Review event requests, manage registrants list, and publish new events.
          </p>
        </div>
        
        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white font-semibold text-xs rounded-xl shadow-md transition-all active:scale-98 cursor-pointer"
        >
          <Plus size={15} />
          Create Event
        </button>
      </div>

      {/* Tabs / filters */}
      <div className="flex border-b border-gray-100">
        {(['all', 'pending', 'approved', 'rejected', 'cancelled'] as const).map(f => {
          const count = f === 'all' ? events.length : events.filter(e => e.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all relative capitalize cursor-pointer
                ${filter === f 
                  ? 'border-brand-500 text-brand-600 font-bold' 
                  : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >
              {f}
              {count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Table grid listing */}
      {filteredEvents.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-100 rounded-2xl p-8 flex flex-col items-center justify-center gap-3">
          <CalendarRange size={40} className="text-gray-300" />
          <h3 className="font-semibold text-gray-800 text-sm">No events found</h3>
          <p className="text-xs text-gray-400 max-w-xs">
            There are no events matching this filter category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredEvents.map(event => (
            <div 
              key={event.id}
              className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5"
            >
              <div className="space-y-2 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 text-sm truncate">{event.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0
                    ${event.status === 'approved' ? 'bg-green-50 text-green-700 border border-green-100' :
                      event.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                      event.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-100' :
                      'bg-gray-50 text-gray-700 border border-gray-100'}`}
                  >
                    {event.status}
                  </span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock size={12} className="text-gray-400" />
                    <span>{formatEventDate(event.start_time, event.end_time)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin size={12} className="text-gray-400" />
                    <span>{event.location}</span>
                  </div>
                  {event.profiles && (
                    <div className="flex items-center gap-1 font-medium">
                      <User size={12} className="text-gray-400" />
                      <span>By: {event.profiles.full_name || event.profiles.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center flex-wrap gap-2 shrink-0">
                
                {/* Registrations view */}
                <button
                  onClick={() => navigate(`/admin/events/${event.id}/registrations`)}
                  className="p-2 bg-white border border-gray-200 hover:bg-gray-50 hover:text-brand-600 rounded-lg text-gray-600 transition-colors shadow-sm flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                  title="Manage Registrants"
                >
                  <Users size={14} />
                  Registrants
                </button>

                {/* Edit */}
                <button
                  onClick={() => setEditingEvent(event)}
                  className="p-2 bg-white border border-gray-200 hover:bg-gray-50 hover:text-brand-600 rounded-lg text-gray-600 transition-colors shadow-sm cursor-pointer"
                  title="Edit Event"
                >
                  <Edit2 size={14} />
                </button>

                {/* Moderation Controls */}
                {event.status === 'pending' && (
                  <>
                    <button
                      onClick={() => statusMutation.mutate({ id: event.id, status: 'approved' })}
                      className="p-2 bg-green-50 hover:bg-green-100 text-green-700 rounded-lg shadow-sm cursor-pointer border border-green-200 flex items-center gap-1 text-xs font-bold"
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      onClick={() => statusMutation.mutate({ id: event.id, status: 'rejected' })}
                      className="p-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg shadow-sm cursor-pointer border border-red-200 flex items-center gap-1 text-xs font-bold"
                    >
                      <X size={14} /> Reject
                    </button>
                  </>
                )}

                {/* Cancellation (if approved) */}
                {event.status === 'approved' && (
                  <button
                    onClick={() => statusMutation.mutate({ id: event.id, status: 'cancelled' })}
                    className="p-2 bg-white border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-lg text-gray-500 transition-all shadow-sm text-xs font-semibold cursor-pointer"
                  >
                    Cancel Event
                  </button>
                )}

                {/* Delete */}
                <button
                  onClick={() => {
                    if (confirm('Are you sure you want to delete this event? This will also delete all registrations.')) {
                      deleteMutation.mutate(event.id);
                    }
                  }}
                  className="p-2 bg-white border border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 rounded-lg text-gray-400 transition-colors shadow-sm cursor-pointer"
                  title="Delete Event"
                >
                  <Trash2 size={14} />
                </button>

              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

export default AdminEventsPage;
