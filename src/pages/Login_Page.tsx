import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { 
  CreditCard, Mail, Globe, ArrowRight, Sparkles, 
  User, Lock, Phone, Building, ArrowLeft, Eye, EyeOff
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/lib/auth-context'

export function LoginPage() {
  const { 
    user, 
    loading, 
    signInWithGoogle, 
    signUpWithPassword,
    signInWithPassword,
    signInWithMock 
  } = useAuth()

  const [mode, setMode] = useState<'login' | 'register'>('login')
  
  // Login fields
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPassword, setShowLoginPassword] = useState(false)

  // Register fields
  const [regFirstName, setRegFirstName] = useState('')
  const [regLastName, setRegLastName] = useState('')
  const [regEmail, setRegEmail] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regConfirmPassword, setRegConfirmPassword] = useState('')
  const [regCompany, setRegCompany] = useState('')
  const [showRegPassword, setShowRegPassword] = useState(false)

  const [submitting, setSubmitting] = useState(false)

  if (!loading && user) return <Navigate to="/dashboard" replace />

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!loginEmail.trim() || !loginPassword) return
    setSubmitting(true)
    try {
      await signInWithPassword(loginEmail, loginPassword)
      toast.success('Successfully logged in!')
    } catch (err: any) {
      console.warn('Supabase login failed:', err)
      const errorMsg = err?.message || 'Login failed. Please verify your credentials.'
      toast.error(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (
      !regFirstName.trim() || 
      !regLastName.trim() || 
      !regEmail.trim() || 
      !regPhone.trim() || 
      !regPassword || 
      !regConfirmPassword ||
      !regCompany.trim()
    ) {
      toast.error('Please fill in all fields.')
      return
    }

    if (regPassword !== regConfirmPassword) {
      toast.error('Passwords do not match.')
      return
    }

    if (regPassword.length < 6) {
      toast.error('Password must be at least 6 characters.')
      return
    }

    setSubmitting(true)
    try {
      const data = await signUpWithPassword(regEmail, regPassword, regFirstName, regLastName, regPhone, regCompany)
      
      // If the email confirmation is disabled, user is immediately logged in
      if (data?.session) {
        toast.success('Account created and logged in!')
      } else {
        toast.success('Registration successful! Please check your email for a verification link, then log in.')
        setMode('login')
        setLoginEmail(regEmail)
      }
    } catch (err: any) {
      console.warn('Supabase sign up failed:', err)
      toast.error(err?.message || 'Registration failed. Please try again.')
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
    <div className="min-h-screen flex bg-gray-50/50">
      {/* Left panel - Branding & Product Value Props */}
      <div className="hidden lg:flex w-1/2 bg-gradient-to-tr from-brand-600 to-brand-800 flex-col justify-between p-12 relative overflow-hidden">
        {/* Subtle background glow elements */}
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] rounded-full bg-white/5 blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] rounded-full bg-white/5 blur-3xl" />

        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md">
            <CreditCard size={20} className="text-white" />
          </div>
          <span className="text-white font-bold text-xl tracking-tight">CardFollowup</span>
        </div>

        <div className="my-auto relative z-10 max-w-lg">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full bg-white/10 text-white backdrop-blur-md mb-6">
            <Sparkles size={12} className="text-brand-100" />
            Empowered by Gemini 2.5 Flash
          </span>
          <h1 className="text-4xl font-extrabold text-white leading-[1.2] mb-6 tracking-tight">
            Turn business cards into<br />active relationships.
          </h1>
          <p className="text-brand-100 text-lg leading-relaxed mb-10 font-medium">
            Scan business cards seamlessly. Extract accurate details with advanced multimodal vision, and instantly build authentic, personalized follow-ups.
          </p>

          <div className="space-y-4">
            {[
              { title: 'Multimodal Vision Scanner', desc: 'No-OCR bypass uses Gemini directly for maximum accuracy' },
              { title: 'Authentic Email Generator', desc: 'Creates personalized follow-ups that sound organic and real' },
              { title: 'Full Contact History', desc: 'Timeline view tracking statuses, notes, and previous messages' }
            ].map((feat, idx) => (
              <div key={idx} className="flex gap-4 p-4 rounded-xl bg-white/5 backdrop-blur-sm border border-white/10">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                  0{idx + 1}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{feat.title}</h4>
                  <p className="text-xs text-brand-100/80 mt-0.5">{feat.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between items-center relative z-10 pt-6 border-t border-white/10">
          <p className="text-brand-100 text-xs font-semibold">
            Solo Plan is Free Forever
          </p>
          <span className="text-brand-100/50 text-xs">v1.2.0</span>
        </div>
      </div>

      {/* Right panel - Auth Forms */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-xl p-8 sm:p-10 transition-all duration-300 page-enter">
          
          {/* Mobile brand header */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center shadow-md">
              <CreditCard size={18} className="text-white" />
            </div>
            <span className="font-bold text-xl text-gray-900 tracking-tight">CardFollowup</span>
          </div>

          {/* Form Tabs */}
          <div className="flex bg-gray-50 p-1.5 rounded-xl border border-gray-100 mb-8">
            <button 
              onClick={() => setMode('login')} 
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-150 cursor-pointer ${mode === 'login' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Sign In
            </button>
            <button 
              onClick={() => setMode('register')} 
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-150 cursor-pointer ${mode === 'register' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}
            >
              Register
            </button>
          </div>

          {/* Login Form View */}
          {mode === 'login' && (
            <div>
              <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-1.5">Welcome back</h2>
              <p className="text-gray-500 text-sm mb-6 font-medium">Access your personal workspace</p>

              <button 
                onClick={handleGoogle} 
                className="w-full btn bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 py-3 flex items-center justify-center gap-2 rounded-xl text-sm font-semibold shadow-sm hover:border-gray-300"
              >
                <Globe size={18} className="text-gray-500" />
                Sign in with Google
              </button>

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="input-group">
                  <label className="input-label" htmlFor="email">Email address</label>
                  <div className="relative">
                    <input
                      id="email"
                      type="email"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="input pl-10 py-3 rounded-xl border-gray-200"
                      required
                    />
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>

                <div className="input-group">
                  <div className="flex justify-between items-center mb-0.5">
                    <label className="input-label mb-0" htmlFor="password">Password</label>
                    <a href="#" className="text-xs font-semibold text-brand hover:underline">Forgot?</a>
                  </div>
                  <div className="relative">
                    <input
                      id="password"
                      type={showLoginPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="input pl-10 pr-10 py-3 rounded-xl border-gray-200"
                      required
                    />
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <button
                      type="button"
                      onClick={() => setShowLoginPassword(!showLoginPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full py-3 mt-4 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all"
                  disabled={submitting}
                >
                  {submitting ? (
                    <><div className="spinner spinner-sm border-white/30 border-t-white" /> Signing in…</>
                  ) : (
                    <>Sign In</>
                  )}
                </button>
              </form>

              <div className="flex items-center gap-3 my-6">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs text-gray-400 font-bold uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              {/* Developer local testing bypass */}
              <button
                type="button"
                onClick={() => {
                  signInWithMock(loginEmail || 'tester@example.com');
                  toast.success('Logged in with local testing account');
                }}
                className="w-full btn bg-brand-50 hover:bg-brand-100 text-brand border border-brand-200 py-3 flex items-center justify-center gap-2 rounded-xl font-bold transition-all shadow-sm"
              >
                <Sparkles size={16} className="text-brand-500 animate-pulse" />
                Bypass Auth (Local Testing)
              </button>
            </div>
          )}

          {/* Registration Form View */}
          {mode === 'register' && (
            <div className="page-enter">
              <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-1.5">Create account</h2>
              <p className="text-gray-500 text-sm mb-6 font-medium">Get started with business card scans</p>

              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="input-group">
                    <label className="input-label" htmlFor="firstName">First name</label>
                    <div className="relative">
                      <input
                        id="firstName"
                        type="text"
                        value={regFirstName}
                        onChange={e => setRegFirstName(e.target.value)}
                        placeholder="John"
                          className="input pl-10 py-2.5 rounded-xl border-gray-200"
                        required
                      />
                      <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="input-label" htmlFor="lastName">Last name</label>
                    <input
                      id="lastName"
                      type="text"
                      value={regLastName}
                      onChange={e => setRegLastName(e.target.value)}
                      placeholder="Doe"
                      className="input py-2.5 rounded-xl border-gray-200"
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label" htmlFor="regEmail">Email address</label>
                  <div className="relative">
                    <input
                      id="regEmail"
                      type="email"
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      placeholder="john@company.com"
                      className="input pl-10 py-2.5 rounded-xl border-gray-200"
                      required
                    />
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label" htmlFor="regPhone">Phone number</label>
                  <div className="relative">
                    <input
                      id="regPhone"
                      type="tel"
                      value={regPhone}
                      onChange={e => setRegPhone(e.target.value)}
                      placeholder="+1234567890"
                      className="input pl-10 py-2.5 rounded-xl border-gray-200"
                      required
                    />
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="input-group">
                    <label className="input-label" htmlFor="regPassword">Password</label>
                    <div className="relative">
                      <input
                        id="regPassword"
                        type={showRegPassword ? 'text' : 'password'}
                        value={regPassword}
                        onChange={e => setRegPassword(e.target.value)}
                        placeholder="••••••••"
                          className="input pl-10 pr-9 py-2.5 rounded-xl border-gray-200"
                        minLength={6}
                        required
                      />
                      <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                      <button
                        type="button"
                        onClick={() => setShowRegPassword(!showRegPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showRegPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="input-label" htmlFor="regConfirmPassword">Confirm</label>
                    <input
                      id="regConfirmPassword"
                      type={showRegPassword ? 'text' : 'password'}
                      value={regConfirmPassword}
                      onChange={e => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="input py-2.5 rounded-xl border-gray-200"
                      minLength={6}
                      required
                    />
                  </div>
                </div>

                <div className="input-group">
                  <label className="input-label" htmlFor="regCompany">Company name</label>
                  <div className="relative">
                    <input
                      id="regCompany"
                      type="text"
                      value={regCompany}
                      onChange={e => setRegCompany(e.target.value)}
                      placeholder="Acme Corp"
                      className="input pl-10 py-2.5 rounded-xl border-gray-200"
                      required
                    />
                    <Building size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full py-3 mt-4 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all"
                  disabled={submitting}
                >
                  {submitting ? (
                    <><div className="spinner spinner-sm border-white/30 border-t-white" /> Registering…</>
                  ) : (
                    <>Register & Set Workspace</>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Privacy statement footer */}
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
