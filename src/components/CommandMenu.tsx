import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, CalendarCheck, CreditCard, FileText, LayoutDashboard, Package, Search, Settings, StickyNote, UserPlus, Users, WalletCards } from 'lucide-react'
import { useAppStore } from '@/hooks/useAppStore'

const commands = [
  { label: 'Go to dashboard', detail: 'Overview', path: '/', icon: LayoutDashboard },
  { label: 'Go to leads', detail: 'Customers', path: '/leads', icon: UserPlus },
  { label: 'Go to customer records', detail: 'Customers', path: '/customers', icon: Users },
  { label: 'Go to packages', detail: 'Travel management', path: '/packages', icon: Package },
  { label: 'Go to bookings', detail: 'Travel management', path: '/bookings', icon: CalendarCheck },
  { label: 'Go to travellers and operations', detail: 'Travel management', path: '/travellers', icon: Users },
  { label: 'Go to payments and balances', detail: 'Finance', path: '/payments', icon: CreditCard },
  { label: 'Go to supplier payments', detail: 'Finance', path: '/suppliers', icon: WalletCards },
  { label: 'Go to documents', detail: 'Administration', path: '/documents', icon: FileText },
  { label: 'Go to notes', detail: 'Administration', path: '/notes', icon: StickyNote },
  { label: 'Go to operation guide', detail: 'Administration', path: '/notes/guidelines', icon: FileText },
  { label: 'Go to settings', detail: 'Administration', path: '/settings', icon: Settings },
  { label: 'Add a lead', detail: 'Create record', action: 'lead' as const, icon: UserPlus },
  { label: 'Add a customer', detail: 'Create record', action: 'customer' as const, icon: Users },
  { label: 'Create a package', detail: 'Create record', action: 'package' as const, icon: Package },
  { label: 'Create a booking', detail: 'Create record', action: 'booking' as const, icon: CalendarCheck },
  { label: 'Add a traveller', detail: 'Create record', action: 'traveller' as const, icon: Users },
  { label: 'Record a payment', detail: 'Create record', action: 'payment' as const, icon: CreditCard },
  { label: 'Add a supplier cost', detail: 'Create record', action: 'supplier-cost' as const, icon: WalletCards },
  { label: 'Record a supplier payment', detail: 'Create record', action: 'supplier-payment' as const, icon: WalletCards },
  { label: 'Add a document', detail: 'Create record', action: 'document' as const, icon: FileText },
]

export function CommandMenu({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { setAction } = useAppStore()
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return commands.filter((item) => !normalized || `${item.label} ${item.detail}`.toLowerCase().includes(normalized))
  }, [query])

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => { setActiveIndex(0) }, [query])

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => Math.min(index + 1, filtered.length - 1)) }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)) }
    if (event.key === 'Enter' && filtered[activeIndex]) { event.preventDefault(); run(filtered[activeIndex]) }
    if (event.key === 'Escape') { event.preventDefault(); onClose() }
  }

  const run = (item: (typeof commands)[number]) => {
    if (item.path) navigate(item.path, { viewTransition: true })
    else if (item.action) setAction(item.action)
    onClose()
  }

  return <div className="command-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="command-dialog" role="dialog" aria-modal="true" aria-label="Command menu">
      <div className="command-search"><Search size={18} /><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={handleKeyDown} placeholder="Search pages and actions…" aria-label="Search commands" /><kbd>ESC</kbd></div>
      <div className="command-results" role="listbox" aria-label="Available commands">
        {filtered.length ? filtered.map((item, index) => {
          const Icon = item.icon
          return <button type="button" role="option" aria-selected={activeIndex === index} className={activeIndex === index ? 'command-option is-active' : 'command-option'} key={item.label} onMouseEnter={() => setActiveIndex(index)} onClick={() => run(item)}><Icon size={17} /><span><strong>{item.label}</strong><small>{item.detail}</small></span><ArrowRight size={15} className="command-arrow" /></button>
        }) : <p className="command-empty">No matching pages or actions.</p>}
      </div>
      <footer className="command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span><span><kbd>Esc</kbd> Close</span></footer>
    </section>
  </div>
}
