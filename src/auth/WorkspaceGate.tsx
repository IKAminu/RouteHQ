import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { Button, Field, Input, Select } from '@/components/ui'
import { PlatformConsole } from '@/auth/PlatformConsole'\nimport { AppStoreProvider } from '@/hooks/useAppStore'\nimport { RouterProvider } from 'react-router'\nimport { router } from '@/app/routes'

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
  plan_name: string | null
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

function ApplicationStatus({ application, onRefresh, onReapply, onSignOut }: { application: Application; onRefresh: () => void; onReapply: () => void; onSignOut: () => void }) {
  return <section className="onboarding-card onboarding-status-card">
    <div className="onboarding-status-topline"><span className="onboarding-eyebrow">APPLICATION STATUS</span><Button variant="secondary" onClick={onSignOut}>Sign out <span aria-hidden="true">↗</span></Button></div>
    <h1>{application.agency_name}</h1>
    <div className={`application-status status-${application.status}`}>{application.status.replace('_',' ')}</div>
    <p className="onboarding-copy">Your application was submitted on {new Date(application.submitted_at).toLocaleDateString()}. We will activate your agency workspace after review.</p>
    {application.review_notes && <div className="review-note"><strong>Review note</strong><p>{application.review_notes}</p></div>}
    <div className="application-buttons"><Button variant="secondary" onClick={onRefresh}>Refresh status</Button>{application.status==='rejected' && <Button onClick={onReapply}>Submit a new application</Button>}</div>
  </section>
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
  if(agency)return <AppStoreProvider><RouterProvider router={router}/></AppStoreProvider>
  if(application)return <Shell><ApplicationStatus application={application} onRefresh={()=>void refresh()} onReapply={()=>setApplication(null)} onSignOut={()=>void supabase?.auth.signOut()}/></Shell>
  return <Shell><AgencyApplication email={email} onSubmitted={()=>void refresh()}/></Shell>
}
