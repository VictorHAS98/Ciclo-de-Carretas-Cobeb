import { useState, useEffect } from 'react'
import { Plus, Search, Pencil, Power, Copy, CheckCircle, Shield, MapPin } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../../components/Modal'
import { Field, inputClass, selectClass, gerarSenha } from '../../lib/form'

export default function Admins() {
  const { profile: meProfile } = useAuth()
  const [lista, setLista] = useState([])
  const [unidades, setUnidades] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [acessoTotal, setAcessoTotal] = useState(false)
  const [unidadeId, setUnidadeId] = useState('')
  const [senha, setSenha] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [senhaCriada, setSenhaCriada] = useState('')
  const [copiado, setCopiado] = useState(false)

  const carregar = async () => {
    setLoading(true)
    const [{ data: admins }, { data: unids }] = await Promise.all([
      supabase.from('profiles')
        .select('id, nome, email, ativo, acesso_total, unidade:unidades(id, nome, cidade)')
        .eq('perfil', 'admin').order('nome'),
      supabase.from('unidades').select('id, nome, cidade').eq('ativo', true).order('nome'),
    ])
    if (admins) setLista(admins)
    if (unids) { setUnidades(unids); if (!unidadeId && unids.length) setUnidadeId(unids[0].id) }
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  const abrirNovo = () => {
    setEditando(null); setNome(''); setEmail('')
    setAcessoTotal(false); setUnidadeId(unidades[0]?.id || '')
    setSenha(gerarSenha()); setErro(''); setSenhaCriada(''); setCopiado(false)
    setModal(true)
  }

  const abrirEditar = (a) => {
    setEditando(a); setNome(a.nome); setEmail(a.email)
    setAcessoTotal(a.acesso_total); setUnidadeId(a.unidade?.id || unidades[0]?.id || '')
    setSenha(''); setErro(''); setSenhaCriada(''); setCopiado(false)
    setModal(true)
  }

  const fechar = () => { setModal(false); setEditando(null); setSenhaCriada('') }
  const copiar = (t) => { navigator.clipboard.writeText(t); setCopiado(true); setTimeout(() => setCopiado(false), 2000) }

  const salvar = async (e) => {
    e.preventDefault()
    if (!acessoTotal && !unidadeId) { setErro('Selecione uma unidade.'); return }
    setSalvando(true); setErro('')

    if (editando) {
      const { error } = await supabase.from('profiles').update({
        nome, acesso_total: acessoTotal,
        unidade_id: acessoTotal ? null : unidadeId,
      }).eq('id', editando.id)
      if (error) setErro(error.message)
      else { await carregar(); fechar() }
    } else {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email, password: senha, email_confirm: true, user_metadata: { nome },
      })
      if (authErr) { setErro(authErr.message); setSalvando(false); return }

      const { error: profileErr } = await supabase.from('profiles').insert({
        id: authData.user.id, nome, email, perfil: 'admin',
        acesso_total: acessoTotal,
        unidade_id: acessoTotal ? null : unidadeId,
      })
      if (profileErr) { setErro(profileErr.message); setSalvando(false); return }

      setSenhaCriada(senha); await carregar()
    }
    setSalvando(false)
  }

  const toggleAtivo = async (a) => {
    if (a.id === meProfile?.id) { setErro('Você não pode inativar sua própria conta.'); return }
    const novoAtivo = !a.ativo
    await supabase.from('profiles').update({ ativo: novoAtivo }).eq('id', a.id)
    await supabaseAdmin.auth.admin.updateUserById(a.id, { ban_duration: novoAtivo ? 'none' : '876600h' })
    setLista(prev => prev.map(r => r.id === a.id ? { ...r, ativo: novoAtivo } : r))
  }

  const redefinirSenha = async () => {
    const nova = gerarSenha()
    await supabaseAdmin.auth.admin.updateUserById(editando.id, { password: nova })
    setSenhaCriada(nova); setCopiado(false)
  }

  const filtrados = lista.filter(a =>
    a.nome.toLowerCase().includes(busca.toLowerCase()) ||
    a.email.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-white font-semibold text-sm">{lista.length} admin{lista.length !== 1 ? 's' : ''}</p>
          <p className="text-slate-600 text-xs">{lista.filter(a => a.ativo).length} ativo{lista.filter(a => a.ativo).length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={abrirNovo}
          className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={15} /> Novo
        </button>
      </div>

      {erro && !modal && (
        <div className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
          <p className="text-red-400 text-sm">{erro}</p>
        </div>
      )}

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" />
        <input type="text" placeholder="Buscar por nome ou email..."
          value={busca} onChange={e => setBusca(e.target.value)}
          className="w-full bg-[#0B1929] border border-[#1E3A5F] rounded-xl pl-9 pr-4 py-3 text-white text-sm placeholder-[#2A4A70] focus:outline-none focus:border-orange-500 transition-all" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <p className="text-center text-slate-600 text-sm py-12">Nenhum admin encontrado</p>
      ) : (
        <div className="space-y-3">
          {filtrados.map(a => (
            <div key={a.id} className={`bg-[#0F1E33] rounded-xl p-4 border ${a.id === meProfile?.id ? 'border-orange-500/30' : 'border-[#1E3A5F]'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-white font-semibold text-sm truncate">{a.nome}</p>
                    {a.id === meProfile?.id && <span className="text-[10px] text-orange-400 font-medium shrink-0">(você)</span>}
                  </div>
                  <p className="text-slate-500 text-xs mt-0.5 truncate">{a.email}</p>
                  <div className="flex items-center gap-1 mt-1.5">
                    {a.acesso_total ? (
                      <span className="flex items-center gap-1 text-[11px] bg-orange-500/10 border border-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-medium">
                        <Shield size={10} /> Acesso Total
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[11px] bg-[#0B1929] border border-[#1E3A5F] text-slate-400 px-2 py-0.5 rounded-full">
                        <MapPin size={10} /> {a.unidade?.nome || 'Sem unidade'}
                      </span>
                    )}
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${
                      a.ativo ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                    }`}>{a.ativo ? 'Ativo' : 'Inativo'}</span>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <ActionBtn onClick={() => abrirEditar(a)}><Pencil size={14} /></ActionBtn>
                  <ActionBtn
                    onClick={() => toggleAtivo(a)}
                    disabled={a.id === meProfile?.id}
                    className={a.id === meProfile?.id ? 'opacity-30 cursor-not-allowed' :
                      a.ativo ? 'hover:text-red-400 hover:border-red-500/40' : 'hover:text-green-400 hover:border-green-500/40'}>
                    <Power size={14} />
                  </ActionBtn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={editando ? 'Editar Admin' : 'Novo Admin'} onClose={fechar}>
          {senhaCriada && !editando ? (
            <SucessoSenha senha={senhaCriada} copiado={copiado} onCopy={() => copiar(senhaCriada)} onClose={fechar} />
          ) : (
            <form onSubmit={salvar} className="space-y-4">
              <Field label="Nome completo" required>
                <input type="text" value={nome} onChange={e => setNome(e.target.value)}
                  required placeholder="Ex: Carlos Lima" className={inputClass} />
              </Field>
              <Field label="Email" required>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required disabled={!!editando} placeholder="carlos@cobeb.com.br"
                  className={`${inputClass} ${editando ? 'opacity-50 cursor-not-allowed' : ''}`} />
              </Field>

              <div>
                <p className="block text-slate-500 text-[11px] font-semibold uppercase tracking-widest mb-2">Nível de acesso</p>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setAcessoTotal(false)}
                    className={`py-3 px-4 rounded-xl text-sm font-medium border transition-colors ${
                      !acessoTotal ? 'bg-[#0B1929] border-orange-500 text-orange-400' : 'bg-[#0B1929] border-[#1E3A5F] text-slate-500'
                    }`}>
                    Leitura
                  </button>
                  <button type="button" onClick={() => setAcessoTotal(true)}
                    className={`py-3 px-4 rounded-xl text-sm font-medium border transition-colors ${
                      acessoTotal ? 'bg-orange-500/10 border-orange-500 text-orange-400' : 'bg-[#0B1929] border-[#1E3A5F] text-slate-500'
                    }`}>
                    Acesso Total
                  </button>
                </div>
                {acessoTotal && (
                  <p className="text-orange-400/70 text-xs mt-1.5">⚠ Acesso total permite criar e gerenciar todos os cadastros.</p>
                )}
              </div>

              {!acessoTotal && (
                <Field label="Unidade" required>
                  <select value={unidadeId} onChange={e => setUnidadeId(e.target.value)} className={selectClass}>
                    {unidades.map(u => (
                      <option key={u.id} value={u.id}>{u.nome} — {u.cidade}</option>
                    ))}
                  </select>
                </Field>
              )}

              {!editando && (
                <div>
                  <p className="block text-slate-500 text-[11px] font-semibold uppercase tracking-widest mb-1.5">
                    Senha inicial <span className="text-orange-500">*</span>
                  </p>
                  <div className="flex items-center gap-2 bg-[#0B1929] border border-[#1E3A5F] rounded-xl px-4 py-3">
                    <code className="text-orange-400 font-mono font-bold text-lg flex-1">{senha}</code>
                    <button type="button" onClick={() => copiar(senha)} className="text-slate-400 hover:text-white transition-colors">
                      {copiado ? <CheckCircle size={17} className="text-green-400" /> : <Copy size={17} />}
                    </button>
                  </div>
                  <p className="text-slate-600 text-xs mt-1">Copie a senha antes de salvar.</p>
                </div>
              )}

              {editando && (
                <div className="space-y-2">
                  <button type="button" onClick={redefinirSenha}
                    className="w-full bg-[#0B1929] border border-[#1E3A5F] hover:border-orange-500/40 text-slate-400 hover:text-orange-400 text-sm py-3 rounded-xl transition-colors">
                    Redefinir senha
                  </button>
                  {senhaCriada && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                      <p className="text-green-400 text-xs mb-1">Nova senha:</p>
                      <div className="flex items-center gap-2">
                        <code className="text-orange-400 font-mono font-bold text-lg flex-1">{senhaCriada}</code>
                        <button type="button" onClick={() => copiar(senhaCriada)} className="text-slate-400 hover:text-white">
                          {copiado ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {erro && <p className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">{erro}</p>}
              <button type="submit" disabled={salvando}
                className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
                {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar admin'}
              </button>
            </form>
          )}
        </Modal>
      )}
    </div>
  )
}

function ActionBtn({ onClick, children, className = '', disabled = false }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={`w-8 h-8 rounded-lg bg-[#0B1929] border border-[#1E3A5F] flex items-center justify-center text-slate-500 hover:text-orange-400 hover:border-orange-500/40 transition-colors ${className}`}>
      {children}
    </button>
  )
}

function SucessoSenha({ senha, copiado, onCopy, onClose }) {
  return (
    <div className="space-y-4">
      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
        <p className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-3">Admin criado com sucesso!</p>
        <p className="text-slate-400 text-xs mb-2">Senha inicial — anote antes de fechar:</p>
        <div className="flex items-center gap-3 bg-[#0B1929] border border-[#1E3A5F] rounded-xl px-4 py-3">
          <code className="text-orange-400 font-mono font-bold text-2xl flex-1 tracking-wider">{senha}</code>
          <button onClick={onCopy} className="text-slate-400 hover:text-white transition-colors">
            {copiado ? <CheckCircle size={20} className="text-green-400" /> : <Copy size={20} />}
          </button>
        </div>
        <p className="text-slate-600 text-xs mt-2">Esta senha não será exibida novamente.</p>
      </div>
      <button onClick={onClose}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
        Concluir
      </button>
    </div>
  )
}
