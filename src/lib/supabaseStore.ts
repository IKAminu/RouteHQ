import type { Booking, Customer, DocumentRecord, Lead, Payment, SupplierCost, SupplierPayment, TravelPackage, Traveller } from '@/types'
import { supabase } from '@/lib/supabase'

type Row = Record<string, any>
type StoreData = {
  leads: Lead[]; customers: Customer[]; packages: TravelPackage[]; bookings: Booking[]
  travellers: Traveller[]; payments: Payment[]; supplierCosts: SupplierCost[]
  supplierPayments: SupplierPayment[]; documents: DocumentRecord[]
}

const client = () => {
  if (!supabase) throw new Error('Supabase is not configured. Check the project URL and publishable key.')
  return supabase
}

async function agencyContext() {
  const { data, error } = await client().rpc('get_my_agency_context')
  if (error) throw error
  const context = Array.isArray(data) ? data[0] : data
  if (!context?.agency_id) throw new Error('This account is not linked to an active agency workspace.')
  const { data: userData, error: userError } = await client().auth.getUser()
  if (userError) throw userError
  return { agencyId: String(context.agency_id), userId: userData.user?.id ?? null }
}

async function rows(table: string, agencyId: string): Promise<Row[]> {
  const pageSize = 500
  const records: Row[] = []
  let lastId: string | null = null
  while (true) {
    let query = client().from(table).select('*').eq('agency_id', agencyId).order('id', { ascending: true }).limit(pageSize)
    if (lastId) query = query.gt('id', lastId)
    const { data, error } = await query
    if (error) throw error
    const page = (data ?? []) as Row[]
    records.push(...page)
    if (page.length < pageSize) break
    const next = page[page.length - 1]?.id
    if (typeof next !== 'string' || next === lastId) throw new Error(`Could not continue loading ${table}: pagination did not advance.`)
    lastId = next
  }
  return records
}

const dateOnly = (value: unknown) => value ? String(value).slice(0, 10) : ''
const key = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[ -]+/g, '_')
const money = (minor: unknown) => Number(minor ?? 0) / 100
const minor = (major: number) => Math.round(Number(major || 0) * 100)
const asDateTime = (value?: string) => value ? (value.length === 10 ? `${value}T12:00:00.000Z` : value) : null

function leadFromRow(r: Row): Lead {
  const m = r.metadata || {}
  const statuses: Record<string, Lead['status']> = { new:'New', contacted:'Contacted', follow_up_required:'Follow-up Required', interested:'Interested', nurture:'Nurture', converted:'Converted', not_interested:'Not Interested', lost:'Lost' }
  return {
    id:r.id, reference:r.lead_ref || '', name:r.full_name, phone:r.phone || '', email:r.email || undefined,
    service:m.service || r.interest || 'General Travel', travelPeriod:m.travelPeriod || 'Flexible',
    preferredDepartureDate:m.preferredDepartureDate || undefined, departureLocation:m.departureLocation || undefined,
    state:m.state || undefined, travelTiming:m.travelTiming || undefined, paymentPlan:m.paymentPlan || undefined,
    source:r.source || 'Other', campaign:m.campaign || undefined, status:statuses[key(r.status)] || 'New',
    receivedAt:dateOnly(r.created_at), followUp:dateOnly(r.follow_up_at) || undefined,
    groupSize:Number(m.groupSize || 1), city:m.city || undefined, notes:r.notes || undefined,
  }
}

function customerFromRow(r: Row): Customer {
  const m = r.metadata || {}
  return { id:r.id, reference:r.customer_ref || '', name:r.full_name, phone:r.phone || '', email:r.email || undefined,
    nationality:r.nationality || 'Nigerian', city:r.address || undefined, leadId:m.leadId || undefined,
    historical:Boolean(m.historical), notes:r.notes || undefined, createdAt:dateOnly(r.created_at) }
}

