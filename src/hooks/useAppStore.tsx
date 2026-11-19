import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { todayDate } from '@/lib/business'
import { deleteLiveRecords, loadLiveStore, saveLiveStore } from '@/lib/supabaseStore'
import { supabase } from '@/lib/supabase'
import { waitForMinimumLoadingTime } from '@/lib/loading'
import type { AppMode } from '@/auth/AuthGate'
import type { Booking, Customer, Lead, Payment, DocumentRecord, QuickActionType, SupplierCost, SupplierPayment, TravelPackage, Traveller } from '@/types'

type DeletableRecordType = 'lead' | 'customer' | 'package' | 'booking' | 'traveller' | 'supplier-cost' | 'document'
type DeletableRecord = Lead | Customer | TravelPackage | Booking | Traveller | SupplierCost | DocumentRecord
type PendingDelete = { type: DeletableRecordType; ids: string[]; records: DeletableRecord[]; timer: number }

type AppStore = {
  mode: AppMode
  saveNotice: string | null
  saveError: string | null
  retrySave: () => void
  leads: Lead[]
  customers: Customer[]
  bookings: Booking[]
  packages: TravelPackage[]
  payments: Payment[]
  travellers: Traveller[]
  supplierCosts: SupplierCost[]
  supplierPayments: SupplierPayment[]
  documents: DocumentRecord[]
  action: QuickActionType | null
  setAction: (action: QuickActionType | null, defaults?: Record<string, string>) => void
  actionDefaults: Record<string, string>
  deleteRecords: (type: DeletableRecordType, recordIds: string[]) => Promise<void>
  undoAvailable: boolean
  undoDelete: () => void
  addRecord: (type: QuickActionType, values: Record<string, string>) => void
  editing: { type: QuickActionType; id: string } | null
  setEditing: (value: { type: QuickActionType; id: string } | null) => void
  updateRecord: (type: QuickActionType, recordId: string, values: Record<string, string>) => void
  convertLead: (leadId: string, values?: Record<string, string>) => void
  reversePayment: (paymentId: string, reason: string) => void
  voidSupplierPayment: (paymentId: string, reason: string) => void
}

