import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ArrowRight, Command, LoaderCircle, Search, X } from 'lucide-react'
import { dynaura } from 'dynaura'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/hooks/useAppStore'

type SearchResult = { id: string; title: string; detail: string; path: string }
type SearchEntity = { table: string; path: string; label: string; fields: string[]; select: string; title: string; detail: (row: Record<string, unknown>) => string }

const entities: SearchEntity[] = [
  { table: 'leads', path: '/leads', label: 'Lead', fields: ['lead_ref', 'full_name', 'phone', 'email'], select: 'id,lead_ref,full_name,phone,email', title: 'full_name', detail: r => `Lead · ${r.lead_ref || r.phone || ''}` },
  { table: 'customers', path: '/customers', label: 'Customer', fields: ['customer_ref', 'full_name', 'phone', 'email'], select: 'id,customer_ref,full_name,phone,email', title: 'full_name', detail: r => `Customer · ${r.customer_ref || r.phone || ''}` },
  { table: 'packages', path: '/packages', label: 'Package', fields: ['package_ref', 'name', 'departure_location'], select: 'id,package_ref,name,departure_location', title: 'name', detail: r => `Package · ${r.package_ref || r.departure_location || ''}` },
  { table: 'bookings', path: '/bookings', label: 'Booking', fields: ['booking_ref'], select: 'id,booking_ref,status', title: 'booking_ref', detail: r => `Booking · ${r.status || ''}` },
  { table: 'travellers', path: '/travellers', label: 'Traveller', fields: ['full_name', 'nationality', 'room_group'], select: 'id,full_name,nationality,room_group', title: 'full_name', detail: r => `Traveller · ${r.nationality || ''}` },
  { table: 'payments', path: '/payments', label: 'Payment', fields: ['payment_ref', 'external_reference', 'status'], select: 'id,payment_ref,external_reference,status', title: 'payment_ref', detail: r => `Payment · ${r.external_reference || r.status || ''}` },
  { table: 'suppliers', path: '/suppliers', label: 'Supplier', fields: ['name', 'email', 'phone'], select: 'id,name,email,phone', title: 'name', detail: r => `Supplier · ${r.phone || r.email || ''}` },
  { table: 'documents', path: '/documents', label: 'Document', fields: ['file_name', 'document_type'], select: 'id,file_name,document_type', title: 'file_name', detail: r => `Document · ${r.document_type || ''}` },
  { table: 'agency_notes', path: '/notes', label: 'Note', fields: ['title', 'body'], select: 'id,title,body', title: 'title', detail: () => 'Agency note' },
]

