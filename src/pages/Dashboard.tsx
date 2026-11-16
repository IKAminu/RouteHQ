import { useEffect, useState } from 'react'
import { ArrowRight, CalendarDays, CircleDollarSign, Clock3, PlaneLanding, PlaneTakeoff, Users } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Link } from 'react-router'
import { Badge, PageHeader, TableShell } from '@/components/ui'
import { useAppStore } from '@/hooks/useAppStore'
import { bookingBalance, confirmedPaid, daysFromToday, money, shortDate, todayDate, travellerCount } from '@/lib/business'

export function Dashboard() {
  const { mode, leads, bookings, customers, payments, travellers } = useAppStore()
  const [greetingName, setGreetingName] = useState(mode === 'demo' ? 'guest' : 'there')
  const [trendRange, setTrendRange] = useState<'7d' | '30d' | '6m' | '12m'>('7d')
  useEffect(() => {
    if (mode === 'demo') { setGreetingName('guest'); return }
    let active = true
    supabase?.auth.getUser().then(({ data }) => {
      const email = data.user?.email?.toLowerCase()
      if (!active || !email) return
      setGreetingName(data.user?.user_metadata?.full_name || data.user?.user_metadata?.name || email.split('@')[0])
    })
    return () => { active = false }
  }, [mode])
  const activeLeads = leads.filter((lead) => !['Converted', 'Lost', 'Not Interested'].includes(lead.status))
  const activeBookings = bookings.filter((booking) => !['Completed', 'Cancelled'].includes(booking.status))
  const upcoming = bookings.filter((booking) => !['Completed', 'Cancelled'].includes(booking.status) && daysFromToday(booking.departureDate) >= 0 && daysFromToday(booking.departureDate) <= 7)
  const abroad = travellers.filter((traveller) => traveller.status === 'Abroad')
  const outstanding = bookings.reduce((sum, booking) => sum + bookingBalance(booking, payments), 0)
  const received = payments.filter((payment) => payment.status === 'Confirmed').reduce((sum, payment) => sum + payment.amount, 0)
  const todayParts = todayDate().split('-').map(Number)
  const todayUTC = new Date(Date.UTC(todayParts[0], todayParts[1] - 1, todayParts[2]))
  const shiftMonths = (date: Date, months: number) => {
    const targetMonth = date.getUTCMonth() + months
    const year = date.getUTCFullYear() + Math.floor(targetMonth / 12)
    const month = ((targetMonth % 12) + 12) % 12
    const day = Math.min(date.getUTCDate(), new Date(Date.UTC(year, month + 1, 0)).getUTCDate())
    return new Date(Date.UTC(year, month, day))
  }
  const startDate = trendRange === '7d'
    ? new Date(todayUTC.getTime() - 6 * 86400000)
    : trendRange === '30d'
      ? new Date(todayUTC.getTime() - 29 * 86400000)
      : shiftMonths(todayUTC, trendRange === '6m' ? -5 : -11)
  const dateKey = (date: Date) => date.toISOString().slice(0, 10)
  const rangeStartKey = dateKey(startDate)
  const checkpoints = trendRange === '7d'
    ? Array.from({ length: 7 }, (_, index) => new Date(startDate.getTime() + index * 86400000))
    : trendRange === '30d'
      ? Array.from({ length: 5 }, (_, index) => new Date(startDate.getTime() + Math.round(index * 29 / 4) * 86400000))
      : Array.from({ length: trendRange === '6m' ? 6 : 12 }, (_, index) => shiftMonths(startDate, index))
  const bookingTrend = checkpoints.map((date) => {
    const key = dateKey(date)
    const periodBookings = bookings.filter((booking) => booking.status !== 'Cancelled' && booking.bookingDate >= rangeStartKey && booking.bookingDate <= key)
    const bookingIds = new Set(periodBookings.map((booking) => booking.id))
    const bookedAmount = periodBookings.reduce((sum, booking) => sum + booking.agreedPrice, 0)
    const paidAmount = payments.filter((payment) => { const bookingId = payment.bookingId; return bookingId !== undefined && bookingIds.has(bookingId) && payment.status === 'Confirmed' && payment.date <= key })
      .reduce((sum, payment) => sum + payment.amount, 0)
    const label = trendRange === '7d'
      ? date.toLocaleDateString('en-NG', { weekday: 'short', timeZone: 'UTC' })
      : trendRange === '30d'
        ? date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', timeZone: 'UTC' })
        : date.toLocaleDateString('en-NG', { month: 'short', timeZone: 'UTC' })
    return { key, label, bookedAmount, paidAmount: Math.min(bookedAmount, paidAmount), outstanding: Math.max(0, bookedAmount - paidAmount) }
  })
  const trendCurrent = bookingTrend[bookingTrend.length - 1]
  const highestBookingValue = Math.max(0, ...bookingTrend.map((day) => day.bookedAmount))
  const chartStep = highestBookingValue <= 1_000_000
    ? 100_000
    : highestBookingValue < 10_000_000
      ? 1_000_000
      : Math.ceil(highestBookingValue / 5 / 1_000_000) * 1_000_000
  const chartAxisMax = highestBookingValue <= 1_000_000
    ? 1_000_000
    : Math.max(chartStep, Math.ceil(highestBookingValue / chartStep) * chartStep)
  const chartTicks = Array.from({ length: Math.round(chartAxisMax / chartStep) + 1 }, (_, index) => index * chartStep)
  const chartTickLabel = (amount: number) => amount === 0 ? '0' : amount >= 1_000_000 ? `${amount / 1_000_000}m` : `${amount / 1_000}k`
  const chartY = (amount: number) => 150 - (amount / chartAxisMax) * 126
  const chartX = (index: number) => 112 + index * (900 / Math.max(1, bookingTrend.length - 1))
  const bookedPoints = bookingTrend.map((day, index) => ({ ...day, x: chartX(index), y: chartY(day.bookedAmount) }))
  const paidPoints = bookingTrend.map((day, index) => ({ ...day, x: chartX(index), y: chartY(day.paidAmount) }))
  const smoothPath = (points: typeof bookedPoints) => {
    if (points.length < 2) return ''
    return points.reduce((path, point, index) => {
      if (index === 0) return `M ${point.x} ${point.y}`
      const previous = points[index - 1]
      const beforePrevious = points[index - 2] || previous
      const next = points[index + 1] || point
      const cp1x = previous.x + (point.x - beforePrevious.x) / 6
      const cp1y = previous.y + (point.y - beforePrevious.y) / 6
      const cp2x = point.x - (next.x - previous.x) / 6
      const cp2y = point.y - (next.y - previous.y) / 6
      return `${path} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${point.x} ${point.y}`
    }, '')
  }
  const bookedLine = smoothPath(bookedPoints)
  const paidLine = smoothPath(paidPoints)
  const outstandingArea = `${bookedLine} ${smoothPath([...paidPoints].reverse()).replace(/^M/, 'L')} Z`
  const hour = Number(new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const metrics = [
    { label: 'Active leads', value: activeLeads.length, detail: `${leads.filter((lead) => lead.status === 'New').length} awaiting attention`, icon: Users, to: '/leads' },
    { label: 'Active bookings', value: activeBookings.length, detail: `${upcoming.length} departing soon`, icon: CalendarDays, to: '/bookings' },
    { label: 'Confirmed payments', value: money(received), detail: 'Across recorded transactions', icon: CircleDollarSign, to: '/payments' },
    { label: 'Outstanding balance', value: money(outstanding), detail: 'Calculated from transactions', icon: Clock3, to: '/payments' },
    { label: 'Travellers abroad', value: abroad.length, detail: `${travellers.filter((item) => item.status === 'Ready for Travel').length} ready to travel`, icon: PlaneTakeoff, to: '/travellers' },
    { label: 'Upcoming returns', value: bookings.filter((booking) => !['Completed', 'Cancelled'].includes(booking.status) && daysFromToday(booking.returnDate) >= 0 && daysFromToday(booking.returnDate) <= 10).length, detail: 'Within the next 10 days', icon: PlaneLanding, to: '/travellers' },
  ]

  return <div className="page">
    <PageHeader title={`${greeting}, ${greetingName}`} description="Here is what needs attention across your agency today." action={<div className="date-chip"><CalendarDays size={16} /> {shortDate(todayDate())}</div>} />
    {mode === 'demo' && <section className="demo-banner"><div><strong>Demo workspace</strong><span>Sample records only. Changes stay in this session and are discarded when you leave.</span></div><Link to="/settings">View workspace settings <ArrowRight size={15} /></Link></section>}
    <section className="metrics-grid">{metrics.map(({ label, value, detail, icon: Icon, to }) => <Link className="metric" to={to} key={label}><div className="metric-head"><span>{label}</span><Icon size={18} /></div><strong>{value}</strong><p>{detail}</p></Link>)}</section>
    <section className="revenue-panel">
      <div className="revenue-panel-head">
        <div>
          <span className="eyebrow">BOOKING PERFORMANCE · {trendRange === '7d' ? 'LAST 7 DAYS' : trendRange === '30d' ? 'LAST 30 DAYS' : trendRange === '6m' ? 'LAST 6 MONTHS' : 'LAST 12 MONTHS'}</span>
          <h2>{money(trendCurrent.bookedAmount)}</h2>
          <p>{money(trendCurrent.paidAmount)} confirmed · {money(trendCurrent.outstanding)} outstanding on these bookings</p>
          <div className="revenue-legend"><span><i className="legend-booked" />Total booking value</span><span><i className="legend-paid" />Confirmed payments</span><span><i className="legend-gap" />Outstanding balance</span></div>
        </div>
        <select className="revenue-period-select" aria-label="Chart date range" value={trendRange} onChange={(event) => setTrendRange(event.target.value as typeof trendRange)}><option value="7d">Last 7 days</option><option value="30d">Last 30 days</option><option value="6m">Last 6 months</option><option value="12m">Last 12 months</option></select>
      </div>
      <div className="revenue-line-chart" role="img" aria-label={`Cumulative booking performance for the selected date range. Booking value ${money(trendCurrent.bookedAmount)}, confirmed payments ${money(trendCurrent.paidAmount)}, outstanding ${money(trendCurrent.outstanding)}.`}>
        <svg viewBox="0 0 1040 180" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="outstandingGapFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7897f7" stopOpacity=".20" /><stop offset="100%" stopColor="#7897f7" stopOpacity=".035" /></linearGradient>
            <filter id="bookingLineGlow" x="-20%" y="-80%" width="140%" height="260%"><feGaussianBlur stdDeviation="1.1" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          {chartTicks.map((tick) => {
            const y = chartY(tick)
            return <g key={tick}>
              <line x1="102" x2="1020" y1={y} y2={y} className="chart-gridline" />
              <text x="88" y={y + 3.5} textAnchor="end" className="chart-y-label">{chartTickLabel(tick)}</text>
            </g>
          })}
          <path d={outstandingArea} fill="url(#outstandingGapFill)" />
          <path d={bookedLine} fill="none" className="chart-booked-line" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" filter="url(#bookingLineGlow)" vectorEffect="non-scaling-stroke" />
          <path d={paidLine} fill="none" className="chart-paid-line" strokeWidth="1.45" strokeLinecap="round" strokeLinejoin="round" filter="url(#bookingLineGlow)" vectorEffect="non-scaling-stroke" />
          {bookedPoints.map((point) => <g key={`booked-${point.key}`}><circle cx={point.x} cy={point.y} r="2.5" className="chart-booked-dot" /><title>{`${point.label}: booking value ${money(point.bookedAmount)}`}</title></g>)}
          {paidPoints.map((point) => <g key={`paid-${point.key}`}><circle cx={point.x} cy={point.y} r="2.5" className="chart-paid-dot" /><title>{`${point.label}: confirmed payments ${money(point.paidAmount)}`}</title></g>)}
        </svg>
        <div className="revenue-axis" style={{ gridTemplateColumns: `repeat(${bookingTrend.length}, minmax(0, 1fr))` }}>{bookingTrend.map((day) => <span key={day.key}>{day.label}</span>)}</div>
      </div>
    </section>
    <div className="dashboard-grid">
      <section className="content-section span-two">
        <div className="section-title"><div><h2>Upcoming departures</h2><p>Bookings departing in the next seven days.</p></div><Link to="/bookings">View all <ArrowRight size={15} /></Link></div>
        <TableShell><table><thead><tr><th>Booking</th><th>Customer</th><th>Package</th><th>Departure</th><th>Travellers</th><th>Status</th><th>Requirements</th></tr></thead><tbody>{upcoming.map((booking) => {
          const customer = customers.find((item) => item.id === booking.customerId)
          const count = travellerCount(booking.id, travellers)
          const missing = travellers.filter((item) => item.bookingId === booking.id && !item.documentsComplete).length
          return <tr key={booking.id}><td><strong>{booking.reference}</strong></td><td>{customer?.name}</td><td>{booking.packageName}</td><td>{shortDate(booking.departureDate)}</td><td>{count}</td><td><Badge>{booking.status}</Badge></td><td>{!count ? 'Add travellers' : missing ? `${missing} document check${missing > 1 ? 's' : ''}` : 'Ready'}</td></tr>
        })}</tbody></table>{!upcoming.length && <div className="empty"><strong>No upcoming departures</strong><p>Bookings departing within the next seven days will appear here.</p></div>}</TableShell>
      </section>
      <section className="content-section">
        <div className="section-title"><div><h2>Pending follow-ups</h2><p>Due and overdue lead activity.</p></div><Link to="/leads">Open leads</Link></div>
        <div className="list">{leads.filter((lead) => lead.followUp && daysFromToday(lead.followUp) <= 1 && !['Converted', 'Lost', 'Not Interested'].includes(lead.status)).map((lead) => <div className="list-row" key={lead.id}><div className="avatar">{lead.name.split(' ').map((part) => part[0]).join('')}</div><div><strong>{lead.name}</strong><span>{lead.service} · {lead.source}</span></div><div className="list-end"><Badge>{lead.status}</Badge><small>{daysFromToday(lead.followUp!) < 0 ? 'Overdue' : 'Due today'}</small></div></div>)}</div>{!leads.some((lead) => lead.followUp && daysFromToday(lead.followUp) <= 1 && !['Converted', 'Lost', 'Not Interested'].includes(lead.status)) && <div className="empty"><strong>No follow-ups due</strong><p>There are no overdue or due-today lead follow-ups.</p></div>}
      </section>
      <section className="content-section">
        <div className="section-title"><div><h2>Currently abroad</h2><p>Travel has commenced; not marked returned.</p></div><Link to="/travellers">Operations</Link></div>
        <div className="list">{abroad.map((traveller) => {
          const booking = bookings.find((item) => item.id === traveller.bookingId)!
          return <div className="list-row" key={traveller.id}><div className="avatar">{traveller.name.split(' ').map((part) => part[0]).join('')}</div><div><strong>{traveller.name}</strong><span>{booking?.reference || 'Booking unavailable'} · {booking?.packageName || 'No package details'}</span></div><div className="list-end"><Badge>{traveller.status}</Badge><small>{booking ? `Returns ${shortDate(booking.returnDate)}` : 'Check booking link'}</small></div></div>
        })}</div>{!abroad.length && <div className="empty"><strong>No travellers currently abroad</strong><p>Travellers marked Abroad will appear here.</p></div>}
      </section>
      <section className="content-section span-two">
        <div className="section-title"><div><h2>Outstanding balances</h2><p>Calculated from agreed prices and confirmed transactions.</p></div><Link to="/payments">Finance overview</Link></div>
        <TableShell><table><thead><tr><th>Customer</th><th>Booking</th><th>Agreed price</th><th>Confirmed paid</th><th>Outstanding</th></tr></thead><tbody>{bookings.filter((booking) => bookingBalance(booking, payments) > 0).slice(0, 4).map((booking) => <tr key={booking.id}><td>{customers.find((item) => item.id === booking.customerId)?.name}</td><td><strong>{booking.reference}</strong></td><td>{money(booking.agreedPrice)}</td><td>{money(confirmedPaid(booking.id, payments))}</td><td><strong>{money(bookingBalance(booking, payments))}</strong></td></tr>)}</tbody></table>{!bookings.some((booking) => bookingBalance(booking, payments) > 0) && <div className="empty"><strong>No outstanding balances</strong><p>Bookings with an unpaid balance will appear here.</p></div>}</TableShell>
      </section>
    </div>
  </div>
}
