import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { CreditCard, Mail, Globe, ArrowRight, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/auth-context'

export function LoginPage() {
  const { user, loading, signInWithGoogle, signInWithMagicLink, signInWithMock } = useAuth()
  const [email, setEmail] = useState('')
  const [emailSent, setEmailSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/dashboard" replace />

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setSubmitting(true)
    try {
      await signInWithMagicLink(email)
      setEmailSent(true)
      toast.success('Magic link sent! Check your inbox.')
    } catch (err) {
      console.warn('Supabase sign-in failed, logging in locally:', err)
      toast('Database error/SMTP issue detected. Logging in locally...', { icon: '💾' })
      signInWithMock(email)
    } finally {
      setSubmitting(false)
    }
  }

  const handleGoogle = async () => {
    try {
      await signInWithGoogle()
    } catch {
      toast.error('Google sign-in failed.')
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — branding */}
      <div className="hidden lg:flex w-1/2 bg-brand-400 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <CreditCard size={20} className="text-white" />
          </div>
          <span className="text-white font-semibold text-lg">CardFollowup</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Turn business cards into<br />lasting relationships.
          </h1>
          <p className="text-brand-100 text-lg leading-relaxed">
            Snap a card. AI extracts the contact. Personalized follow-ups go out automatically.
          </p>
          <div className="mt-10 space-y-4">
            {[
              'AI-powered OCR extraction',
              'Personalized email, WhatsApp & SMS',
              'Automated follow-up sequences',
              'CRM timeline per contact',
            ].map(feat => (
              <div key={feat} className="flex items-center gap-3 text-white/90 text-sm">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                  <ArrowRight size={11} className="text-white" />
                </div>
                {feat}
              </div>
            ))}
          </div>
        </div>
        <p className="text-brand-100 text-sm">
          Free forever for solo users. No credit card required.
        </p>
      </div>

      {/* Right — auth form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <div className="w-8 h-8 rounded-lg bg-brand-400 flex items-center justify-center">
              <CreditCard size={16} className="text-white" />
            </div>
            <span className="font-semibold text-gray-900">CardFollowup</span>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
          <p className="text-gray-500 text-sm mb-8">Sign in to your workspace</p>

          {emailSent ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
                <Mail size={24} className="text-brand-400" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Check your email</h3>
              <p className="text-sm text-gray-500 mb-6">
                We sent a magic link to <strong>{email}</strong>
              </p>
              <button
                onClick={() => setEmailSent(false)}
                className="text-sm text-brand-600 hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <>
              {/* Google */}
              <button onClick={handleGoogle} className="btn-secondary w-full mb-4 py-2.5">
                <Globe size={18} className="text-gray-500" />
                Continue with Google
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">or</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Magic link */}
              <form onSubmit={handleMagicLink} className="space-y-3">
                <div className="input-group">
                  <label className="input-label" htmlFor="email">Email address</label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="input"
                    required
                    autoFocus
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary w-full py-2.5"
                  disabled={submitting || !email.trim()}
                >
                  {submitting ? (
                    <><div className="spinner spinner-sm border-white/30 border-t-white" /> Sending…</>
                  ) : (
                    <>Continue with email <ArrowRight size={16} /></>
                  )}
                </button>
              </form>

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400">or</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Bypass button for local testing */}
              <button
                type="button"
                onClick={() => {
                  signInWithMock(email || 'tester@example.com');
                  toast.success('Logged in with local testing account');
                }}
                className="w-full btn bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 py-2.5 flex items-center justify-center gap-2"
              >
                <Sparkles size={16} className="text-brand-500" />
                Bypass Auth (Local Testing)
              </button>
            </>
          )}

          <p className="text-xs text-gray-400 text-center mt-8">
            By continuing, you agree to our{' '}
            <a href="#" className="underline hover:text-gray-600">Terms</a> and{' '}
            <a href="#" className="underline hover:text-gray-600">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  )
}