const StoreContext = createContext<AppStore | null>(null)
const id = () => crypto.randomUUID()
const reference = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`
const today = todayDate
const confirmedSupplierPaid = (costId: string, payments: SupplierPayment[]) =>
  payments.filter((payment) => payment.supplierCostId === costId && (payment.status || 'Confirmed') === 'Confirmed').reduce((sum, payment) => sum + payment.amount, 0)
const packageAvailabilityStatus = (status: TravelPackage['status'], availability: number | null): TravelPackage['status'] =>
  availability === null ? status : availability <= 0 && status === 'Active' ? 'Fully Booked' : availability > 0 && status === 'Fully Booked' ? 'Active' : status
const bookingReservesPlaces = (status: Booking['status']) => !['Enquiry', 'Cancelled'].includes(status)

function WorkspaceSkeleton() {
  return <div className="workspace-skeleton" role="status" aria-label="Loading workspace">
    <aside className="workspace-skeleton-sidebar">
      <div className="workspace-skeleton-brand"><span /><i /></div>
      <div className="workspace-skeleton-nav">{Array.from({ length: 11 }, (_, index) => <i key={index} />)}</div>
      <div className="workspace-skeleton-profile" />
    </aside>
    <div className="workspace-skeleton-main">
      <header className="workspace-skeleton-topbar"><span /><i /></header>
      <main className="workspace-skeleton-page">
        <div className="workspace-skeleton-heading"><i /><span /></div>
        <div className="workspace-skeleton-metrics">{Array.from({ length: 6 }, (_, index) => <i key={index} />)}</div>
        <div className="workspace-skeleton-panels"><section><i /><i /><i /><i /></section><section><i /><i /><i /><i /></section></div>
        <section className="workspace-skeleton-table"><i /><i /><i /><i /><i /></section>
      </main>
    </div>
  </div>
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [leads, setLeads] = useState<Lead[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [packages, setPackages] = useState<TravelPackage[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [travellers, setTravellers] = useState<Traveller[]>([])
  const [supplierCosts, setSupplierCosts] = useState<SupplierCost[]>([])
  const [supplierPayments, setSupplierPayments] = useState<SupplierPayment[]>([])
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [dataReady, setDataReady] = useState(false)
  const [showLoadingSkeleton, setShowLoadingSkeleton] = useState(false)
  const [dataError, setDataError] = useState<string | null>(null)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveRetry, setSaveRetry] = useState(0)
  const [undoAvailable, setUndoAvailable] = useState(false)
  const pendingDeleteRef = useRef<PendingDelete | null>(null)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())
  const skipNextSave = useRef(false)
  const noticeTimer = useRef<number | undefined>(undefined)
  const showNotice = (message: string, duration = 2600) => {
    setSaveNotice(message)
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    if (message !== 'Updating records…' && message !== 'Saving changes…') {
      noticeTimer.current = window.setTimeout(() => setSaveNotice(null), duration)
    }
  }

  useEffect(() => {
    if (dataReady) { setShowLoadingSkeleton(false); return }
    const timer = window.setTimeout(() => setShowLoadingSkeleton(true), 300)
    return () => window.clearTimeout(timer)
  }, [dataReady])

  useEffect(() => {
    let active = true
    setDataReady(false)
    setDataError(null)
    loadLiveStore().then(async (data) => {
      await waitForMinimumLoadingTime()
      if (!active) return
      skipNextSave.current = true
      setLeads(data.leads); setCustomers(data.customers); setPackages(data.packages)
      setBookings(data.bookings); setTravellers(data.travellers); setPayments(data.payments)
      setSupplierCosts(data.supplierCosts); setSupplierPayments(data.supplierPayments); setDocuments(data.documents)
      setDataReady(true)
    }).catch((error: unknown) => {
      if (active) { setDataError(error instanceof Error ? error.message : 'Could not load agency records from Supabase. Check your connection and account permissions.'); setDataReady(true) }
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!dataReady || dataError) return
    if (skipNextSave.current) { skipNextSave.current = false; return }
    const snapshot = { leads, customers, packages, bookings, travellers, payments, supplierCosts, supplierPayments, documents }
    const timer = window.setTimeout(() => {
      showNotice('Saving changes…')
      // Serialize full snapshots so an older, slower save cannot overwrite a newer one.
      saveQueue.current = saveQueue.current.catch(() => undefined).then(() => saveLiveStore(snapshot))
        .then(() => {
          setSaveError(null)
          showNotice('Changes saved')
        })
        .catch((error: unknown) => {
          setSaveError(error instanceof Error ? error.message : 'Could not save agency records to Supabase.')
          showNotice('Could not save changes')
        })
    }, 500)
    return () => window.clearTimeout(timer)
  }, [leads, customers, packages, bookings, travellers, payments, supplierCosts, supplierPayments, documents, dataReady, dataError, saveRetry])

  useEffect(() => {
    if (!dataReady || dataError || !supabase) return
    let active = true
    let refreshTimer: number | undefined
    const tables = ['leads', 'customers', 'packages', 'bookings', 'travellers', 'payments', 'supplier_costs', 'supplier_payments', 'documents']
    let channel = supabase.channel('agency-record-updates')
    for (const table of tables) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        if (refreshTimer) window.clearTimeout(refreshTimer)
        showNotice('Updating records…')
        refreshTimer = window.setTimeout(async () => {
          try {
            const data = await loadLiveStore()
            if (!active) return
            skipNextSave.current = true
            setLeads(data.leads); setCustomers(data.customers); setPackages(data.packages)
            setBookings(data.bookings); setTravellers(data.travellers); setPayments(data.payments)
            setSupplierCosts(data.supplierCosts); setSupplierPayments(data.supplierPayments); setDocuments(data.documents)
            showNotice('Records updated')
          } catch {
            if (active) showNotice('Could not refresh records')
          }
        }, 350)
      })
    }
    channel.subscribe()
    return () => {
      active = false
      if (refreshTimer) window.clearTimeout(refreshTimer)
      void supabase!.removeChannel(channel)
    }
  }, [dataReady, dataError])
  const [action, setActionState] = useState<QuickActionType | null>(null)
  const [actionDefaults, setActionDefaults] = useState<Record<string, string>>({})
  const setAction = (nextAction: QuickActionType | null, defaults: Record<string, string> = {}) => { setActionState(nextAction); setActionDefaults(nextAction ? defaults : {}) }
  const [editing, setEditing] = useState<{ type: QuickActionType; id: string } | null>(null)

  const addRecord = (type: QuickActionType, values: Record<string, string>) => {
    if (type === 'document') setDocuments((items) => [{ id: id(), name: values.name, category: values.category, relatedType: values.relatedType as DocumentRecord['relatedType'], relatedReference: values.relatedReference, url: values.url, recordedAt: today(), status: values.status as DocumentRecord['status'] }, ...items])
    if (type === 'supplier-cost') setSupplierCosts((items) => [{ id: id(), bookingId: values.bookingId, supplier: values.supplier, category: values.category, amount: Number(values.amount), dueDate: values.dueDate, paid: 0, status: values.dueDate < today() ? 'Overdue' : 'Unpaid' }, ...items])
    if (type === 'supplier-payment') {
      const cost = supplierCosts.find((item) => item.id === values.supplierCostId)
      const amount = Number(values.amount)
      if (!cost || !Number.isFinite(amount) || amount <= 0 || amount > cost.amount - confirmedSupplierPaid(cost.id, supplierPayments)) return
      const payment: SupplierPayment = { id: id(), supplierCostId: values.supplierCostId, amount, date: values.date, method: values.method as SupplierPayment['method'], reference: values.reference || undefined }
      const paid = confirmedSupplierPaid(cost.id, supplierPayments) + amount
      const status: SupplierCost['status'] = paid >= cost.amount ? 'Paid' : cost.dueDate < today() ? 'Overdue' : paid > 0 ? 'Partially Paid' : 'Unpaid'
      payment.status = 'Confirmed'
      setSupplierPayments((items) => [payment, ...items])
      setSupplierCosts((items) => items.map((item) => item.id === cost.id ? { ...item, paid, status } : item))
    }
    if (type === 'package') setPackages((items) => [{ id: id(), code: values.code, name: values.name, category: values.category, destination: values.destination, departureLocation: values.departureLocation?.trim() || undefined, departureDate: values.departureDate?.trim() || undefined, sourceAgent: values.sourceAgent?.trim() || undefined, notes: values.notes?.trim() || undefined, duration: values.duration, price: Number(values.price), estimatedCost: values.estimatedCost?.trim() ? Number(values.estimatedCost) : null, currency: 'NGN', availability: values.availability?.trim() ? Number(values.availability) : null, status: (values.status || 'Draft') as TravelPackage['status'] }, ...items])
    if (type === 'lead') setLeads((items) => [{ id: id(), reference: `RHQ-${today().slice(0, 4)}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, name: values.name, phone: values.phone, email: values.email, service: values.service, travelPeriod: values.travelPeriod || 'Flexible', preferredDepartureDate: values.preferredDepartureDate || undefined, departureLocation: values.departureLocation?.trim() || undefined, state: values.state?.trim() || undefined, travelTiming: values.travelTiming || undefined, paymentPlan: values.paymentPlan || undefined, source: values.source, status: (values.status || 'New') as Lead['status'], receivedAt: today(), followUp: values.followUp || undefined, groupSize: Number(values.groupSize || 1), city: values.city }, ...items])
    if (type === 'customer') setCustomers((items) => [{ id: id(), reference: reference('CUS'), name: values.name, phone: values.phone, email: values.email, nationality: values.nationality || 'Nigerian', city: values.city, historical: values.historical === 'true', createdAt: today() }, ...items])
    if (type === 'booking') {
      const selectedPackage = packages.find((item) => item.id === values.packageId)
      const partySize = Number(values.partySize || 1)
      const status = (values.status || 'Pending Confirmation') as Booking['status']
      if (selectedPackage && bookingReservesPlaces(status)) {
        if (selectedPackage.status !== 'Active' || (selectedPackage.availability !== null && selectedPackage.availability < partySize)) return
        if (selectedPackage.availability !== null) {
          const availability = selectedPackage.availability - partySize
          setPackages((items) => items.map((item) => item.id === selectedPackage.id ? { ...item, availability, status: packageAvailabilityStatus(item.status, availability) } : item))
        }
      }
      setBookings((items) => [{ id: id(), reference: `BKG-${today().slice(0, 4)}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, customerId: values.customerId, packageId: values.packageId || undefined, packageName: values.packageName, agreedPrice: Number(values.agreedPrice || values.amount), partySize, currency: 'NGN', bookingDate: today(), departureDate: values.departureDate, returnDate: values.returnDate, status }, ...items])
    }
    if (type === 'payment') {
      const enteredCustomerName = values.customerName?.split(' — ')[0].trim().toLocaleLowerCase()
      const matchingCustomers = customers.filter((item) => item.name.trim().toLocaleLowerCase() === enteredCustomerName)
      let customer = customers.find((item) => item.reference === values.customerName?.split(' — ').at(-1)) || (matchingCustomers.length === 1 ? matchingCustomers[0] : undefined)
      if (!customer && values.customerName?.trim()) {
        customer = { id: id(), reference: reference('CUS'), name: values.customerName.trim(), phone: values.customerPhone.trim(), email: values.customerEmail.trim() || undefined, nationality: values.customerNationality || 'Nigerian', createdAt: today() }
        setCustomers((items) => [customer!, ...items])
      }
      if (customer) {
        const selectedBooking = bookings.find((booking) => booking.id === values.bookingId && booking.customerId === customer!.id)
        setPayments((items) => [{ id: id(), reference: reference('PAY'), bookingId: selectedBooking?.id, customerId: customer!.id, packageId: values.purposeType === 'package' ? values.packageId || undefined : undefined, purpose: values.purposeType === 'package' ? (selectedBooking?.packageName || packages.find((item) => item.id === values.packageId)?.name || 'Package payment') : values.customPurpose.trim(), amount: Number(values.amount), date: values.date, method: values.method as Payment['method'], status: (values.status || 'Confirmed') as Payment['status'], transactionReference: values.transactionReference || undefined }, ...items])
      }
    }
    if (type === 'traveller') { const linkedCustomer = customers.find((customer) => customer.id === values.customerId); setTravellers((items) => [{ id: id(), name: values.name?.trim() || linkedCustomer?.name || 'Unnamed traveller', customerId: linkedCustomer?.id, bookingId: values.bookingId, nationality: values.nationality || linkedCustomer?.nationality || 'Nigerian', status: (values.status || 'Not Started') as Traveller['status'], group: values.group?.trim() || undefined, documentsComplete: values.documentsComplete === 'true' }, ...items]) }
    setAction(null)
  }


  const restorePendingDelete = (pending: PendingDelete) => {
    const { type, ids, records } = pending
    if (type === 'lead') setLeads((items) => [...records as Lead[], ...items.filter((item) => !ids.includes(item.id))])
    if (type === 'customer') setCustomers((items) => [...records as Customer[], ...items.filter((item) => !ids.includes(item.id))])
    if (type === 'package') setPackages((items) => [...records as TravelPackage[], ...items.filter((item) => !ids.includes(item.id))])
    if (type === 'booking') setBookings((items) => [...records as Booking[], ...items.filter((item) => !ids.includes(item.id))])
    if (type === 'traveller') setTravellers((items) => [...records as Traveller[], ...items.filter((item) => !ids.includes(item.id))])
    if (type === 'supplier-cost') setSupplierCosts((items) => [...records as SupplierCost[], ...items.filter((item) => !ids.includes(item.id))])
    if (type === 'document') setDocuments((items) => [...records as DocumentRecord[], ...items.filter((item) => !ids.includes(item.id))])
  }

  const finalizePendingDelete = async () => {
    const pending = pendingDeleteRef.current
    if (!pending) return
    window.clearTimeout(pending.timer)
    pendingDeleteRef.current = null
    setUndoAvailable(false)
    try {
      {
        const tableByType: Record<DeletableRecordType, string> = { lead: 'leads', customer: 'customers', package: 'packages', booking: 'bookings', traveller: 'travellers', 'supplier-cost': 'supplier_costs', document: 'documents' }
        saveQueue.current = saveQueue.current.catch(() => undefined).then(() => deleteLiveRecords(tableByType[pending.type], pending.ids))
        await saveQueue.current
      }
      setUndoAvailable(false)
      showNotice('Records deleted')
    } catch (error) {
      restorePendingDelete(pending)
      setUndoAvailable(false)
      setSaveError(error instanceof Error ? error.message : 'Could not delete the selected records.')
      showNotice('Could not delete records')
    }
  }

  const undoDelete = () => {
    const pending = pendingDeleteRef.current
    if (!pending) return
    window.clearTimeout(pending.timer)
    pendingDeleteRef.current = null
    restorePendingDelete(pending)
    setUndoAvailable(false)
    showNotice('Deletion undone')
  }

  const deleteRecords = async (type: DeletableRecordType, recordIds: string[]) => {
    const ids = Array.from(new Set(recordIds)).filter(Boolean)
    if (!ids.length) return
    const dependencies: Partial<Record<DeletableRecordType, boolean>> = {
      lead: ids.some((recordId) => customers.some((item) => item.leadId === recordId)),
      customer: ids.some((recordId) => bookings.some((item) => item.customerId === recordId) || payments.some((item) => item.customerId === recordId) || travellers.some((item) => item.customerId === recordId)),
      package: ids.some((recordId) => bookings.some((item) => item.packageId === recordId) || payments.some((item) => item.packageId === recordId)),
      booking: ids.some((recordId) => travellers.some((item) => item.bookingId === recordId) || payments.some((item) => item.bookingId === recordId) || supplierCosts.some((item) => item.bookingId === recordId)),
      'supplier-cost': ids.some((recordId) => supplierPayments.some((item) => item.supplierCostId === recordId)),
    }
    if (dependencies[type]) throw new Error('Some selected records have linked records. Remove or reassign those links first. Booking and financial history is protected.')
    if (pendingDeleteRef.current) await finalizePendingDelete()
    const recordsByType: Record<DeletableRecordType, DeletableRecord[]> = {
      lead: leads.filter((item) => ids.includes(item.id)),
      customer: customers.filter((item) => ids.includes(item.id)),
      package: packages.filter((item) => ids.includes(item.id)),
      booking: bookings.filter((item) => ids.includes(item.id)),
      traveller: travellers.filter((item) => ids.includes(item.id)),
      'supplier-cost': supplierCosts.filter((item) => ids.includes(item.id)),
      document: documents.filter((item) => ids.includes(item.id)),
    }
    const records = recordsByType[type]
    if (!records.length) return
    if (type === 'lead') setLeads((items) => items.filter((item) => !ids.includes(item.id)))
    if (type === 'customer') setCustomers((items) => items.filter((item) => !ids.includes(item.id)))
    if (type === 'package') setPackages((items) => items.filter((item) => !ids.includes(item.id)))
    if (type === 'booking') setBookings((items) => items.filter((item) => !ids.includes(item.id)))
    if (type === 'traveller') setTravellers((items) => items.filter((item) => !ids.includes(item.id)))
    if (type === 'supplier-cost') setSupplierCosts((items) => items.filter((item) => !ids.includes(item.id)))
    if (type === 'document') setDocuments((items) => items.filter((item) => !ids.includes(item.id)))
    const pending: PendingDelete = { type, ids, records, timer: 0 }
    pending.timer = window.setTimeout(() => { void finalizePendingDelete() }, 7000)
    pendingDeleteRef.current = pending
    setUndoAvailable(true)
    showNotice('Records removed', 7000)
  }

  const convertLead = (leadId: string, values: Record<string, string> = {}) => {
    const original = leads.find((item) => item.id === leadId)
    if (!original) return
    const lead = { ...original, name: values.name ?? original.name, phone: values.phone ?? original.phone, email: values.email ?? original.email, city: values.city ?? original.city, status: 'Converted' as const }
    const existing = customers.find((customer) => customer.leadId === leadId)
    if (!existing) {
      const customer: Customer = {
        id: id(),
        reference: reference('CUS'),
        name: lead.name,
        phone: lead.phone,
        email: lead.email,
        nationality: 'Nigerian',
        city: lead.city,
        leadId,
        createdAt: today(),
      }
      setCustomers((items) => [customer, ...items])
    }
    setLeads((items) => items.map((item) => item.id === leadId ? { ...lead } : item))
  }

  const reversePayment = (paymentId: string, reason: string) => {
    if (!reason.trim()) return
    setPayments((items) => items.map((payment) => payment.id === paymentId && payment.status === 'Confirmed' ? { ...payment, status: 'Reversed', reversalReason: reason.trim() } : payment))
  }

  const voidSupplierPayment = (paymentId: string, reason: string) => {
    const cleanReason = reason.trim()
    if (!cleanReason) return
    const payment = supplierPayments.find((item) => item.id === paymentId)
    if (!payment || payment.status === 'Voided') return
    const cost = supplierCosts.find((item) => item.id === payment.supplierCostId)
    if (!cost || (payment.status || 'Confirmed') !== 'Confirmed') return
    const paid = Math.max(0, confirmedSupplierPaid(cost.id, supplierPayments) - payment.amount)
    const status: SupplierCost['status'] = paid >= cost.amount ? 'Paid' : cost.dueDate < today() ? 'Overdue' : paid > 0 ? 'Partially Paid' : 'Unpaid'
    setSupplierPayments((items) => items.map((item) => item.id === paymentId ? { ...item, status: 'Voided', voidReason: cleanReason } : item))
    setSupplierCosts((items) => items.map((item) => item.id === cost.id ? { ...item, paid, status } : item))
  }

  const updateRecord = (type: QuickActionType, recordId: string, values: Record<string, string>) => {
    if (type === 'document') setDocuments((items) => items.map((item) => item.id === recordId ? { ...item, name: values.name, category: values.category, relatedType: values.relatedType as DocumentRecord['relatedType'], relatedReference: values.relatedReference, url: values.url, status: values.status as DocumentRecord['status'] } : item))
    if (type === 'supplier-cost') setSupplierCosts((items) => items.map((item) => { if (item.id !== recordId) return item; const paid = confirmedSupplierPaid(item.id, supplierPayments); const amount = Math.max(Number(values.amount), paid); const status: SupplierCost['status'] = paid >= amount ? 'Paid' : values.dueDate < today() ? 'Overdue' : paid > 0 ? 'Partially Paid' : 'Unpaid'; return { ...item, supplier: values.supplier, category: values.category, amount, paid, dueDate: values.dueDate, status } }))
    if (type === 'package') setPackages((items) => items.map((item) => { if (item.id !== recordId) return item; const availability = Number(values.availability || 0); const requestedStatus = values.status as TravelPackage['status']; return { ...item, code: values.code, name: values.name, category: values.category, destination: values.destination, departureLocation: values.departureLocation?.trim() || undefined, departureDate: values.departureDate?.trim() || undefined, sourceAgent: values.sourceAgent?.trim() || undefined, notes: values.notes?.trim() || undefined, duration: values.duration, price: Number(values.price), estimatedCost: values.estimatedCost?.trim() ? Number(values.estimatedCost) : null, availability: values.availability?.trim() ? Number(values.availability) : null, status: packageAvailabilityStatus(requestedStatus, values.availability?.trim() ? availability : null) } }))
    if (type === 'lead' && values.status === 'Converted') convertLead(recordId, values)
    if (type === 'lead' && values.status !== 'Converted') setLeads((items) => items.map((item) => item.id === recordId ? { ...item, name: values.name, phone: values.phone, email: values.email || undefined, service: values.service, source: values.source, travelPeriod: values.travelPeriod || 'Flexible', preferredDepartureDate: values.preferredDepartureDate || undefined, departureLocation: values.departureLocation?.trim() || undefined, state: values.state?.trim() || undefined, travelTiming: values.travelTiming || undefined, paymentPlan: values.paymentPlan || undefined, status: values.status as Lead['status'], followUp: values.followUp || undefined, groupSize: Number(values.groupSize || 1), city: values.city || undefined, notes: values.notes || undefined } : item))
    if (type === 'customer') setCustomers((items) => items.map((item) => item.id === recordId ? { ...item, name: values.name, phone: values.phone, email: values.email || undefined, nationality: values.nationality, city: values.city || undefined, historical: values.historical === 'true', notes: values.notes || undefined } : item))
    if (type === 'booking') {
      const existing = bookings.find((item) => item.id === recordId)
      if (existing) {
        const nextPartySize = Number(values.partySize || existing.partySize || 1)
        const nextStatus = values.status as Booking['status']
        const wasReserved = bookingReservesPlaces(existing.status) ? (existing.partySize || 1) : 0
        const willBeReserved = bookingReservesPlaces(nextStatus) ? nextPartySize : 0
        const delta = willBeReserved - wasReserved
        const linkedPackage = existing.packageId ? packages.find((item) => item.id === existing.packageId) : undefined
        if (linkedPackage && delta > 0 && (linkedPackage.status !== 'Active' || (linkedPackage.availability != null && linkedPackage.availability < delta))) return
        if (linkedPackage && linkedPackage.availability != null && delta !== 0) {
          const availability = linkedPackage.availability - delta
          setPackages((items) => items.map((item) => item.id === linkedPackage.id ? { ...item, availability, status: packageAvailabilityStatus(item.status, availability) } : item))
        }
        setBookings((items) => items.map((item) => item.id === recordId ? { ...item, packageName: values.packageName, agreedPrice: Number(values.agreedPrice), partySize: nextPartySize, departureDate: values.departureDate, returnDate: values.returnDate, status: nextStatus } : item))
      }
    }
    if (type === 'payment') setPayments((items) => items.map((item) => item.id === recordId ? { ...item, amount: item.status === 'Pending' ? Number(values.amount) : item.amount, date: values.date, method: values.method as Payment['method'], status: item.status === 'Pending' ? (values.status as Payment['status']) : item.status, transactionReference: values.transactionReference || undefined } : item))
    if (type === 'traveller') setTravellers((items) => items.map((item) => { if (item.id !== recordId) return item; const linkedCustomer = customers.find((customer) => customer.id === values.customerId); return { ...item, name: values.name?.trim() || item.name, customerId: linkedCustomer?.id, nationality: values.nationality || linkedCustomer?.nationality || item.nationality, group: values.group?.trim() || undefined, status: values.status as Traveller['status'], documentsComplete: values.documentsComplete === 'true' } }))
    setEditing(null)
  }

  const retrySave = () => { setSaveError(null); setSaveRetry((attempt) => attempt + 1) }

  const value = useMemo(() => ({ mode, saveNotice, saveError, retrySave, leads, customers, bookings, packages, payments, travellers, supplierCosts, supplierPayments, documents, action, setAction, actionDefaults, deleteRecords, undoAvailable, undoDelete, addRecord, editing, setEditing, updateRecord, convertLead, reversePayment, voidSupplierPayment }), [mode, saveNotice, saveError, undoAvailable, leads, customers, bookings, packages, payments, travellers, supplierCosts, supplierPayments, documents, action, actionDefaults, editing])
  return <StoreContext.Provider value={value}>{dataError ? <div role="alert" className="data-connection-error">Live database error: {dataError}. The workspace has been paused so that changes cannot overwrite records that failed to load.</div> : !dataReady ? (showLoadingSkeleton ? <WorkspaceSkeleton /> : <div className="workspace-loading-pending" role="status" aria-label="Loading workspace" />) : <>{saveError && <div className="data-save-error" role="alert"><div><strong>Some changes haven't reached the database.</strong><span>{saveError}</span></div><button type="button" onClick={retrySave}>Retry save</button></div>}{children}</>}</StoreContext.Provider>
}

export const useAppStore = () => {
  const context = useContext(StoreContext)
  if (!context) throw new Error('useAppStore must be used inside AppStoreProvider')
  return context
}
