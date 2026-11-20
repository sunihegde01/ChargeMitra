import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../supabase'

type AuthContextType = {
  session: Session | null
  user: User | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    let receivedAuthState = false
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      receivedAuthState = true
      setSession(nextSession)
      setLoading(false)
    })

    async function restoreSession() {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession()
        if (error) throw error
        if (active && !receivedAuthState) setSession(initialSession)
      } catch (error) {
        if (active) console.error('Unable to restore the current auth session:', error)
      } finally {
        if (active) setLoading(false)
      }
    }

    void restoreSession()

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
