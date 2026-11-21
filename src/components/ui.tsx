import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Children, cloneElement, isValidElement, useMemo, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, InputHTMLAttributes, PointerEvent as ReactPointerEvent, ReactElement, ReactNode, SelectHTMLAttributes } from 'react'

export const Button = ({ className = '', variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) => (
  <button className={`button button-${variant} ${className}`} {...props} />
)

export const IconButton = ({ label, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) => (
  <button className="icon-button" aria-label={label} title={label} {...props} />
)

export const Input = (props: InputHTMLAttributes<HTMLInputElement>) => <input className="field" {...props} />
export const Select = (props: SelectHTMLAttributes<HTMLSelectElement>) => <select className="field" {...props} />

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="field-group"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}

const toneFor = (status: string) => {
  if (['Active', 'Confirmed', 'Completed', 'Returned', 'Valid', 'Paid', 'Converted', 'Documents Complete', 'Ready for Travel'].includes(status)) return 'success'
  if (['New', 'Travelling', 'Abroad', 'Contacted'].includes(status)) return 'info'
  if (['Follow-up Required', 'Nurture', 'Pending Confirmation', 'In Preparation', 'Partially Paid', 'Documents Pending', 'Needs Review', 'Pending', 'Unpaid'].includes(status)) return 'warning'
  if (['Cancelled', 'Failed', 'Overdue', 'Lost', 'Reversed'].includes(status)) return 'danger'
  return 'neutral'
}

export const Badge = ({ children }: { children: string }) => <span className={`badge badge-${toneFor(children)}`}>{children}</span>

export const PageHeader = ({ title, description, action }: { title: string; description: string; action?: ReactNode }) => (
  <div className="page-header"><div><h1>{title}</h1><p>{description}</p></div>{action}</div>
)

export const EmptyState = ({ title, text }: { title: string; text: string }) => <div className="empty"><strong>{title}</strong><p>{text}</p></div>

export function Modal({ title, description, onClose, children }: { title: string; description?: string; onClose: () => void; children: ReactNode }) {
  const dragStart = useRef<{ y: number; startedAt: number } | null>(null)
  const dragOffsetRef = useRef(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const handleDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' || (event.target instanceof Element && event.target.closest('button'))) return
    dragStart.current = { y: event.clientY, startedAt: Date.now() }
    dragOffsetRef.current = 0
    setIsDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const handleDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStart.current) {
      const offset = Math.max(0, event.clientY - dragStart.current.y)
      dragOffsetRef.current = offset
      setDragOffset(offset)
    }
  }
  const handleDragEnd = () => {
    if (!dragStart.current) return
    const elapsed = Date.now() - dragStart.current.startedAt
    const offset = dragOffsetRef.current
    const shouldDismiss = offset > 110 || (elapsed < 180 && offset > 55)
    dragStart.current = null
    dragOffsetRef.current = 0
    setIsDragging(false)
    setDragOffset(0)
    if (shouldDismiss) onClose()
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" style={dragOffset ? { transform: `translateY(${dragOffset}px)`, transition: isDragging ? 'none' : undefined } : undefined} onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-header" onPointerDown={handleDragStart} onPointerMove={handleDragMove} onPointerUp={handleDragEnd} onPointerCancel={handleDragEnd}><div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div><IconButton label="Close dialog" onClick={onClose}><X size={18} /></IconButton></div>
      {children}
    </section>
  </div>
}

const TABLE_PAGE_SIZE = 50

function countTableRows(node: ReactNode): number {
  if (!isValidElement(node)) return 0
  const element = node as ReactElement<{ children?: ReactNode }>
  if (element.type === 'tbody') return Children.count(element.props.children)
  return countTableRows(element.props.children)
}

function sliceTableRows(node: ReactNode, start: number, end: number): ReactNode {
  if (!isValidElement(node)) return node
  const element = node as ReactElement<{ children?: ReactNode }>
  if (element.type === 'tbody') {
    const rows = Children.toArray(element.props.children)
    return cloneElement(element, undefined, rows.slice(start, end))
  }
  return cloneElement(element, undefined, sliceTableRows(element.props.children, start, end))
}

export function TableShell({ children }: { children: ReactNode }) {
  const [page, setPage] = useState(1)
  const rowCount = countTableRows(children)
  const pageCount = Math.max(1, Math.ceil(rowCount / TABLE_PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const visible = useMemo(() => sliceTableRows(children, (safePage - 1) * TABLE_PAGE_SIZE, safePage * TABLE_PAGE_SIZE), [children, safePage])
  const start = rowCount ? (safePage - 1) * TABLE_PAGE_SIZE + 1 : 0
  const end = Math.min(safePage * TABLE_PAGE_SIZE, rowCount)
  const pages = Array.from({ length: pageCount }, (_, index) => index + 1).filter(value => value === 1 || value === pageCount || Math.abs(value - safePage) <= 1)
  return <div className="table-shell">
    <div className="table-scroll">{visible}</div>
    {rowCount > TABLE_PAGE_SIZE && <nav className="table-pagination" aria-label="Table pagination">
      <span>Showing <strong>{start}–{end}</strong> of <strong>{rowCount.toLocaleString()}</strong></span>
      <div className="table-pagination-controls">
        <button type="button" aria-label="Previous page" disabled={safePage <= 1} onClick={() => setPage(value => Math.max(1, value - 1))}><ChevronLeft size={15}/><span>Previous</span></button>
        {pages.map((value, index) => <span className="table-pagination-page" key={value}>
          {index > 0 && value - pages[index - 1] > 1 && <i aria-hidden="true">…</i>}
          <button type="button" aria-label={`Page ${value}`} aria-current={safePage === value ? 'page' : undefined} onClick={() => setPage(value)}>{value}</button>
        </span>)}
        <button type="button" aria-label="Next page" disabled={safePage >= pageCount} onClick={() => setPage(value => Math.min(pageCount, value + 1))}><span>Next</span><ChevronRight size={15}/></button>
      </div>
    </nav>}
  </div>
}
