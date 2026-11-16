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
  const weeklyRevenue = Array.from({ length: 7 }, (_, index) => {
    const day = new Date()
    day.setDate(day.getDate() - (6 - index))
    const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    const amount = payments.filter((payment) => payment.status === 'Confirmed' && payment.date === key).reduce((sum, payment) => sum + payment.amount, 0)
    return { key, label: day.toLocaleDateString('en-NG', { weekday: 'short' }), amount }
  })
  const weeklyMax = Math.max(1, ...weeklyRevenue.map((day) => day.amount))
  const chartPoints = weeklyRevenue.map((day, index) => ({ ...day, x: 28 + index * (904 / 6), y: 104 - (day.amount / weeklyMax) * 76 }))
  const chartLine = chartPoints.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')
  const chartArea = `${chartLine} L ${chartPoints[chartPoints.length - 1].x} 116 L ${chartPoints[0].x} 116 Z`
  const weeklyTotal = weeklyRevenue.reduce((sum, day) => sum + day.amount, 0)
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
      <div className="revenue-panel-head"><div><span className="eyebrow">PAYMENTS · LAST 7 DAYS</span><h2>{money(weeklyTotal)}</h2><p>Confirmed payments received during the past week</p></div><span className="revenue-period">7 days</span></div>
      <div className="revenue-line-chart" role="img" aria-label={`Seven-day confirmed payments line graph. Total ${money(weeklyTotal)}.`}><svg viewBox="0 0 960 132" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="revenueAreaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d8d8df" stopOpacity=".24" /><stop offset="100%" stopColor="#d8d8df" stopOpacity="0" /></linearGradient><linearGradient id="revenueLineStroke" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#777780" /><stop offset="55%" stopColor="#d5d5dc" /><stop offset="100%" stopColor="#f0a36b" /></linearGradient><filter id="revenueLineGlow" x="-20%" y="-80%" width="140%" height="260%"><feGaussianBlur stdDeviation="2.5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs><path d={chartArea} fill="url(#revenueAreaFill)" /><path d={chartLine} fill="none" stroke="url(#revenueLineStroke)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" filter="url(#revenueLineGlow)" vectorEffect="non-scaling-stroke" />{chartPoints.map((point) => <g key={point.key}><circle cx={point.x} cy={point.y} r="3.5" fill="#f4f4f5" stroke="#777780" strokeWidth="1.5" vectorEffect="non-scaling-stroke" /><title>{`${point.label}: ${money(point.amount)}`}</title></g>)}</svg><div className="revenue-axis">{weeklyRevenue.map((day) => <span key={day.key}>{day.label}</span>)}</div></div>
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
