import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { Button, Field, Input, Select } from '@/components/ui'

type Application = {
  id: string
  agency_name: string
  legal_name: string | null
  registration_number: string | null
  contact_name: string
  email: string
  phone: string
  country_code: string
  requested_plan_code: 'basic' | 'growth' | 'pro'
  status: string
  review_notes: string | null
  submitted_at: string
}

type AgencyContext = {
  agency_id: string
  agency_name: string
  agency_slug: string
  role_code: string
  is_owner: boolean
  plan_code: string | null
  subscription_status: string | null
}

const slugify = (value: string) => value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)

function Shell({ children }: { children: ReactNode }) {
  return <main className="onboarding-shell"><div className="onboarding-brand"><img src={`${import.meta.env.BASE_URL}app-icon.svg`} alt="" /><span>RouteHQ</span></div>{children}<p className="onboarding-foot">RouteHQ · Travel agency operations</p></main>
}

function AgencyApplication({ email, onSubmitted }: { email: string; onSubmitted: () => void }) {
  const [agencyName, setAgencyName] = useState('')
  const [legalName, setLegalName] = useState('')
  const [registrationNumber, setRegistrationNumber] = useState('')
  const [contactName, setContactName] = useState('')
  const [phone, setPhone] = useState('')
  const [plan, setPlan] = useState('basic')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    setBusy(true); setError(''); setInfo('')
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw userError || new Error('Your session has expired. Sign in again.')
      const { error: insertError } = await supabase.from('agency_applications').insert({
        applicant_user_id: user.id,
        agency_name: agencyName.trim(),
        legal_name: legalName.trim() || null,
        registration_number: registrationNumber.trim() || null,
        contact_name: contactName.trim(),
        email: email || user.email || '',
        phone: phone.trim(),
        country_code: 'NG',
        requested_plan_code: plan,
      })
      if (insertError) throw insertError
      setInfo('Your application has been submitted. RouteHQ will review it before activating your agency workspace.')
      onSubmitted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your application.')
    } finally { setBusy(false) }
  }

  return <section className="onboarding-card">
    <span className="onboarding-eyebrow">AGENCY ONBOARDING</span>
    <h1>Apply for a RouteHQ workspace</h1>
    <p className="onboarding-copy">Tell us about your travel agency. Your account is created, but your agency workspace will only become available after approval.</p>
    <form className="onboarding-form" onSubmit={submit}>
      <Field label="Agency or trading name"><Input required value={agencyName} onChange={e=>setAgencyName(e.target.value)} placeholder="e.g. Horizon Travels" /></Field>
      <Field label="Registered legal name" hint="Optional if different from your trading name"><Input value={legalName} onChange={e=>setLegalName(e.target.value)} /></Field>
      <Field label="CAC registration number"><Input value={registrationNumber} onChange={e=>setRegistrationNumber(e.target.value)} placeholder="Optional" /></Field>
      <Field label="Your full name"><Input required value={contactName} onChange={e=>setContactName(e.target.value)} /></Field>
      <Field label="Business email"><Input type="email" value={email} readOnly /></Field>
      <Field label="Business phone number"><Input required type="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+234…" /></Field>
      <Field label="Requested plan"><Select value={plan} onChange={e=>setPlan(e.target.value)}><option value="basic">Basic · One account</option><option value="growth">Growth · Up to five team accounts</option><option value="pro">Pro · Up to five team accounts</option></Select></Field>
      {error && <p className="onboarding-error" role="alert">{error}</p>}
      {info && <p className="onboarding-info" role="status">{info}</p>}
      <Button type="submit" disabled={busy}>{busy ? 'Submitting…' : 'Submit agency application'}</Button>
    </form>
  </section>
}

