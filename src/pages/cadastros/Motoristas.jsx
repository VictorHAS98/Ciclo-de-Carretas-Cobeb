import { useState, useEffect } from 'react'
import { Plus, Search, Pencil, Power, Copy, CheckCircle, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { supabaseAdmin } from '../../lib/supabaseAdmin'
import { useAuth } from '../../contexts/AuthContext'
import Modal from '../../components/Modal'
import { Field, inputClass, selectClass, gerarSenha } from '../../lib/form'

function formatCPF(value) {
  const d = value.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

function cpfToEmail(cpf) {
  return `${cpf.replace(/\D/g, '')}@motorista.cobeb.com.br`
}

function cpfValido(cpf) {
  return cpf.replace(/\D/g, '').length === 11
}

export default function Motoristas() {
  const { profile: meProfile } = useAuth()
  const isAdminTotal = meProfile?.acesso_total === true
  const [lista, setLista]           = useState([])
  const [confirmar, setConfirmar]   = useState(null)
  const [excluindo, setExcluindo]   = useState(false)
  const [loading, setLoading]       = useState(true)
  const [busca, setBusca]           = useState('')
  const [modal, setModal]           = useState(false)
  const [editando, setEditando]     = useState(null)
  const [nome, setNome]             = useState('')
  const [cpf, setCpf]               = useState('')
  const [telefone, setTelefone]     = useState('')
  const [tipo, setTipo]             = useState('FF')
  const [senha, setSenha]           = useState('')
  const [salvando, setSalvando]     = useState(false)
  const [erro, setErro]             = useState('')
  const [senhaCriada, setSenhaCriada] = useState('')
  const [copiado, setCopiado]       = useState(false)

  const carregar = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, nome, cpf, telefone, tipo, ativo')
      .eq('perfil', 'motorista')
      .order('nome')
    if (data) setLista(data)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  const abrirNovo = () => {
    setEditando(null)
    setNome(''); setCpf(''); setTelefone(''); setTipo('FF')
    setSenha(gerarSenha()); setErro(''); setSenhaCriada(''); setCopiado(false)
    setModal(true)
  }

  const abrirEditar = (m) => {
    setEditando(m)
    setNome(m.nome); setCpf(m.cpf || ''); setTelefone(m.telefone || ''); setTipo(m.tipo)
    setSenha(''); setErro(''); setSenhaCriada(''); setCopiado(false)
    setModal(true)
  }

  const fechar = () => { setModal(false); setEditando(null); setSenhaCriada('') }

  const copiar = (text) => {
    navigator.clipboard.writeText(text)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const salvar = async (e) => {
    e.preventDefault()
    setSalvando(true); setErro('')

    if (editando) {
      const { error } = await supabase
        .from('profiles').update({ nome, telefone, tipo }).eq('id', editando.id)
      if (error) setErro(error.message)
      else { await carregar(); fechar() }
    } else {
      if (!cpfValido(cpf)) {
        setErro('CPF inválido. Informe os 11 dígitos.')
        setSalvando(false); return
      }

      const emailGerado = cpfToEmail(cpf)

      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: emailGerado, password: senha,
        email_confirm: true, user_metadata: { nome },
      })
      if (authErr) { setErro(authErr.message); setSalvando(false); return }

      const { error: profileErr } = await supabase
        .from('profiles')
        .insert({ id: authData.user.id, nome, email: emailGerado, cpf, telefone, perfil: 'motorista', tipo })
      if (profileErr) { setErro(profileErr.message); setSalvando(false); return }

      setSenhaCriada(senha)
      await carregar()
    }
    setSalvando(false)
  }

  const toggleAtivo = async (m) => {
    const novoAtivo = !m.ativo
    await supabase.from('profiles').update({ ativo: novoAtivo }).eq('id', m.id)
    await supabaseAdmin.auth.admin.updateUserById(m.id, {
      ban_duration: novoAtivo ? 'none' : '876600h',
    })
    setLista(prev => prev.map(r => r.id === m.id ? { ...r, ativo: novoAtivo } : r))
  }

  const redefinirSenha = async () => {
    const nova = gerarSenha()
    await supabaseAdmin.auth.admin.updateUserById(editando.id, { password: nova })
    setSenhaCriada(nova); setCopiado(false)
  }

  const excluir = async (item) => {
    setExcluindo(true)
    const { error: profileErr } = await supabase
      .from('profiles').delete().eq('id', item.id)
    if (profileErr) {
      alert('Erro ao excluir perfil: ' + profileErr.message)
      setExcluindo(false)
      return
    }
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(item.id)
    if (authErr) {
      alert('Erro ao excluir acesso: ' + authErr.message)
      setExcluindo(false)
      return
    }
    setConfirmar(null)
    setExcluindo(false)
    await carregar()
  }

  const filtrados = lista.filter(m =>
    m.nome.toLowerCase().includes(busca.toLowerCase()) ||
    (m.cpf || '').replace(/\D/g, '').includes(busca.replace(/\D/g, ''))
  )

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-cobeb-text font-semibold text-sm">{lista.length} motorista{lista.length !== 1 ? 's' : ''}</p>
          <p className="text-slate-500 text-xs">{lista.filter(m => m.ativo).length} ativo{lista.filter(m => m.ativo).length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={abrirNovo}
          className="flex items-center gap-1.5 bg-cobeb-navy hover:bg-cobeb-blue text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={15} /> Novo
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input type="text" placeholder="Buscar por nome ou CPF..."
          value={busca} onChange={e => setBusca(e.target.value)}
          className="w-full bg-[#EBF5FF] border border-cobeb-border rounded-xl pl-9 pr-4 py-3 text-cobeb-text text-sm placeholder-blue-200 focus:outline-none focus:border-cobeb-blue transition-all" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-cobeb-navy border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <p className="text-center text-slate-500 text-sm py-12">Nenhum motorista encontrado</p>
      ) : (
        <div className="space-y-3">
          {filtrados.map(m => (
            <Card key={m.id} r={m}
              onEdit={() => abrirEditar(m)}
              onToggle={() => toggleAtivo(m)}
              onDelete={isAdminTotal ? () => setConfirmar(m) : null}
            />
          ))}
        </div>
      )}

      <ModalConfirmar confirmar={confirmar} excluindo={excluindo}
        onConfirm={excluir} onCancelar={() => setConfirmar(null)} />

      {modal && (
        <Modal title={editando ? 'Editar Motorista' : 'Novo Motorista'} onClose={fechar}>
          {senhaCriada && !editando ? (
            <SucessoSenha cpf={cpf} senha={senhaCriada} copiado={copiado} onCopy={() => copiar(senhaCriada)} onClose={fechar} />
          ) : (
            <form onSubmit={salvar} className="space-y-4">
              <Field label="Nome completo" required>
                <input type="text" value={nome} onChange={e => setNome(e.target.value)}
                  required placeholder="Ex: João da Silva" className={inputClass} />
              </Field>
              <Field label="CPF" required>
                <input
                  type="text"
                  value={cpf}
                  onChange={e => setCpf(formatCPF(e.target.value))}
                  required
                  disabled={!!editando}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  className={`${inputClass} ${editando ? 'opacity-50 cursor-not-allowed' : ''}`}
                />
              </Field>
              <Field label="Telefone">
                <input type="tel" value={telefone} onChange={e => setTelefone(e.target.value)}
                  placeholder="(31) 99999-9999" className={inputClass} />
              </Field>
              <Field label="Tipo" required>
                <select value={tipo} onChange={e => setTipo(e.target.value)} className={selectClass}>
                  <option value="FF">FF — Frota Fixa</option>
                  <option value="SPOT">SPOT — Freteiro</option>
                </select>
              </Field>
              {!editando && <SenhaDisplay senha={senha} copiado={copiado} onCopy={() => copiar(senha)} />}
              {editando && (
                <div className="space-y-2">
                  <button type="button" onClick={redefinirSenha}
                    className="w-full bg-[#EBF5FF] border border-cobeb-border hover:border-cobeb-blue/40 text-slate-400 hover:text-cobeb-yellow text-sm py-3 rounded-xl transition-colors">
                    Redefinir senha
                  </button>
                  {senhaCriada && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                      <p className="text-green-400 text-xs mb-1">Nova senha:</p>
                      <div className="flex items-center gap-2">
                        <code className="text-cobeb-yellow font-mono font-bold text-lg flex-1">{senhaCriada}</code>
                        <button type="button" onClick={() => copiar(senhaCriada)} className="text-slate-400 hover:text-cobeb-text">
                          {copiado ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {erro && <p className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">{erro}</p>}
              <button type="submit" disabled={salvando}
                className="w-full bg-cobeb-navy hover:bg-cobeb-blue disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
                {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Criar motorista'}
              </button>
            </form>
          )}
        </Modal>
      )}
    </div>
  )
}

function Card({ r, onEdit, onToggle, onDelete }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 border border-cobeb-border">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-cobeb-text font-semibold text-sm truncate">{r.nome}</p>
          {r.cpf && <p className="text-slate-500 text-xs mt-0.5 font-mono">{r.cpf}</p>}
          {r.telefone && <p className="text-slate-500 text-xs mt-0.5">{r.telefone}</p>}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className="text-[11px] bg-white border border-gray-200 text-slate-500 px-2 py-0.5 rounded-full font-medium">{r.tipo}</span>
            <StatusBadge ativo={r.ativo} />
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <ActionBtn onClick={onEdit} title="Editar"><Pencil size={14} /></ActionBtn>
          <ActionBtn onClick={onToggle} title={r.ativo ? 'Inativar' : 'Ativar'}
            className={r.ativo ? 'hover:text-red-400 hover:border-red-500/40' : 'hover:text-green-400 hover:border-green-500/40'}>
            <Power size={14} />
          </ActionBtn>
          {onDelete && (
            <ActionBtn onClick={onDelete} className="hover:text-red-400 hover:border-red-500/40">
              <Trash2 size={14} />
            </ActionBtn>
          )}
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ ativo }) {
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${
      ativo ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
    }`}>{ativo ? 'Ativo' : 'Inativo'}</span>
  )
}

function ActionBtn({ onClick, children, className = '' }) {
  return (
    <button onClick={onClick}
      className={`w-8 h-8 rounded-lg bg-[#EBF5FF] border border-cobeb-border flex items-center justify-center text-slate-500 hover:text-cobeb-yellow hover:border-cobeb-blue/40 transition-colors ${className}`}>
      {children}
    </button>
  )
}

function SenhaDisplay({ senha, copiado, onCopy }) {
  return (
    <div>
      <p className="block text-slate-500 text-[11px] font-semibold uppercase tracking-widest mb-1.5">
        Senha inicial (gerada automaticamente)
      </p>
      <div className="flex items-center gap-2 bg-[#EBF5FF] border border-cobeb-border rounded-xl px-4 py-3">
        <code className="text-cobeb-yellow font-mono font-bold text-lg flex-1">{senha}</code>
        <button type="button" onClick={onCopy} className="text-slate-400 hover:text-cobeb-text transition-colors">
          {copiado ? <CheckCircle size={17} className="text-green-400" /> : <Copy size={17} />}
        </button>
      </div>
      <p className="text-slate-500 text-xs mt-1">Copie a senha antes de salvar.</p>
    </div>
  )
}

function SucessoSenha({ cpf, senha, copiado, onCopy, onClose }) {
  return (
    <div className="space-y-4">
      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
        <p className="text-green-400 text-xs font-semibold uppercase tracking-wider mb-3">Criado com sucesso!</p>
        <p className="text-slate-500 text-xs mb-1">Login do motorista:</p>
        <p className="text-cobeb-text font-mono font-semibold text-base mb-3">{cpf}</p>
        <p className="text-slate-500 text-xs mb-2">Senha inicial — anote antes de fechar:</p>
        <div className="flex items-center gap-3 bg-[#EBF5FF] border border-cobeb-border rounded-xl px-4 py-3">
          <code className="text-cobeb-yellow font-mono font-bold text-2xl flex-1 tracking-wider">{senha}</code>
          <button onClick={onCopy} className="text-slate-400 hover:text-cobeb-text transition-colors">
            {copiado ? <CheckCircle size={20} className="text-green-400" /> : <Copy size={20} />}
          </button>
        </div>
        <p className="text-slate-500 text-xs mt-2">Esta senha não será exibida novamente.</p>
      </div>
      <button onClick={onClose}
        className="w-full bg-cobeb-navy hover:bg-cobeb-blue text-white font-semibold py-3 rounded-xl transition-colors text-sm">
        Concluir
      </button>
    </div>
  )
}

function ModalConfirmar({ confirmar, excluindo, onConfirm, onCancelar }) {
  if (!confirmar) return null
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end">
      <div className="w-full max-w-lg mx-auto bg-white rounded-t-2xl p-5 space-y-4">
        <div className="w-10 h-1 bg-cobeb-border rounded-full mx-auto" />
        <div>
          <p className="text-cobeb-text font-semibold text-base">Confirmar exclusão</p>
          <p className="text-slate-500 text-sm mt-1">
            Excluir <span className="font-semibold text-cobeb-text">{confirmar.nome}</span>? Esta ação não pode ser desfeita.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onCancelar}
            className="flex-1 bg-[#EBF5FF] border border-cobeb-border text-slate-500 font-semibold py-3 rounded-xl text-sm">
            Cancelar
          </button>
          <button onClick={() => onConfirm(confirmar)} disabled={excluindo}
            className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-semibold py-3 rounded-xl text-sm transition-colors">
            {excluindo ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  )
}
