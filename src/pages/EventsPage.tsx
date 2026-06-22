// pages/EventsPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { createClient } from '../lib/supabase/client';
import { useAuth } from '../lib/auth-context';
import { 
  Calendar, MapPin, Clock, Plus, Info, 
  CheckCircle, XCircle, AlertCircle, CalendarRange
} from 'lucide-react';
import toast from 'react-hot-toast';
import { EventCreateEditForm } from '../components/events/EventCreateEditForm';

interface Event {
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
  approved_by?: string;
  created_at: string;
}

interface Registration {
  id: string;
  event_id: string;
  user_id: string;
  registration_status: 'registered' | 'cancelled';
  registered_by: string;
}

export function EventsPage() {
  const { user, tenantId } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'events' | 'registrations' | 'my-events' | 'request'>('events');

  const supabase = createClient();

  // 1. Fetch Events — GLOBAL: all approved events regardless of tenant.
  //    A user's own pending/rejected submissions are also returned by RLS.
  const { data: events = [], isLoading: loadingEvents } = useQuery<Event[]>({
    queryKey: ['events', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('start_time', { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // 2. Fetch Current User's Registrations — cross-tenant: the user may have
  //    registered for events from any tenant, so filter only by user_id.
  const { data: registrations = [], isLoading: loadingRegs } = useQuery<Registration[]>({
    queryKey: ['registrations', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('event_registrations')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // 3. Process In-app Toast Notifications for user-submitted events
  useEffect(() => {
    if (!user?.id || events.length === 0) return;

    const unnotifiedSubmissions = events.filter(
      e => e.created_by === user.id && 
           e.notified === false && 
           (e.status === 'approved' || e.status === 'rejected')
    );

    if (unnotifiedSubmissions.length > 0) {
      unnotifiedSubmissions.forEach(async (event) => {
        if (event.status === 'approved') {
          toast.success(`Your submitted event "${event.title}" has been approved and published!`, {
            duration: 6000,
            icon: '🎉'
          });
        } else if (event.status === 'rejected') {
          toast.error(`Your event request "${event.title}" was declined by the admin.`, {
            duration: 6000
          });
        }

        // Call RPC function to mark as notified securely
        try {
          const { error } = await supabase.rpc('mark_event_notified', { target_event_id: event.id });
          if (error) console.error('Error marking event notified:', error);
          
          // Instantly refresh query cache locally for notified status
          queryClient.setQueryData(['events', user?.id], (oldEvents: Event[] | undefined) => {
            if (!oldEvents) return [];
            return oldEvents.map(old => old.id === event.id ? { ...old, notified: true } : old);
          });
        } catch (rpcErr) {
          console.warn('RPC notification trigger failed:', rpcErr);
        }
      });
    }
  }, [events, user?.id, tenantId, queryClient, supabase]);

  // 4. Mutations for Registration / Cancellation
  const registerMutation = useMutation({
    mutationFn: async (eventId: string) => {
      if (!user?.id || !tenantId) throw new Error('Authentication required');

      // Check if registration record already exists (could be cancelled)
      const existing = registrations.find(r => r.event_id === eventId);

      if (existing) {
        // Reactivate registration
        const { error } = await supabase
          .from('event_registrations')
          .update({ registration_status: 'registered', registered_by: 'self' })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Create new registration
        const { error } = await supabase
          .from('event_registrations')
          .insert({
            tenant_id: tenantId,
            event_id: eventId,
            user_id: user.id,
            registration_status: 'registered',
            registered_by: 'self'
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Successfully registered for event!');
      queryClient.invalidateQueries({ queryKey: ['registrations', user?.id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to register');
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (registrationId: string) => {
      const { error } = await supabase
        .from('event_registrations')
        .update({ registration_status: 'cancelled' })
        .eq('id', registrationId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Registration cancelled successfully.');
      queryClient.invalidateQueries({ queryKey: ['registrations', user?.id] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to cancel registration');
    }
  });

  // Helper: format datetime to local string
  const formatEventDate = (startStr: string, endStr: string) => {
    const start = new Date(startStr);
    const end = new Date(endStr);

    const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };

    const startDateStr = start.toLocaleDateString(undefined, dateOptions);
    const startTimeStr = start.toLocaleTimeString(undefined, timeOptions);
    const endTimeStr = end.toLocaleTimeString(undefined, timeOptions);

    if (start.toDateString() === end.toDateString()) {
      return `${startDateStr} · ${startTimeStr} - ${endTimeStr}`;
    } else {
      const endDateStr = end.toLocaleDateString(undefined, dateOptions);
      return `${startDateStr} (${startTimeStr}) to ${endDateStr} (${endTimeStr})`;
    }
  };

  // Helper: Banner URL resolver
  const getBannerUrl = (path?: string) => {
    if (!path) return '';
    const { data } = supabase.storage.from('event-banners').getPublicUrl(path);
    return data.publicUrl;
  };

  // 5. Categorize events for the tabs
  const registeredEventIds = new Set(
    registrations
      .filter(r => r.registration_status === 'registered')
      .map(r => r.event_id)
  );

  const upcomingEvents = events.filter(
    e => e.status === 'approved' && 
         new Date(e.end_time) > new Date() && 
         !registeredEventIds.has(e.id)
  );

  const myEvents = events.filter(
    e => e.status === 'approved' && 
         registeredEventIds.has(e.id)
  );

  const mySubmissions = events.filter(
    e => e.created_by === user?.id
  );

  const isLoading = loadingEvents || loadingRegs;

  return (
    <div className="space-y-6">
      
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 font-display">Events Directory</h1>
          <p className="text-xs text-gray-500 mt-1">
            Discover conferences, match opportunities, and coordinate team event operations.
          </p>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-gray-100">
        {(['events', 'registrations', 'my-events', 'request'] as const).map(tab => {
          let label = '';
          if (tab === 'events') label = 'Events';
          else if (tab === 'registrations') label = 'My Registrations';
          else if (tab === 'my-events') label = 'My Events';
          else if (tab === 'request') label = 'Request Event';
          
          const isActive = activeTab === tab;
          
          let count = 0;
          if (tab === 'events') count = upcomingEvents.length;
          else if (tab === 'registrations') count = myEvents.length;
          else if (tab === 'my-events') count = mySubmissions.length;

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-4 text-xs font-semibold border-b-2 transition-all relative cursor-pointer
                ${isActive 
                  ? 'border-brand-500 text-brand-600 font-bold' 
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'}`}
            >
              {label}
              {count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Content Listing */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="spinner border-brand-400 border-t-white" />
        </div>
      ) : (
        <>
          {activeTab === 'request' ? (
            <div className="max-w-xl mx-auto bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-500 flex items-center justify-center">
                  <CalendarRange size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-gray-900">Suggest a New Event</h2>
                  <p className="text-xs text-gray-500">
                    Submit details for conferences, networking events, or summits.
                  </p>
                </div>
              </div>
              
              <div className="p-3.5 bg-amber-50/50 border border-amber-100/50 rounded-xl mb-6">
                <p className="text-[11px] text-amber-700 leading-normal font-medium">
                  <strong>Note:</strong> User-submitted events will enter a <strong>Pending Review</strong> status. Once a tenant admin reviews and approves it, it will be published to the entire workspace directory.
                </p>
              </div>

              <EventCreateEditForm 
                isUserSubmission={true}
                onSubmitSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['events', user?.id] });
                  setActiveTab('my-events');
                }}
                onCancel={() => {
                  setActiveTab('events');
                }}
              />
            </div>
          ) : (
            <>
              {activeTab === 'events' && upcomingEvents.length === 0 && (
                <div className="text-center py-16 bg-white border border-gray-100 rounded-2xl p-8 flex flex-col items-center justify-center gap-3">
                  <CalendarRange size={40} className="text-gray-300" />
                  <h3 className="font-semibold text-gray-800 text-sm">No upcoming events</h3>
                  <p className="text-xs text-gray-400 max-w-xs">
                    There are no published events in your workspace. Check back later or suggest an event.
                  </p>
                </div>
              )}

              {activeTab === 'registrations' && myEvents.length === 0 && (
                <div className="text-center py-16 bg-white border border-gray-100 rounded-2xl p-8 flex flex-col items-center justify-center gap-3">
                  <CalendarRange size={40} className="text-gray-300" />
                  <h3 className="font-semibold text-gray-800 text-sm">No registered events</h3>
                  <p className="text-xs text-gray-400 max-w-xs">
                    You haven't registered for any events yet. Check out the "Events" tab!
                  </p>
                </div>
              )}

              {activeTab === 'my-events' && mySubmissions.length === 0 && (
                <div className="text-center py-16 bg-white border border-gray-100 rounded-2xl p-8 flex flex-col items-center justify-center gap-3">
                  <CalendarRange size={40} className="text-gray-300" />
                  <h3 className="font-semibold text-gray-800 text-sm">No event submissions</h3>
                  <p className="text-xs text-gray-400 max-w-xs">
                    You haven't suggested any events. Click the "Request Event" tab to submit a new event request!
                  </p>
                </div>
              )}

              {/* Cards Grid */}
              {((activeTab === 'events' && upcomingEvents.length > 0) ||
                (activeTab === 'registrations' && myEvents.length > 0) ||
                (activeTab === 'my-events' && mySubmissions.length > 0)) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {(activeTab === 'events' ? upcomingEvents : activeTab === 'registrations' ? myEvents : mySubmissions).map(event => {
                    const userReg = registrations.find(r => r.event_id === event.id);
                    const isRegistered = userReg?.registration_status === 'registered';
                    
                    return (
                      <div 
                        key={event.id}
                        className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                      >
                        {/* Event Top Banner */}
                        <div>
                          {event.banner_image_path ? (
                            <div className="h-44 w-full bg-gray-100 overflow-hidden relative border-b border-gray-50">
                              <img 
                                src={getBannerUrl(event.banner_image_path)} 
                                alt={event.title} 
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="h-32 w-full bg-brand-50 flex items-center justify-center border-b border-gray-50 shrink-0">
                              <Calendar size={32} className="text-brand-300" />
                            </div>
                          )}

                          {/* Event Info Details */}
                          <div className="p-5 space-y-3">
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="font-bold text-gray-900 text-sm tracking-tight leading-snug line-clamp-2">
                                {event.title}
                              </h3>
                              
                              {/* Status Badges for submissions */}
                              {activeTab === 'my-events' && (
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shrink-0
                                  ${event.status === 'approved' ? 'bg-green-50 text-green-700 border border-green-200' :
                                    event.status === 'pending' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                                    event.status === 'rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                                    'bg-gray-50 text-gray-700 border border-gray-200'}`}
                                >
                                  {event.status === 'approved' ? 'Approved' :
                                   event.status === 'pending' ? 'Pending Review' :
                                   event.status === 'rejected' ? 'Rejected' :
                                   event.status}
                                </span>
                              )}
                            </div>

                            {event.description && (
                              <p className="text-xs text-gray-500 line-clamp-3">
                                {event.description}
                              </p>
                            )}

                            <div className="space-y-1.5 pt-2">
                              <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                                <Clock size={13} className="text-gray-400 shrink-0" />
                                <span>{formatEventDate(event.start_time, event.end_time)}</span>
                              </div>
                              <div className="flex items-center gap-2 text-xs text-gray-600 font-medium">
                                <MapPin size={13} className="text-gray-400 shrink-0" />
                                <span className="truncate">{event.location}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions Bar */}
                        <div className="px-5 pb-5 pt-2 border-t border-gray-50 flex items-center justify-between gap-3 bg-gray-50/20 shrink-0">
                          <div className="flex items-center gap-1.5">
                            {isRegistered && activeTab !== 'my-events' && (
                              <span className="inline-flex items-center gap-1 text-xs text-brand-600 font-bold bg-brand-50 px-2.5 py-1 rounded-lg">
                                <CheckCircle size={12} />
                                Registered
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {activeTab === 'events' && (
                              <button
                                onClick={() => registerMutation.mutate(event.id)}
                                disabled={registerMutation.isPending}
                                className="px-4 py-2 bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow active:scale-97 transition-all cursor-pointer"
                              >
                                Register
                              </button>
                            )}

                            {activeTab === 'registrations' && isRegistered && (
                              <button
                                onClick={() => {
                                  if (userReg) cancelMutation.mutate(userReg.id);
                                }}
                                disabled={cancelMutation.isPending}
                                className="px-3 py-2 bg-white border border-gray-200 text-red-600 hover:bg-red-50 hover:border-red-200 text-xs font-semibold rounded-lg shadow-sm active:scale-97 transition-all cursor-pointer"
                              >
                                Cancel Registration
                              </button>
                            )}
                          </div>
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}

    </div>
  );
}

export default EventsPage;