function packageFromRow(r: Row): TravelPackage {
  const m = r.metadata || {}
  const statuses: Record<string, TravelPackage['status']> = { draft:'Draft', published:'Active', full:'Fully Booked', completed:'Archived', archived:'Archived' }
  return { id:r.id, code:r.package_ref || '', name:r.name, category:r.package_type || 'Other Tours',
    destination:m.destination || r.description || '', departureLocation:r.departure_location || undefined,
    departureDate:dateOnly(r.departure_date) || undefined, sourceAgent:r.supplier_name || undefined,
    notes:r.notes || undefined, duration:r.duration_days ? `${r.duration_days} days` : (m.duration || ''),
    price:money(r.price_minor), estimatedCost:m.estimatedCostMinor == null ? null : money(m.estimatedCostMinor),
    currency:'NGN', availability:r.capacity == null ? null : Number(r.capacity), status:statuses[key(r.status)] || 'Draft' }
}

function bookingFromRow(r: Row): Booking {
  const m = r.metadata || {}
  const statuses: Record<string, Booking['status']> = { enquiry:'Enquiry', reserved:'Pending Confirmation', confirmed:'Confirmed', cancelled:'Cancelled', completed:'Completed' }
  return { id:r.id, reference:r.booking_ref || '', customerId:r.customer_id || '', packageId:r.package_id || undefined,
    packageName:m.packageName || '', agreedPrice:money(r.total_amount_minor), partySize:Number(r.traveller_count || 1),
    currency:'NGN', bookingDate:dateOnly(r.booking_date), departureDate:dateOnly(r.departure_date),
    returnDate:dateOnly(r.return_date), status:m.uiStatus || statuses[key(r.status)] || 'Enquiry',
    supplier:m.supplier || undefined, historical:Boolean(m.historical) }
}

function travellerFromRow(r: Row): Traveller {
  const m = r.metadata || {}
  return { id:r.id, name:r.full_name, customerId:r.customer_id || undefined, bookingId:r.booking_id || '',
    nationality:r.nationality || 'Nigerian', status:m.uiStatus || m.status || (r.visa_status ? String(r.visa_status) : 'Not Started'),
    group:r.room_group || undefined, documentsComplete:Boolean(m.documentsComplete), passportExpiry:dateOnly(r.passport_expiry) || undefined }
}

function paymentFromRow(r: Row, reversalReason?: string): Payment {
  const m = r.metadata || {}
  const statuses: Record<string, Payment['status']> = { pending:'Pending', confirmed:'Confirmed', failed:'Failed', reversed:'Reversed' }
  const methods: Record<string, Payment['method']> = { bank_transfer:'Bank Transfer', cash:'Cash', pos:'POS', other:'Other' }
  return { id:r.id, reference:r.payment_ref || '', bookingId:r.booking_id || undefined, customerId:r.customer_id || '',
    packageId:m.packageId || undefined, purpose:m.purpose || r.notes || 'Payment', amount:money(r.amount_minor),
    date:dateOnly(r.payment_date), method:methods[key(r.payment_method)] || 'Other',
    status:statuses[key(r.status)] || 'Pending', transactionReference:r.external_reference || undefined,
    reversalReason:reversalReason || undefined, historical:Boolean(m.historical) }
}

