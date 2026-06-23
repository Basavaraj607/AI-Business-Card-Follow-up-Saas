// pages/ProfileSettingsPage.tsx
import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { createClient } from '../lib/supabase/client';
import { useAuth } from '../lib/auth-context';
import {
  User, Phone, FileText, Lock, Eye, EyeOff,
  Save, Loader2, ShieldCheck, Mail, PenLine,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Zod schemas ───────────────────────────────────────────────────────────────
const profileSchema = z.object({
  full_name: z.string().min(1, 'Full name is required').max(120, 'Too long'),
  sender_name: z.string().max(80, 'Display name too long').optional(),
  sender_phone: z
    .string()
    .optional()
    .refine(
      v => !v || /^\+?[0-9\s\-(). ]{7,20}$/.test(v),
      'Enter a valid phone number (e.g. +1 555 000 0000)'
    ),
  email_signature: z.string().max(500, 'Signature too long').optional(),
});

const passwordSchema = z
  .object({
    current_password: z.string().min(1, 'Current password is required'),
    new_password: z
      .string()
      .min(8, 'Must be at least 8 characters')
      .regex(/[A-Za-z]/, 'Must contain at least one letter')
      .regex(/[0-9]/, 'Must contain at least one number'),
    confirm_password: z.string().min(1, 'Please confirm your new password'),
  })
  .superRefine((data, ctx) => {
    if (data.new_password !== data.confirm_password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passwords do not match',
        path: ['confirm_password'],
      });
    }
  });

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

