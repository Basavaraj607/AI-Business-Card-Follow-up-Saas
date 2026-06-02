import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import type { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  signOut: () => Promise<void>
  signInWithMock: (email: string) => Promise<void>
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

  useEffect(() => {
    const getInitialSession = async () => {
      // 1. Check if mock user is saved
      const savedMock = sessionStorage.getItem('mock_user')
      if (savedMock) {
        try {
          const u = JSON.parse(savedMock)
          setUser(u)
          setSession({ user: u } as any)
          setLoading(false)
          return
        } catch {
          sessionStorage.removeItem('mock_user')
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

  useEffect(() => {
    if (!user) return

    const ensureRecords = async () => {
      try {
        const tenantId = user.user_metadata?.tenant_id ?? user.id

        const emailSlug = (user.email ?? 'workspace').split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-') || 'workspace'

        // Try upserting tenant (id = tenantId)
        const { error: tenantError } = await supabase
          .from('tenants')
          .upsert({ id: tenantId, name: `${user.email ?? 'Workspace'}`, slug: emailSlug, owner_id: user.id }, { onConflict: 'id' })

        if (tenantError) {
          console.warn('Failed to upsert tenant:', tenantError)
        }

        // Upsert profile for the user
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({ id: user.id, tenant_id: tenantId, full_name: user.user_metadata?.full_name ?? user.email ?? 'User', email: user.email }, { onConflict: 'id' })

        if (profileError) {
          console.warn('Failed to upsert profile:', profileError)
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
    localStorage.removeItem('local_contacts')
    setUser(null)
    setSession(null)
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
      await supabase.from('tenants').insert({
        id: mockId,
        name: `${mockEmail.split('@')[0]}'s Workspace`,
        slug: `${emailSlug}-workspace`,
        plan: 'free',
        owner_id: mockId,
        settings: {}
      });
      
      await supabase.from('profiles').insert({
        id: mockId,
        tenant_id: mockId,
        full_name: mockEmail.split('@')[0],
        role: 'owner',
        email: mockEmail
      });
      console.log('Mock credentials successfully provisioned in live database.');
    } catch (err) {
      console.warn('Could not provision mock credentials in live database (offline mode):', err);
    }
  }

  const value: AuthContextValue = {
    user,
    session,
    loading,
    signInWithGoogle,
    signInWithMagicLink,
    signOut,
    signInWithMock
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