async function loadStore(): Promise<StoreData> {
  const { agencyId } = await agencyContext()
  const [leadRows, customerRows, packageRows, bookingRows, travellerRows, paymentRows, supplierRows, costRows, supplierPaymentRows, documentRows, reversalRows] =
    await Promise.all(['leads','customers','packages','bookings','travellers','payments','suppliers','supplier_costs','supplier_payments','documents'].map(table => rows(table, agencyId))
      .concat([rows('payment_reversals', agencyId)]))
  const supplierNames = new Map(supplierRows.map(r => [r.id, r.name]))
  const paidByCost = new Map<string, number>()
  for (const payment of supplierPaymentRows) if (key(payment.status) === 'confirmed') paidByCost.set(payment.supplier_cost_id, (paidByCost.get(payment.supplier_cost_id) || 0) + money(payment.amount_minor))
  const bookingsById = new Map(bookingRows.map(r => [r.id, r]))
  const customersById = new Map(customerRows.map(r => [r.id, r]))
  const travellersById = new Map(travellerRows.map(r => [r.id, r]))
  const reversalReasonByPayment = new Map<string,string>(reversalRows.map(r => [r.payment_id, r.reason]))
  return {
    leads:leadRows.map(leadFromRow),
    customers:customerRows.map(customerFromRow),
    packages:packageRows.map(packageFromRow),
    bookings:bookingRows.map(bookingFromRow),
    travellers:travellerRows.map(travellerFromRow),
    payments:paymentRows.map(r => paymentFromRow(r, reversalReasonByPayment.get(r.id))),
    supplierCosts:costRows.map(r => {
      const paid = paidByCost.get(r.id) || 0
      const dueDate = dateOnly(r.due_date)
      const status: SupplierCost['status'] = key(r.status) === 'paid' ? 'Paid' : paid > 0 ? 'Partially Paid' : dueDate && dueDate < new Date().toISOString().slice(0,10) ? 'Overdue' : 'Unpaid'
      return { id:r.id, bookingId:r.booking_id || '', supplier:supplierNames.get(r.supplier_id) || 'Supplier',
        category:r.description, amount:money(r.amount_minor), dueDate, paid, status }
    }),
    supplierPayments:supplierPaymentRows.map(r => ({ id:r.id, supplierCostId:r.supplier_cost_id, amount:money(r.amount_minor),
      date:dateOnly(r.payment_date), method:(r.notes?.match(/Method: ([^;\n]+)/)?.[1] || 'Other') as SupplierPayment['method'],
      reference:r.reference || undefined, status:key(r.status)==='void'?'Voided':'Confirmed',
      voidReason:r.notes?.match(/Voided: ([^;\n]+)/)?.[1] })),
    documents:documentRows.map(r => {
      const relatedType: DocumentRecord['relatedType'] = r.traveller_id ? 'Traveller' : r.booking_id ? 'Booking' : r.customer_id ? 'Customer' : 'Booking'
      const relatedId = r.traveller_id || r.booking_id || r.customer_id
      const related = r.traveller_id ? travellersById.get(relatedId) : r.booking_id ? bookingsById.get(relatedId) : customersById.get(relatedId)
      const relatedReference = related?.full_name || related?.booking_ref || related?.customer_ref || ''
      return { id:r.id, name:r.file_name, category:r.document_type, relatedType, relatedReference,
        url:r.external_url || r.storage_path || '', recordedAt:dateOnly(r.created_at), status:'Needs Review' as const }
    }),
  }
}

async function ensureSupplierId(agencyId: string, name: string, cache: Map<string,string>) {
  const clean = name.trim() || 'Unspecified supplier'
  const cacheKey = clean.toLowerCase()
  const existing = cache.get(cacheKey)
  if (existing) return existing
  const { data: found, error: findError } = await client().from('suppliers').select('id').eq('agency_id', agencyId).ilike('name', clean).limit(1).maybeSingle()
  if (findError) throw findError
  if (found?.id) { cache.set(cacheKey, found.id); return found.id }
  const { data, error } = await client().from('suppliers').insert({ agency_id:agencyId, name:clean }).select('id').single()
  if (error) throw error
  cache.set(cacheKey, data.id)
  return data.id
}

async function saveRows(table: string, records: Row[]) {
  if (!records.length) return
  const { error } = await client().from(table).upsert(records, { onConflict:'id' })
  if (error) throw error
}

const changedRecords = <T extends { id: string }>(current: T[], previous: T[] = []) => {
  const prior = new Map(previous.map(record => [record.id, JSON.stringify(record)]))
  return current.filter(record => prior.get(record.id) !== JSON.stringify(record))
}

