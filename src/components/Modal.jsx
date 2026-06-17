import { X } from 'lucide-react'
import { useEffect } from 'react'

export default function Modal({ title, onClose, children }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl max-h-[92vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-cobeb-border rounded-full" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-cobeb-border shrink-0">
          <h3 className="text-cobeb-text font-semibold text-sm">{title}</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-cobeb-navy p-1 -mr-1 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4 pb-10">
          {children}
        </div>
      </div>
    </div>
  )
}
