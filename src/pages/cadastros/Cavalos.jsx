import { useState, useEffect } from 'react'
import { Plus, Search, Pencil, Power, Tractor } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import Modal from '../../components/Modal'
import { Field, inputClass, selectClass } from '../../lib/form'

export default function Cavalos() {
  const [lista, setLista] = useState([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState(null)
  const [placa, setPlaca] = useState('')
  const [tipo, setTipo] = useState('FF')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const carregar = async () => {
    setLoading(true)
    const { data } = await supabase.from('cavalos').select('*').order('placa')
    if (data) setLista(data)
    setLoading(false)
  }

  useEffect(() => { carregar() }, [])

  const abrirNovo = () => { setEditando(null); setPlaca(''); setTipo('FF'); setErro(''); setModal(true) }
  const abrirEditar = (c) => { setEditando(c); setPlaca(c.placa); setTipo(c.tipo); setErro(''); setModal(true) }
  const fechar = () => { setModal(false); setEditando(null) }

  const salvar = async (e) => {
    e.preventDefault()
    const placaFormatada = placa.toUpperCase().replace(/\s/g, '')
    setSalvando(true); setErro('')

    if (editando) {
      const { error } = await supabase.from('cavalos')
        .update({ placa: placaFormatada, tipo }).eq('id', editando.id)
      if (error) setErro(error.message.includes('duplicate key') ? 'Já existe um cavalo com esta placa.' : error.message)
      else { await carregar(); fechar() }
    } else {
      const { error } = await supabase.from('cavalos').insert({ placa: placaFormatada, tipo })
      if (error) setErro(error.message.includes('duplicate key') ? 'Já existe um cavalo com esta placa.' : error.message)
      else { await carregar(); fechar() }
    }
    setSalvando(false)
  }

  const toggleAtivo = async (c) => {
    const novoAtivo = !c.ativo
    await supabase.from('cavalos').update({ ativo: novoAtivo }).eq('id', c.id)
    setLista(prev => prev.map(r => r.id === c.id ? { ...r, ativo: novoAtivo } : r))
  }

  const filtrados = lista.filter(c => c.placa.toLowerCase().includes(busca.toLowerCase()))

  return (
    <div className="px-5 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-cobeb-text font-semibold text-sm">{lista.length} cavalo{lista.length !== 1 ? 's' : ''}</p>
          <p className="text-slate-500 text-xs">{lista.filter(c => c.ativo).length} ativo{lista.filter(c => c.ativo).length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={abrirNovo}
          className="flex items-center gap-1.5 bg-cobeb-navy hover:bg-cobeb-blue text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">
          <Plus size={15} /> Novo
        </button>
      </div>

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input type="text" placeholder="Buscar por placa..."
          value={busca} onChange={e => setBusca(e.target.value)}
          className="w-full bg-[#EBF5FF] border border-cobeb-border rounded-xl pl-9 pr-4 py-3 text-cobeb-text text-sm placeholder-blue-200 focus:outline-none focus:border-cobeb-blue transition-all" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtrados.length === 0 ? (
        <p className="text-center text-slate-500 text-sm py-12">Nenhum cavalo encontrado</p>
      ) : (
        <div className="space-y-3">
          {filtrados.map(c => (
            <div key={c.id} className="bg-[#0F1E33] rounded-xl p-4 border border-cobeb-border">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-[#EBF5FF] border border-cobeb-border flex items-center justify-center shrink-0">
                    <Tractor size={16} className="text-slate-500" />
                  </div>
                  <div>
                    <p className="text-cobeb-text font-bold text-base tracking-wider font-mono">{c.placa}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] bg-[#EBF5FF] border border-cobeb-border text-slate-400 px-2 py-0.5 rounded-full font-medium">{c.tipo}</span>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium border ${
                        c.ativo ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
                      }`}>{c.ativo ? 'Ativo' : 'Inativo'}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <ActionBtn onClick={() => abrirEditar(c)}><Pencil size={14} /></ActionBtn>
                  <ActionBtn onClick={() => toggleAtivo(c)}
                    className={c.ativo ? 'hover:text-red-400 hover:border-red-500/40' : 'hover:text-green-400 hover:border-green-500/40'}>
                    <Power size={14} />
                  </ActionBtn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <Modal title={editando ? 'Editar Cavalo' : 'Novo Cavalo'} onClose={fechar}>
          <form onSubmit={salvar} className="space-y-4">
            <Field label="Placa" required>
              <input type="text" value={placa}
                onChange={e => setPlaca(e.target.value.toUpperCase())}
                required maxLength={8} placeholder="Ex: ABC1D23"
                className={`${inputClass} font-mono uppercase tracking-widest`} />
              <p className="text-slate-500 text-xs mt-1">Formato antigo: ABC1234 · Mercosul: ABC1D23</p>
            </Field>
            <Field label="Tipo" required>
              <select value={tipo} onChange={e => setTipo(e.target.value)} className={selectClass}>
                <option value="FF">FF — Frota Fixa</option>
                <option value="SPOT">SPOT — Freteiro</option>
              </select>
            </Field>
            {erro && <p className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">{erro}</p>}
            <button type="submit" disabled={salvando}
              className="w-full bg-cobeb-navy hover:bg-cobeb-blue disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
              {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Cadastrar cavalo'}
            </button>
          </form>
        </Modal>
      )}
    </div>
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