// ─── Module-level helper: validate and collect errors ─────────────────────────
function zodErrors<T>(schema: z.ZodType<T>, data: unknown): Record<string, string> {
  const result = schema.safeParse(data);
  if (result.success) return {};
  const out: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.');
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

// ─── Module-level sub-components (must NOT be defined inside parent) ──────────
type FieldProps = {
  label: string;
  id: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
};
function FormField({ label, id, error, hint, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <label htmlFor={id} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
      {error && <p className="text-xs text-red-500 mt-1 font-medium">{error}</p>}
    </div>
  );
}

type EyeToggleProps = { show: boolean; onToggle: () => void; labelledBy: string };
function EyeToggle({ show, onToggle, labelledBy }: EyeToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={show ? 'Hide password' : 'Show password'}
      aria-controls={labelledBy}
      tabIndex={-1}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer transition-colors"
    >
      {show ? <EyeOff size={15} /> : <Eye size={15} />}
    </button>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export function ProfileSettingsPage() {
  const { user, refreshProfile } = useAuth();
  const supabase = createClient();

  // ── Profile section ──────────────────────────────────────────────────────────
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileFieldErrors, setProfileFieldErrors] = useState<Record<string, string>>({});

  const profileForm = useForm<ProfileFormValues>({
    defaultValues: { full_name: '', sender_name: '', sender_phone: '', email_signature: '' },
  });

  // Populate form from DB on mount
  useEffect(() => {
    if (!user?.id) { setProfileLoading(false); return; }
    supabase
      .from('profiles')
      .select('full_name, sender_name, sender_phone, email_signature')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!error && data) {
          profileForm.reset({
            full_name: data.full_name ?? '',
            sender_name: data.sender_name ?? '',
            sender_phone: data.sender_phone ?? '',
            email_signature: data.email_signature ?? '',
          });
        }
        setProfileLoading(false);
      });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveProfile = profileForm.handleSubmit(async (values) => {
    const errs = zodErrors(profileSchema, values);
    if (Object.keys(errs).length) { setProfileFieldErrors(errs); return; }
    setProfileFieldErrors({});
    setProfileSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: values.full_name.trim(),
          sender_name: values.sender_name?.trim() || null,
          sender_phone: values.sender_phone?.trim() || null,
          email_signature: values.email_signature?.trim() || null,
        })
        .eq('id', user!.id);
      if (error) throw error;
      await refreshProfile();
      toast.success('Profile saved!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  });

  // ── Password section ─────────────────────────────────────────────────────────
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdFieldErrors, setPwdFieldErrors] = useState<Record<string, string>>({});
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const pwdForm = useForm<PasswordFormValues>({
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  });

  const handleChangePassword = pwdForm.handleSubmit(async (values) => {
    const errs = zodErrors(passwordSchema, values);
    if (Object.keys(errs).length) { setPwdFieldErrors(errs); return; }
    setPwdFieldErrors({});
    setPwdSaving(true);
    try {
      // Step 1: verify current password
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: values.current_password,
      });
      if (signInErr) {
        setPwdFieldErrors({ current_password: 'Current password is incorrect' });
        return;
      }
      // Step 2: set new password
      const { error: updateErr } = await supabase.auth.updateUser({
        password: values.new_password,
      });
      if (updateErr) throw updateErr;
      toast.success('Password changed successfully!', { icon: '🔐', duration: 5000 });
      pwdForm.reset();
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password');
    } finally {
      setPwdSaving(false);
    }
  });

  // ── Render ───────────────────────────────────────────────────────────────────
  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-7 h-7 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">

      {/* ── Card 1: Profile Information ── */}
      <section className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
            <User size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Profile Information</h2>
            <p className="text-xs text-gray-500">Update your name, phone and messaging identity</p>
          </div>
        </div>

        {/* Read-only email */}
        <div className="flex flex-col gap-0.5">
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5">
            <Mail size={12} className="text-gray-400" />
            Email Address
          </label>
          <div className="flex items-center gap-2 w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-500 cursor-not-allowed">
            <span className="truncate flex-1">{user?.email ?? '—'}</span>
            <span className="shrink-0 text-[10px] font-bold text-gray-400 bg-gray-200 px-2 py-0.5 rounded-full uppercase tracking-wide">
              Read-only
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Contact support to change your email.</p>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4" noValidate>
          <FormField label="Full Name" id="full_name" error={profileFieldErrors.full_name}>
            <div className="relative">
              <PenLine size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                id="full_name"
                type="text"
                autoComplete="name"
                placeholder="Your full name"
                className={`input pl-9 ${profileFieldErrors.full_name ? 'border-red-300 focus:border-red-400' : ''}`}
                {...profileForm.register('full_name')}
              />
            </div>
          </FormField>

          <FormField
            label="Display / Sender Name"
            id="sender_name"
            error={profileFieldErrors.sender_name}
            hint="Shown as the 'From' name on emails and messages"
          >
            <input
              id="sender_name"
              type="text"
              placeholder="e.g. Alex from Acme Corp"
              className={`input ${profileFieldErrors.sender_name ? 'border-red-300' : ''}`}
              {...profileForm.register('sender_name')}
            />
          </FormField>

          <FormField
            label="Phone Number"
            id="sender_phone"
            error={profileFieldErrors.sender_phone}
            hint="E.164 format recommended (e.g. +1 555 000 0000) — used for SMS/WhatsApp"
          >
            <div className="relative">
              <Phone size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                id="sender_phone"
                type="tel"
                autoComplete="tel"
                placeholder="+1 555 000 0000"
                className={`input pl-9 ${profileFieldErrors.sender_phone ? 'border-red-300' : ''}`}
                {...profileForm.register('sender_phone')}
              />
            </div>
          </FormField>

          <FormField
            label="Email Signature"
            id="email_signature"
            error={profileFieldErrors.email_signature}
            hint="Automatically appended to outbound follow-up emails"
          >
            <div className="relative">
              <FileText size={13} className="absolute left-3 top-3 text-gray-400 pointer-events-none" />
              <textarea
                id="email_signature"
                rows={3}
                placeholder={"Best regards,\nYour Name\nCompany · website.com"}
                className={`input pl-9 resize-none ${profileFieldErrors.email_signature ? 'border-red-300' : ''}`}
                {...profileForm.register('email_signature')}
              />
            </div>
          </FormField>

          <button
            type="submit"
            disabled={profileSaving}
            className="btn-primary rounded-xl px-5 py-2.5 text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
          >
            {profileSaving
              ? <><Loader2 size={15} className="animate-spin" /> Saving…</>
              : <><Save size={15} /> Save Profile</>
            }
          </button>
        </form>
      </section>

      {/* ── Card 2: Change Password ── */}
      <section className="bg-white border border-gray-100 rounded-xl shadow-sm p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Lock size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900">Change Password</h2>
            <p className="text-xs text-gray-500">Verify your current password, then set a new one</p>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2.5 p-3 bg-blue-50 border border-blue-100 rounded-lg">
          <ShieldCheck size={14} className="text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-700 leading-relaxed">
            Your current password is verified before applying any change.
            New password must be <strong>at least 8 characters</strong> with at least one <strong>letter</strong> and one <strong>number</strong>.
          </p>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
          <FormField label="Current Password" id="current_password" error={pwdFieldErrors.current_password}>
            <div className="relative">
              <input
                id="current_password"
                type={showCurrent ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="Your current password"
                className={`input pr-10 ${pwdFieldErrors.current_password ? 'border-red-300 focus:border-red-400' : ''}`}
                {...pwdForm.register('current_password')}
              />
              <EyeToggle show={showCurrent} onToggle={() => setShowCurrent(v => !v)} labelledBy="current_password" />
            </div>
          </FormField>

          <FormField
            label="New Password"
            id="new_password"
            error={pwdFieldErrors.new_password}
            hint="Minimum 8 characters, at least one letter and one number"
          >
            <div className="relative">
              <input
                id="new_password"
                type={showNew ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="New password"
                className={`input pr-10 ${pwdFieldErrors.new_password ? 'border-red-300' : ''}`}
                {...pwdForm.register('new_password')}
              />
              <EyeToggle show={showNew} onToggle={() => setShowNew(v => !v)} labelledBy="new_password" />
            </div>
          </FormField>

          <FormField label="Confirm New Password" id="confirm_password" error={pwdFieldErrors.confirm_password}>
            <div className="relative">
              <input
                id="confirm_password"
                type={showConfirm ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Repeat new password"
                className={`input pr-10 ${pwdFieldErrors.confirm_password ? 'border-red-300' : ''}`}
                {...pwdForm.register('confirm_password')}
              />
              <EyeToggle show={showConfirm} onToggle={() => setShowConfirm(v => !v)} labelledBy="confirm_password" />
            </div>
          </FormField>

          <button
            type="submit"
            disabled={pwdSaving}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            {pwdSaving
              ? <><Loader2 size={15} className="animate-spin" /> Verifying &amp; Updating…</>
              : <><Lock size={15} /> Change Password</>
            }
          </button>
        </form>
      </section>
    </div>
  );
}

export default ProfileSettingsPage;