async function saveStore(data: StoreData, previous?: StoreData) {
  const { agencyId, userId } = await agencyContext()
  const base = { agency_id:agencyId }
  const leadRows = changedRecords(data.leads, previous?.leads).map(r => ({ ...base, id:r.id, lead_ref:r.reference || null, full_name:r.name, email:r.email || null, phone:r.phone || null,
    source:r.source || null, status:key(r.status), interest:r.service || null, follow_up_at:asDateTime(r.followUp), notes:r.notes || null,
    created_by:userId, metadata:{ service:r.service, travelPeriod:r.travelPeriod, preferredDepartureDate:r.preferredDepartureDate,
      departureLocation:r.departureLocation, state:r.state, travelTiming:r.travelTiming, paymentPlan:r.paymentPlan,
      campaign:r.campaign, groupSize:r.groupSize, city:r.city } }))
  const customerRows = changedRecords(data.customers, previous?.customers).map(r => ({ ...base, id:r.id, customer_ref:r.reference || null, full_name:r.name,
    email:r.email || null, phone:r.phone || null, nationality:r.nationality || null, address:r.city || null, notes:r.notes || null,
    created_by:userId, metadata:{ historical:Boolean(r.historical), leadId:r.leadId || null } }))
  const packageRows = changedRecords(data.packages, previous?.packages).map(r => {
    const days = Number.parseInt(r.duration, 10)
    const status = ({ Draft:'draft', Active:'published', 'Fully Booked':'full', Unavailable:'archived', Archived:'archived' } as Record<string,string>)[r.status] || 'draft'
    return { ...base, id:r.id, package_ref:r.code || null, name:r.name, package_type:r.category, description:r.destination,
      departure_location:r.departureLocation || null, departure_date:r.departureDate || null,
      duration_days:Number.isFinite(days) ? days : null, capacity:r.availability, price_minor:minor(r.price), currency_code:r.currency,
      status, supplier_name:r.sourceAgent || null, notes:r.notes || null,
      metadata:{ destination:r.destination, duration:r.duration, estimatedCostMinor:r.estimatedCost == null ? null : minor(r.estimatedCost) } }
  })
  const bookingRows = changedRecords(data.bookings, previous?.bookings).map(r => {
    const status = ({ Enquiry:'enquiry', 'Pending Confirmation':'reserved', 'In Preparation':'reserved', Confirmed:'confirmed',
      'Ready for Travel':'confirmed', Travelling:'confirmed', Completed:'completed', Cancelled:'cancelled' } as Record<string,string>)[r.status] || 'enquiry'
    return { ...base, id:r.id, booking_ref:r.reference || null, customer_id:r.customerId || null, package_id:r.packageId || null,
      status, booking_date:r.bookingDate || new Date().toISOString().slice(0,10), departure_date:r.departureDate || null,
      return_date:r.returnDate || null, traveller_count:Math.max(1,r.partySize || 1), total_amount_minor:minor(r.agreedPrice),
      currency_code:'NGN', created_by:userId,
      metadata:{ packageName:r.packageName, supplier:r.supplier, historical:Boolean(r.historical), uiStatus:r.status } }
  })
  const travellerRows = changedRecords(data.travellers, previous?.travellers).map(r => ({ ...base, id:r.id, booking_id:r.bookingId || null, customer_id:r.customerId || null,
    full_name:r.name, nationality:r.nationality || null, visa_status:null, passport_expiry:r.passportExpiry || null,
    room_group:r.group || null, metadata:{ uiStatus:r.status, documentsComplete:Boolean(r.documentsComplete) } }))
  const supplierCache = new Map<string,string>()
  const supplierCostRows = await Promise.all(changedRecords(data.supplierCosts, previous?.supplierCosts).map(async r => ({ ...base, id:r.id, booking_id:r.bookingId || null,
    supplier_id:await ensureSupplierId(agencyId,r.supplier,supplierCache), description:r.category || r.supplier,
    amount_minor:minor(r.amount), currency_code:'NGN', due_date:r.dueDate || null,
    status:r.status==='Paid'?'paid':r.paid>0?'part_paid':'unpaid' })))
  const changedPayments = changedRecords(data.payments, previous?.payments)
  const changedSupplierPayments = changedRecords(data.supplierPayments, previous?.supplierPayments)
  const [existingPayments,existingSupplierPayments] = await Promise.all([
    changedPayments.length ? rows('payments',agencyId) : Promise.resolve([]),
    changedSupplierPayments.length ? rows('supplier_payments',agencyId) : Promise.resolve([]),
  ])
  const existingPaymentIds = new Set(existingPayments.map(r=>r.id))
  const existingSupplierPaymentIds = new Set(existingSupplierPayments.map(r=>r.id))
  const newPayments = changedPayments.filter(r=>!existingPaymentIds.has(r.id)).map(r => ({
    ...base, id:r.id, booking_id:r.bookingId || null, customer_id:r.customerId || null, payment_ref:r.reference || null,
    amount_minor:minor(r.amount), currency_code:'NGN', payment_method:key(r.method),
    payment_date:asDateTime(r.date) || new Date().toISOString(), status:key(r.status),
    external_reference:r.transactionReference || null, recorded_by:userId, notes:r.purpose || null,
    metadata:{ purpose:r.purpose, packageId:r.packageId || null, historical:Boolean(r.historical) },
  }))
  const newSupplierPayments = changedSupplierPayments.filter(r=>!existingSupplierPaymentIds.has(r.id)).map(r => ({
    ...base, id:r.id, supplier_cost_id:r.supplierCostId, amount_minor:minor(r.amount), currency_code:'NGN',
    payment_date:asDateTime(r.date) || new Date().toISOString(), status:'confirmed', reference:r.reference || null,
    recorded_by:userId, notes:`Method: ${r.method || 'Other'}`,
  }))
  const documentRows = changedRecords(data.documents, previous?.documents).map(r => {
    const traveller = r.relatedType === 'Traveller' ? data.travellers.find(x=>x.name===r.relatedReference) : undefined
    const customer = r.relatedType === 'Customer' ? data.customers.find(x=>x.name===r.relatedReference || x.reference===r.relatedReference) : undefined
    const booking = r.relatedType === 'Booking' ? data.bookings.find(x=>x.reference===r.relatedReference) : undefined
    const payment = r.relatedType === 'Payment' ? data.payments.find(x=>x.reference===r.relatedReference) : undefined
    return { ...base, id:r.id, document_type:r.category || 'Other', file_name:r.name,
      storage_path:r.url && !/^https?:\/\//i.test(r.url) ? r.url : null,
      external_url:r.url && /^https?:\/\//i.test(r.url) ? r.url : null,
      mime_type:null, file_size_bytes:null, uploaded_by:userId,
      booking_id:booking?.id || traveller?.bookingId || null, traveller_id:traveller?.id || null,
      customer_id:customer?.id || traveller?.customerId || null }
  })
  await saveRows('leads',leadRows)
  await saveRows('customers',customerRows)
  await saveRows('packages',packageRows)
  await saveRows('bookings',bookingRows)
  await saveRows('travellers',travellerRows)
  await saveRows('supplier_costs',supplierCostRows)
  if (newPayments.length) {
    const { error } = await client().from('payments').insert(newPayments)
    if (error) throw error
  }
  if (newSupplierPayments.length) {
    const { error } = await client().from('supplier_payments').insert(newSupplierPayments)
    if (error) throw error
  }
  for (const record of changedPayments) {
    const old = existingPayments.find(r=>r.id===record.id)
    if (old && key(old.status)!==key(record.status)) {
      const { error } = await client().rpc('transition_agency_payment',{_payment_id:record.id,_status:key(record.status),_reason:record.reversalReason || null})
      if (error) throw error
    }
  }
  for (const record of changedSupplierPayments) {
    const old = existingSupplierPayments.find(r=>r.id===record.id)
    if (old && key(old.status)!==key(record.status) && record.status==='Voided') {
      const { error } = await client().rpc('void_agency_supplier_payment',{_supplier_payment_id:record.id,_reason:record.voidReason || 'Voided by agency operator'})
      if (error) throw error
    }
  }
  await saveRows('documents',documentRows)
}

export const loadLiveStore = () => loadStore()
export const saveLiveStore = (data: StoreData, previous?: StoreData) => saveStore(data, previous)

export async function deleteLiveRecords(table: string, ids: string[]) {
  if (!ids.length) return
  const { agencyId } = await agencyContext()
  const { data, error } = await client().from(table).delete().in('id',ids).eq('agency_id',agencyId).select('id')
  if (error) throw error
  if ((data?.length ?? 0) !== ids.length) throw new Error('Not all selected records could be deleted. Check permissions or whether a record has linked data.')
}
