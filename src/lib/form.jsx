export const gerarSenha = () =>
  `Cobeb@${Math.floor(1000 + Math.random() * 9000)}`

export const inputClass =
  'w-full bg-[#0B1929] border border-[#1E3A5F] rounded-xl px-4 py-3 text-white text-sm ' +
  'placeholder-[#2A4A70] focus:outline-none focus:border-orange-500 focus:ring-1 ' +
  'focus:ring-orange-500/40 transition-all'

export const selectClass =
  'w-full bg-[#0B1929] border border-[#1E3A5F] rounded-xl px-4 py-3 text-white text-sm ' +
  'focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/40 ' +
  'transition-all appearance-none cursor-pointer'

export function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-slate-500 text-[11px] font-semibold uppercase tracking-widest mb-1.5">
        {label}
        {required && <span className="text-orange-500 ml-0.5"> *</span>}
      </label>
      {children}
    </div>
  )
}
