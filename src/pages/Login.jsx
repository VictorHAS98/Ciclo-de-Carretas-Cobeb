import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

const PERFIL_ROTA = {
  admin:      '/dashboard',
  motorista:  '/viagem',
  conferente: '/tarefas',
}

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const { signIn, profile } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (profile) {
      navigate(PERFIL_ROTA[profile.perfil] ?? '/login', { replace: true })
    }
  }, [profile, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setErro('Preencha email e senha.')
      return
    }
    setLoading(true)
    setErro('')

    const { error } = await signIn(email.trim(), password)

    if (error) {
      setErro('Email ou senha inválidos. Verifique e tente novamente.')
      setLoading(false)
    }
    // Se sucesso, o useEffect acima aguarda o profile carregar e redireciona
  }

  return (
    <div className="min-h-screen bg-[#0B1929] flex flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-[380px]">

        {/* Logotipo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-5 shadow-2xl shadow-orange-500/30">
            <span className="text-white text-3xl font-black tracking-tighter select-none">CB</span>
          </div>
          <h1 className="text-white text-2xl font-bold tracking-wide">COBEB</h1>
          <p className="text-slate-500 text-[11px] mt-1.5 tracking-[0.25em] uppercase font-medium">
            Ciclo de Carretas
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#112240] rounded-2xl p-6 border border-[#1E3A5F] shadow-2xl">
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            Entre com suas credenciais para acessar o sistema.
          </p>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">

            {/* Email */}
            <div className="space-y-1.5">
              <label className="block text-slate-500 text-[11px] font-semibold uppercase tracking-widest">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErro('') }}
                placeholder="seu@email.com.br"
                autoComplete="email"
                autoCapitalize="none"
                className="w-full bg-[#0B1929] border border-[#1E3A5F] rounded-xl px-4 py-3.5 text-white text-sm placeholder-[#2A4A70] focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/40 transition-all"
              />
            </div>

            {/* Senha */}
            <div className="space-y-1.5">
              <label className="block text-slate-500 text-[11px] font-semibold uppercase tracking-widest">
                Senha
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErro('') }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-[#0B1929] border border-[#1E3A5F] rounded-xl px-4 py-3.5 pr-12 text-white text-sm placeholder-[#2A4A70] focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/40 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-400 transition-colors"
                >
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Erro */}
            {erro && (
              <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
                <AlertCircle size={15} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-red-400 text-sm">{erro}</p>
              </div>
            )}

            {/* Botão */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-lg shadow-orange-500/20 mt-1"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Entrando…
                </>
              ) : (
                'Entrar'
              )}
            </button>

          </form>
        </div>

        {/* Rodapé */}
        <p className="text-[#1E3A5F] text-xs text-center mt-6 font-medium">
          COBEB — Distribuidora Ambev
        </p>

      </div>
    </div>
  )
}
