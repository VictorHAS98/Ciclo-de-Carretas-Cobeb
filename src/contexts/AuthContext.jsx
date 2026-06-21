import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

const MODO_KEY = 'cobeb_modo_visao'

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [modoVisao, setModoVisaoState] = useState(
    () => sessionStorage.getItem(MODO_KEY) || null
  )

  function setModoVisao(modo) {
    if (modo) {
      sessionStorage.setItem(MODO_KEY, modo)
    } else {
      sessionStorage.removeItem(MODO_KEY)
    }
    setModoVisaoState(modo)
  }

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, unidade:unidades(id, nome, codigo, cidade)')
      .eq('id', userId)
      .single()

    if (!error && data) {
      if (!data.ativo) {
        await supabase.auth.signOut()
        setLoading(false)
        return
      }
      setProfile(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) fetchProfile(u.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        fetchProfile(u.id)
      } else {
        setProfile(null)
        setModoVisao(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signOut = async () => {
    setModoVisao(null)
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, modoVisao, setModoVisao, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
