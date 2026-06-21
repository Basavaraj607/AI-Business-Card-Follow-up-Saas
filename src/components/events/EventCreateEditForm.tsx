// components/events/EventCreateEditForm.tsx
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import imageCompression from 'browser-image-compression';
import { createClient } from '../../lib/supabase/client';
import { useAuth } from '../../lib/auth-context';
import { 
  Calendar, MapPin, AlignLeft, Image as ImageIcon, 
  Clock, Save, X, AlertCircle, Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface EventFormValues {
  title: string;
  description?: string;
  location: string;
  start_time: string;
  end_time: string;
  requires_approval: boolean;
}

interface Props {
  initialData?: {
    id: string;
    title: string;
    description?: string;
    location: string;
    start_time: string;
    end_time: string;
    banner_image_path?: string;
    requires_approval: boolean;
  };
  onSubmitSuccess: () => void;
  onCancel?: () => void;
  isUserSubmission?: boolean;
}

export function EventCreateEditForm({ initialData, onSubmitSuccess, onCancel, isUserSubmission = false }: Props) {
  const { user, tenantId, role, userType } = useAuth();
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [eventId] = useState(() => initialData?.id || crypto.randomUUID());
  
  const isAdmin = role === 'admin' || role === 'owner' || userType === 'superadmin';

  // Format datetimes to match local datetime-local inputs (yyyy-MM-ddThh:mm)
  const formatDatetimeForInput = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
    return localISOTime;
  };

  const { register, handleSubmit, formState: { errors }, watch } = useForm<EventFormValues>({
    defaultValues: {
      title: initialData?.title || '',
      description: initialData?.description || '',
      location: initialData?.location || '',
      start_time: formatDatetimeForInput(initialData?.start_time),
      end_time: formatDatetimeForInput(initialData?.end_time),
      requires_approval: initialData?.requires_approval || false,
    }
  });

  const supabase = createClient();

  useEffect(() => {
    // If we have an existing banner path, get the public URL to show preview
    if (initialData?.banner_image_path) {
      const { data } = supabase.storage.from('event-banners').getPublicUrl(initialData.banner_image_path);
      setBannerPreview(data.publicUrl);
    }
  }, [initialData?.banner_image_path, supabase]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show instant local preview
    setBannerPreview(URL.createObjectURL(file));
    setBannerFile(file);
  };

  const onSubmit = async (values: EventFormValues) => {
    if (!user || !tenantId) {
      toast.error('You must be logged in to manage events');
      return;
    }

    setSubmitting(true);
    let bannerPath = initialData?.banner_image_path || null;

    try {
      // 1. Upload banner if a new one is selected
      if (bannerFile) {
        setUploadingImage(true);
        // Compress image client side
        const compressed = await imageCompression(bannerFile, {
          maxSizeMB: 1.0,
          maxWidthOrHeight: 1200,
          useWebWorker: true
        });

        // Path scoped strictly to tenant_id/event_id/filename
        const fileExt = bannerFile.name.split('.').pop() || 'jpg';
        const fileName = `banner-${Date.now()}.${fileExt}`;
        const uploadPath = `${tenantId}/${eventId}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('event-banners')
          .upload(uploadPath, compressed, { upsert: true });

        if (uploadError) {
          throw new Error(`Failed to upload event banner: ${uploadError.message}`);
        }
        bannerPath = uploadPath;
        setUploadingImage(false);
      }

      // 2. Insert or Update event record
      const eventPayload = {
        id: eventId,
        tenant_id: tenantId,
        title: values.title,
        description: values.description || null,
        location: values.location,
        start_time: new Date(values.start_time).toISOString(),
        end_time: new Date(values.end_time).toISOString(),
        banner_image_path: bannerPath,
        requires_approval: values.requires_approval,
        // Regular user submissions default to 'pending', admins default to 'approved'
        status: initialData?.id 
          ? undefined // Maintain current status on edit unless changed by moderation
          : (isUserSubmission ? 'pending' : 'approved'),
        created_by: initialData ? undefined : user.id, // Set creator only on insert
        updated_at: new Date().toISOString()
      };

      const query = initialData?.id
        ? supabase.from('events').update(eventPayload).eq('id', initialData.id)
        : supabase.from('events').insert(eventPayload);

      const { error } = await query;
      if (error) throw error;

      toast.success(
        initialData?.id
          ? 'Event updated successfully!'
          : isUserSubmission
            ? 'Event request submitted for approval!'
            : 'Event created and published!'
      );
      
      onSubmitSuccess();
    } catch (err: any) {
      console.error('Error saving event:', err);
      toast.error(err.message || 'Failed to save event');
    } finally {
      setUploadingImage(false);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 text-gray-800">
      
      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
          <Calendar size={13} className="text-gray-400" />
          Event Title
        </label>
        <input
          {...register('title', {
            required: 'Title is required',
            minLength: { value: 3, message: 'Title must be at least 3 characters' }
          })}
          type="text"
          placeholder="e.g. Annual Tech Conference 2026"
          className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-gray-50/20
                     focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 transition-all font-medium"
        />
        {errors.title && (
          <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
            <AlertCircle size={12} /> {errors.title.message}
          </p>
        )}
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
          <AlignLeft size={13} className="text-gray-400" />
          Description
        </label>
        <textarea
          {...register('description')}
          placeholder="What is this event about? Highlights, tracks, target audience?"
          rows={3}
          className="w-full text-sm border border-gray-200 rounded-xl p-3 resize-none bg-gray-50/20
                     focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 transition-all"
        />
      </div>

      {/* Location */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
          <MapPin size={13} className="text-gray-400" />
          Location / Venue
        </label>
        <input
          {...register('location', {
            required: 'Location is required',
            minLength: { value: 3, message: 'Location must be at least 3 characters' }
          })}
          type="text"
          placeholder="e.g. San Francisco Civic Center / Zoom Link"
          className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-gray-50/20
                     focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 transition-all font-medium"
        />
        {errors.location && (
          <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
            <AlertCircle size={12} /> {errors.location.message}
          </p>
        )}
      </div>

      {/* Start / End Datetimes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
            <Clock size={13} className="text-gray-400" />
            Start Time
          </label>
          <input
            {...register('start_time', {
              required: 'Start time is required'
            })}
            type="datetime-local"
            className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-gray-50/20
                       focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 transition-all font-medium"
          />
          {errors.start_time && (
            <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
              <AlertCircle size={12} /> {errors.start_time.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
            <Clock size={13} className="text-gray-400" />
            End Time
          </label>
          <input
            {...register('end_time', {
              required: 'End time is required',
              validate: (val) => {
                const start = watch('start_time');
                if (start && new Date(val) <= new Date(start)) {
                  return 'End time must be after start time';
                }
                return true;
              }
            })}
            type="datetime-local"
            className="w-full text-sm border border-gray-200 rounded-xl p-3 bg-gray-50/20
                       focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400/20 transition-all font-medium"
          />
          {errors.end_time && (
            <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
              <AlertCircle size={12} /> {errors.end_time.message}
            </p>
          )}
        </div>
      </div>

      {/* Banner Upload */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-gray-500 flex items-center gap-1.5">
          <ImageIcon size={13} className="text-gray-400" />
          Event Banner Image
        </label>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 border border-gray-200 border-dashed rounded-xl p-4 bg-gray-50/10">
          {bannerPreview ? (
            <div className="relative w-full sm:w-36 aspect-video sm:h-20 rounded-lg overflow-hidden border border-gray-100 shadow-sm shrink-0 bg-black">
              <img src={bannerPreview} alt="Banner preview" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => { setBannerPreview(null); setBannerFile(null); }}
                className="absolute top-1 right-1 p-1 bg-black/60 rounded-full text-white hover:bg-black/80 transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          ) : (
            <div className="w-full sm:w-36 aspect-video sm:h-20 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-300 shrink-0">
              <ImageIcon size={24} />
            </div>
          )}

          <div className="text-center sm:text-left min-w-0 flex-1">
            <input
              type="file"
              accept="image/*"
              id="banner-upload"
              onChange={handleImageChange}
              className="hidden"
            />
            <label
              htmlFor="banner-upload"
              className="inline-block px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg text-xs font-semibold shadow-sm cursor-pointer transition-all active:scale-[0.98]"
            >
              Choose Image
            </label>
            <p className="text-[10px] text-gray-400 mt-1">
              Supports JPEG, PNG up to 10MB (will be auto-compressed)
            </p>
          </div>
        </div>
      </div>

      {/* Requires Approval (Admin-only Future-proof Setting) */}
      {isAdmin && !isUserSubmission && (
        <div className="flex items-center gap-2 border border-gray-100 rounded-xl p-3 bg-gray-50/10">
          <input
            {...register('requires_approval')}
            type="checkbox"
            id="requires_approval"
            className="rounded text-brand-500 focus:ring-brand-400"
          />
          <label htmlFor="requires_approval" className="text-xs font-semibold text-gray-600 cursor-pointer">
            Requires Registration Approval (Future-proofing setting)
          </label>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-xl text-sm font-semibold transition-all active:scale-[0.99] cursor-pointer text-center"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={submitting || uploadingImage}
          className="flex-1 py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50 transition-all duration-150 active:scale-[0.99] cursor-pointer"
        >
          {submitting || uploadingImage ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              {uploadingImage ? 'Uploading Image...' : 'Saving Event...'}
            </>
          ) : (
            <>
              <Save size={16} />
              {initialData?.id ? 'Update Event' : isUserSubmission ? 'Submit Event' : 'Publish Event'}
            </>
          )}
        </button>
      </div>
      
    </form>
  );
}

export default EventCreateEditForm;