const safeTerm = (value: string) => value.replace(/[%_,().*]/g, ' ').replace(/[^\p{L}\p{N}\s@.+-]/gu, ' ').trim().replace(/\s+/g, ' ')

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [active, setActive] = useState(0)
  const [announcement, setAnnouncement] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const requestRef = useRef(0)
  const timerRef = useRef<number | undefined>(undefined)
  const rootRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { mode, leads, customers, bookings, travellers, packages } = useAppStore()

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setResults([])
    setError('')
    setLoading(false)
    if (timerRef.current) window.clearTimeout(timerRef.current)
  }, [])

  const searchLive = useCallback(async (term: string) => {
    if (!supabase) throw new Error('Search is unavailable because the database connection is not configured.')
    const matches = await Promise.all(entities.map(async entity => {
      const expression = entity.fields.map(field => `${field}.ilike.%${term}%`).join(',')
      const { data, error: searchError } = await supabase!.from(entity.table).select(entity.select).or(expression).limit(4)
      if (searchError) {
        if (searchError.code === '42501' || /permission denied|not authorized/i.test(searchError.message)) return []
        throw searchError
      }
      return (data || []).map(row => {
        const item = row as unknown as Record<string, unknown>
        const title = String(item[entity.title] || entity.label)
        const value = String(item[entity.fields[0]] || title)
        return { id: String(item.id), title, detail: entity.detail(item), path: entity.path } satisfies SearchResult
      })
    }))
    return matches.flat().slice(0, 10)
  }, [])

  const searchDemo = useCallback((term: string): SearchResult[] => {
    const q = term.toLowerCase()
    return [
      ...leads.filter(x => `${x.reference} ${x.name} ${x.phone} ${x.email || ''}`.toLowerCase().includes(q)).map(x => ({ id:x.id,title:x.name,detail:`Lead · ${x.reference}`,path:'/leads' })),
      ...customers.filter(x => `${x.reference} ${x.name} ${x.phone} ${x.email || ''}`.toLowerCase().includes(q)).map(x => ({ id:x.id,title:x.name,detail:`Customer · ${x.reference}`,path:'/customers' })),
      ...packages.filter(x => `${x.code} ${x.name} ${x.destination}`.toLowerCase().includes(q)).map(x => ({ id:x.id,title:x.name,detail:`Package · ${x.code}`,path:'/packages' })),
      ...bookings.filter(x => `${x.reference} ${x.packageName}`.toLowerCase().includes(q)).map(x => ({ id:x.id,title:x.reference,detail:`Booking · ${x.packageName}`,path:'/bookings' })),
      ...travellers.filter(x => x.name.toLowerCase().includes(q)).map(x => ({ id:x.id,title:x.name,detail:'Traveller',path:'/travellers' })),
    ].slice(0, 10)
  }, [leads,customers,packages,bookings,travellers])

  const runSearch = useCallback(async (raw: string) => {
    const term = safeTerm(raw)
    if (term.length < 2) { setResults([]); setLoading(false); setError(''); return }
    const request = ++requestRef.current
    setLoading(true)
    setError('')
    try {
      const task = mode === 'demo' ? Promise.resolve(searchDemo(term)) : searchLive(term)
      const found = await dynaura.promise(task, {
        loading: { title: 'Searching RouteHQ', duration: 1200 },
        success: { title: 'Search updated', duration: 700 },
        error: { title: 'Search failed', duration: 1800 },
      })
      if (request !== requestRef.current) return
      setResults(found)
      setActive(0)
      setAnnouncement(found.length ? `${found.length} results found` : 'No matching records')
    } catch (e) {
      if (request !== requestRef.current) return
      setError(e instanceof Error ? e.message : 'Search could not be completed. Try again.')
      setResults([])
      setAnnouncement('Search failed')
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [mode, searchDemo, searchLive])

  useEffect(() => {
    if (!open) return
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => { void runSearch(query) }, 260)
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current) }
  }, [query, open, runSearch])

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus())
  }, [open])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        if (event.defaultPrevented || event.altKey || event.shiftKey) return
        const target = event.target as HTMLElement | null
        if (target?.isContentEditable || target?.closest('input, textarea, select, [contenteditable="true"]')) return
        event.preventDefault()
        setOpen(true)
        return
      }
      if (!open) return
      if (event.key === 'Escape') { event.preventDefault(); close(); return }
      if (event.key === 'ArrowDown' && results.length) { event.preventDefault(); setActive(i => Math.min(i + 1, results.length - 1)) }
      if (event.key === 'ArrowUp' && results.length) { event.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
      if (event.key === 'Enter' && results[active]) { event.preventDefault(); select(results[active]) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, close, results, active])

  useEffect(() => {
    if (!open) return
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open, close])

  const select = (result: SearchResult) => {
    const target = new URLSearchParams()
    target.set('search', query.trim())
    navigate(`${result.path}?${target.toString()}`)
    close()
  }

  return <div className={`routehq-search ${open ? 'is-open' : ''}`} ref={rootRef}>
    <button type="button" className="routehq-search-trigger" aria-label="Open global search" aria-expanded={open} onClick={() => setOpen(true)}>
      <Search size={17} strokeWidth={1.8} />
      <span>Search</span>
      <kbd><Command size={11} /> K</kbd>
    </button>
    {open && <section className="routehq-search-panel" role="dialog" aria-label="Search RouteHQ">
      <div className="routehq-search-field">
        <Search size={18} aria-hidden="true" />
        <input ref={inputRef} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search customers, bookings, packages…" aria-label="Search all RouteHQ records" autoComplete="off" />
        {loading && <LoaderCircle size={17} className="routehq-search-spinner" aria-label="Searching" />}
        <button type="button" onClick={close} aria-label="Close search"><X size={17} /></button>
      </div>
      <div className="routehq-search-results" role="listbox" aria-label="Search results" aria-busy={loading}>
        {!query.trim() && <p className="routehq-search-hint">Search agency records across RouteHQ</p>}
        {query.trim().length === 1 && <p className="routehq-search-hint">Enter at least two characters</p>}
        {error && <div className="routehq-search-error" role="alert"><span>{error}</span><button type="button" onClick={() => void runSearch(query)}>Retry</button></div>}
        {!error && !loading && query.trim().length >= 2 && results.length === 0 && <p className="routehq-search-hint">No matching records</p>}
        {results.map((result,index) => <button type="button" role="option" aria-selected={active===index} className={active===index?'is-active':''} key={`${result.path}-${result.id}`} onMouseEnter={() => setActive(index)} onClick={() => select(result)}><span className="routehq-result-copy"><strong>{result.title}</strong><small>{result.detail}</small></span><ArrowRight size={15} /></button>)}
      </div>
      <footer className="routehq-search-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open record list</span><span><kbd>Esc</kbd> Close</span></footer>
      <span className="sr-only" role="status" aria-live="polite">{announcement}</span>
    </section>}
  </div>
}