function ApplicationStatus({ application, onRefresh, onReapply }: { application: Application; onRefresh: () => void; onReapply: () => void }) {
  return <section className="onboarding-card">
    <span className="onboarding-eyebrow">APPLICATION STATUS</span>
    <h1>{application.agency_name}</h1>
    <div className={`application-status status-${application.status}`}>{application.status.replace('_',' ')}</div>
    <p className="onboarding-copy">Your application was submitted on {new Date(application.submitted_at).toLocaleDateString()}. We will activate your agency workspace after review.</p>
    {application.review_notes && <div className="review-note"><strong>Review note</strong><p>{application.review_notes}</p></div>}
    <div className="application-buttons"><Button variant="secondary" onClick={onRefresh}>Refresh status</Button>{application.status==='rejected' && <Button onClick={onReapply}>Submit a new application</Button>}</div>
  </section>
}

function PlatformConsole({ email }: { email: string }) {
  const [applications, setApplications] = useState<Application[]>([])
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [slugs, setSlugs] = useState<Record<string,string>>({})
  const [notes, setNotes] = useState<Record<string,string>>({})
  const load = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase.from('agency_applications').select('*').order('submitted_at',{ascending:false})
    if (error) throw error
    setApplications((data || []) as Application[])
  }, [])
  useEffect(()=>{ void load().catch(e=>setError(e.message || 'Could not load applications.')) },[load])
  const pending = useMemo(()=>applications.filter(a=>['pending','under_review'].includes(a.status)),[applications])
  const review = async (application: Application, action: 'approve'|'reject') => {
    if (!supabase) return
    setBusyId(application.id); setError(''); setNotice('')
    try {
      if(action==='approve') {
        const slug=slugs[application.id] || slugify(application.agency_name)
        const {error: rpcError}=await supabase.rpc('approve_agency_application',{_application_id:application.id,_slug:slug})
        if(rpcError) throw rpcError
        setNotice(`${application.agency_name} approved. Workspace and owner membership created.`)
      } else {
        const {error: rpcError}=await supabase.rpc('reject_agency_application',{_application_id:application.id,_review_notes:notes[application.id] || ''})
        if(rpcError) throw rpcError
        setNotice(`${application.agency_name} application rejected.`)
      }
      await load()
    } catch(e) { setError(e instanceof Error ? e.message : 'Review action failed.') }
    finally { setBusyId('') }
  }
  return <Shell>
    <section className="platform-heading"><div><span className="onboarding-eyebrow">WEB4 · PLATFORM OPERATIONS</span><h1>RouteHQ administration</h1><p>Signed in as {email}</p></div><Button variant="secondary" onClick={()=>supabase?.auth.signOut()}>Sign out</Button></section>
    <div className="platform-stats"><div><strong>{applications.length}</strong><span>Total applications</span></div><div><strong>{pending.length}</strong><span>Awaiting review</span></div><div><strong>{applications.filter(a=>a.status==='approved').length}</strong><span>Approved</span></div></div>
    {notice && <p className="onboarding-info" role="status">{notice}</p>}
    {error && <p className="onboarding-error" role="alert">{error}</p>}
    <section className="platform-list"><div className="platform-list-head"><div><h2>Agency applications</h2><p>Review each application before creating an agency workspace.</p></div><Button variant="secondary" onClick={()=>void load()}>Refresh</Button></div>
      {applications.length===0 ? <p className="onboarding-copy">No agency applications have been submitted yet.</p> : applications.map(a=><article className="application-row" key={a.id}>
        <div className="application-row-head"><div><h3>{a.agency_name}</h3><p>{a.contact_name} · {a.email} · {a.phone}</p></div><span className={`application-status status-${a.status}`}>{a.status.replace('_',' ')}</span></div>
        <div className="application-details"><span>Plan requested: <strong>{a.requested_plan_code.toUpperCase()}</strong></span><span>CAC: {a.registration_number || 'Not supplied'}</span><span>Submitted: {new Date(a.submitted_at).toLocaleString()}</span></div>
        {['pending','under_review'].includes(a.status) && <div className="application-actions">
          <Field label="Agency workspace URL slug"><Input value={slugs[a.id] ?? slugify(a.agency_name)} onChange={e=>setSlugs(old=>({...old,[a.id]:slugify(e.target.value)}))} /></Field>
          <Field label="Review note (for rejection)"><Input value={notes[a.id] || ''} onChange={e=>setNotes(old=>({...old,[a.id]:e.target.value}))} placeholder="Optional explanation" /></Field>
          <div className="application-buttons"><Button disabled={!!busyId} onClick={()=>void review(a,'approve')}>{busyId===a.id?'Processing…':'Approve agency'}</Button><Button variant="danger" disabled={!!busyId} onClick={()=>void review(a,'reject')}>Reject</Button></div>
        </div>}
        {a.review_notes && <p className="review-note">{a.review_notes}</p>}
      </article>)}
    </section>
  </Shell>
}

