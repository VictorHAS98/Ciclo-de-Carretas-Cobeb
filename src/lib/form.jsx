export const gerarSenha = () =>
  `Cobeb@${Math.floor(1000 + Math.random() * 9000)}`

export const inputClass =
  'w-full bg-[#F5F9FF] border border-cobeb-border rounded-xl px-4 py-3 text-cobeb-text text-sm ' +
  'placeholder-blue-200 focus:outline-none focus:border-cobeb-blue focus:ring-1 ' +
  'focus:ring-cobeb-blue/20 transition-all'

export const selectClass =
  'w-full bg-[#F5F9FF] border border-cobeb-border rounded-xl px-4 py-3 text-cobeb-text text-sm ' +
  'focus:outline-none focus:border-cobeb-blue focus:ring-1 focus:ring-cobeb-blue/20 ' +
  'transition-all appearance-none cursor-pointer'

export function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-slate-500 text-[11px] font-semibold uppercase tracking-widest mb-1.5">
        {label}
        {required && <span className="text-cobeb-navy ml-0.5"> *</span>}
      </label>
      {children}
    </div>
  )
}
