import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import type { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { toast } from 'react-hot-toast'

interface AuthContextValue {
  user: User | null
  realUser: User | null
  role: string | null
  userType: string | null
  tenantId: string | null
  impersonatedUser: User | null
  impersonateUser: (target: { id: string; email: string; full_name?: string; tenant_id?: string } | null) => void
  session: Session | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
  signInWithMock: (email: string) => Promise<void>
  signUpWithPassword: (email: string, password: string, first_name: string, last_name: string, phone: string, company: string) => Promise<any>
  signInWithPassword: (email: string, password: string) => Promise<any>
  verifyOtp: (emailOrPhone: string, token: string, type: 'signup' | 'sms') => Promise<any>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({
  children,
}: {
  children: ReactNode
}) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string | null>(null)
  const [userType, setUserType] = useState<string | null>(null)
  const [tenantId, setTenantId] = useState<string | null>(null)
  const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null)

  useEffect(() => {
    const getInitialSession = async () => {
      // 1. Check if mock user is saved
      const savedMock = sessionStorage.getItem('mock_user')
      if (savedMock) {
        try {
          const u = JSON.parse(savedMock)
          setUser(u)
          setSession({ user: u } as any)

          // Check if impersonation was active
          const savedImpersonated = sessionStorage.getItem('impersonated_user')
          if (savedImpersonated) {
            setImpersonatedUser(JSON.parse(savedImpersonated))
          }

          setLoading(false)
          return
        } catch {
          sessionStorage.removeItem('mock_user')
        }
      }

      // Check if impersonation was active
      const savedImpersonated = sessionStorage.getItem('impersonated_user')
      if (savedImpersonated) {
        try {
          setImpersonatedUser(JSON.parse(savedImpersonated))
        } catch {
          sessionStorage.removeItem('impersonated_user')
        }
      }

      // 2. Fetch from Supabase
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        setSession(session)
        setUser(session?.user ?? null)
      } catch (err) {
        console.warn('Supabase getSession failed:', err)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Setup subscription but catch potential network error
    // Ensure tenant + profile records exist for authenticated users.
    let subscription: any = null
    try {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        // Only override if mock user is NOT active
        if (!sessionStorage.getItem('mock_user')) {
          setSession(session)
          setUser(session?.user ?? null)
          setLoading(false)
        }
      })
      subscription = data?.subscription
    } catch (err) {
      console.warn('onAuthStateChange failed:', err)
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [])

  const refreshProfile = async () => {
    const activeUser = impersonatedUser || user
    if (!activeUser) {
      setRole(null)
      setUserType(null)
      setTenantId(null)
      return
    }

    try {
      const { data, error } = await (supabase
        .from('profiles')
        .select('role, user_type, tenant_id, full_name')
        .eq('id', activeUser.id)
        .maybeSingle() as any)

      if (data && !error) {
        setRole(data.role)
        setUserType(data.user_type)
        setTenantId(data.tenant_id)
        if (data.full_name) {
          setUser(prev => {
            if (!prev) return null
            return {
              ...prev,
              user_metadata: {
                ...prev.user_metadata,
                full_name: data.full_name
              }
            }
          })
          if (impersonatedUser) {
            setImpersonatedUser(prev => {
              if (!prev) return null
              return {
                ...prev,
                user_metadata: {
                  ...prev.user_metadata,
                  full_name: data.full_name
                }
              }
            })
          }
        }
      } else {
        setRole('member')
        setUserType('user')
        setTenantId(activeUser.user_metadata?.tenant_id ?? activeUser.id)
      }
    } catch (err) {
      console.warn('Failed to fetch user role:', err)
      setRole('member')
      setUserType('user')
      setTenantId(activeUser.user_metadata?.tenant_id ?? activeUser.id)
    }
  }

  // Fetch the role, user type, and tenant_id for the active user (impersonated or real)
  useEffect(() => {
    refreshProfile()
  }, [user?.id, impersonatedUser?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return

    const ensureRecords = async () => {
      try {
        // Check if profile already exists first
        const { data: existingProfile, error: checkError } = await supabase
          .from('profiles')
          .select('id, tenant_id')
          .eq('id', user.id)
          .maybeSingle()

        if (checkError) {
          console.warn('Error checking existing profile:', checkError)
        }

        if (!existingProfile) {
          const tenantId = user.user_metadata?.tenant_id ?? user.id
          const emailSlug = (user.email ?? 'workspace').split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') || 'workspace'

          // Try upserting tenant (id = tenantId)
          const { error: tenantError } = await (supabase
            .from('tenants')
            .upsert({ 
              id: tenantId, 
              name: user.user_metadata?.company_name ?? `${user.email ?? 'Workspace'}`, 
              slug: emailSlug, 
              owner_id: user.id 
            } as any, { onConflict: 'id' }) as any)

          if (tenantError) {
            console.warn('Failed to upsert tenant:', tenantError)
          }

          // Insert profile for the user
          const { error: profileError } = await (supabase
            .from('profiles')
            .insert({ 
              id: user.id, 
              tenant_id: tenantId, 
              full_name: user.user_metadata?.full_name ?? user.email ?? 'User', 
              email: user.email,
              sender_phone: user.user_metadata?.phone ?? user.phone ?? null
            } as any) as any)

          if (profileError) {
            console.warn('Failed to insert profile:', profileError)
          }
        }
      } catch (e) {
        console.warn('Error ensuring tenant/profile records:', e)
      }
    }

    ensureRecords()
  }, [user])

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      throw error
    }
  }

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      throw error
    }
  }

  const signOut = async () => {
    sessionStorage.removeItem('mock_user')
    sessionStorage.removeItem('impersonated_user')
    localStorage.removeItem('local_contacts')
    setUser(null)
    setImpersonatedUser(null)
    setSession(null)
    setRole(null)
    setUserType(null)
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.warn('Supabase signOut failed:', err)
    }
  }

  const signInWithMock = async (email: string) => {
    const mockEmail = email.trim() || 'tester@example.com'
    
    // Generate deterministic UUID from email to prevent cross-user mock session conflicts
    const getDeterministicUuid = (str: string) => {
      let hash = 0
      for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i)
        hash |= 0
      }
      const seed = Math.abs(hash)
      const randomHex = (s: number) => {
        const r = Math.sin(s) * 10000
        return Math.floor((r - Math.floor(r)) * 16).toString(16)
      }
      let hex = ''
      for (let i = 0; i < 32; i++) {
        hex += randomHex(seed + i)
      }
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
    }

    const mockId = getDeterministicUuid(mockEmail)

    const u = {
      id: mockId,
      email: mockEmail,
      user_metadata: {
        full_name: mockEmail.split('@')[0],
        avatar_url: '',
        tenant_id: mockId
      }
    } as any
    sessionStorage.setItem('mock_user', JSON.stringify(u))
    setUser(u)
    setSession({ user: u } as any)
    setLoading(false)

    // Provision mock workspace & profile in live database to satisfy constraints
    try {
      const emailSlug = mockEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') || 'workspace'
      await (supabase.from('tenants').insert({
        id: mockId,
        name: `${mockEmail.split('@')[0]}'s Workspace`,
        slug: `${emailSlug}-workspace`,
        plan: 'free',
        owner_id: mockId,
        settings: {}
      } as any) as any);
      
      await (supabase.from('profiles').insert({
        id: mockId,
        tenant_id: mockId,
        full_name: mockEmail.split('@')[0],
        role: 'owner',
        email: mockEmail
      } as any) as any);
      console.log('Mock credentials successfully provisioned in live database.');
    } catch (err) {
      console.warn('Could not provision mock credentials in live database (offline mode):', err);
    }
  }

  const signUpWithPassword = async (email: string, password: string, first_name: string, last_name: string, phone: string, company: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name,
          last_name,
          full_name: `${first_name} ${last_name}`.trim(),
          phone,
          company_name: company
        }
      }
    })
    if (error) throw error
    return data
  }

  const signInWithPassword = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
    if (data.session) {
      setSession(data.session)
      setUser(data.user)
    }
    return data
  }

  const verifyOtp = async (emailOrPhone: string, token: string, type: 'signup' | 'sms') => {
    const verifyParams: any = {
      token,
      type
    }
    if (type === 'sms') {
      verifyParams.phone = emailOrPhone
    } else {
      verifyParams.email = emailOrPhone
    }

    const { data, error } = await supabase.auth.verifyOtp(verifyParams)
    if (error) throw error

    if (data.session) {
      setSession(data.session)
      setUser(data.user)
    }
    return data
  }

  const impersonateUser = (target: { id: string; email: string; full_name?: string; tenant_id?: string } | null) => {
    if (!target) {
      sessionStorage.removeItem('impersonated_user')
      setImpersonatedUser(null)
      toast.success('Ended user impersonation')
    } else {
      const mockUserObj = {
        id: target.id,
        email: target.email,
        user_metadata: {
          full_name: target.full_name || target.email.split('@')[0],
          tenant_id: target.tenant_id || target.id
        }
      } as any
      sessionStorage.setItem('impersonated_user', JSON.stringify(mockUserObj))
      setImpersonatedUser(mockUserObj)
      toast.success(`Impersonating ${target.email}`)
    }
  }

  const value: AuthContextValue = {
    user: impersonatedUser || user,
    realUser: user,
    role,
    userType,
    tenantId,
    impersonatedUser,
    impersonateUser,
    session,
    loading,
    signInWithGoogle,
    signInWithMagicLink,
    signOut,
    signInWithMock,
    signUpWithPassword,
    signInWithPassword,
    verifyOtp,
    refreshProfile
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }

  return context
}