export function WorkspaceGate() {
  const [loading,setLoading]=useState(true)
  const [email,setEmail]=useState('')
  const [isAdmin,setIsAdmin]=useState(false)
  const [application,setApplication]=useState<Application|null>(null)
  const [agency,setAgency]=useState<AgencyContext|null>(null)
  const [error,setError]=useState('')
  const refresh=useCallback(async()=>{
    if(!supabase)return
    setLoading(true);setError('')
    try{
      const {data:{user},error:userError}=await supabase.auth.getUser()
      if(userError||!user)throw userError||new Error('Please sign in again.')
      setEmail(user.email||'')
      const {data:admin,error:adminError}=await supabase.from('platform_admins').select('is_active').eq('user_id',user.id).maybeSingle()
      if(adminError)throw adminError
      if(admin?.is_active){setIsAdmin(true);setAgency(null);setApplication(null);return}
      setIsAdmin(false)
      const {data:context,error:contextError}=await supabase.rpc('get_my_agency_context')
      if(contextError)throw contextError
      const membership=Array.isArray(context)?context[0] as AgencyContext|undefined:context as AgencyContext|null
      if(membership){setAgency(membership);setApplication(null);return}
      setAgency(null)
      const {data:apps,error:appsError}=await supabase.from('agency_applications').select('*').eq('applicant_user_id',user.id).order('submitted_at',{ascending:false}).limit(1)
      if(appsError)throw appsError
      setApplication((apps?.[0] as Application|undefined)||null)
    }catch(e){setError(e instanceof Error?e.message:'Could not verify your RouteHQ access.')}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{void refresh()},[refresh])
  if(loading)return <div className="auth-loading"><img src={`${import.meta.env.BASE_URL}app-icon.svg`} alt="" /><span>Checking your agency access</span><i /></div>
  if(error)return <Shell><section className="onboarding-card"><h1>We couldn't verify your access</h1><p className="onboarding-error">{error}</p><Button onClick={()=>void refresh()}>Try again</Button></section></Shell>
  if(isAdmin)return <PlatformConsole email={email}/>
  if(agency)return <Shell><section className="onboarding-card"><span className="onboarding-eyebrow">AGENCY WORKSPACE</span><h1>{agency.agency_name}</h1><p className="onboarding-copy">Your agency is approved. We are finishing the secure operational-data connection before enabling live records.</p><div className="platform-stats"><div><strong>{agency.plan_name || agency.plan_code || 'Plan pending'}</strong><span>Plan</span></div><div><strong>{agency.subscription_status || 'Not set'}</strong><span>Subscription</span></div><div><strong>{agency.role_code}</strong><span>Your role</span></div></div><p className="onboarding-copy">This account is not yet connected to the operational modules. Your agency data will remain untouched until that connection is verified.</p><Button variant="secondary" onClick={()=>supabase?.auth.signOut()}>Sign out</Button></section></Shell>
  if(application)return <Shell><ApplicationStatus application={application} onRefresh={()=>void refresh()} onReapply={()=>setApplication(null)}/></Shell>
  return <Shell><AgencyApplication email={email} onSubmitted={()=>void refresh()}/></Shell>
}
