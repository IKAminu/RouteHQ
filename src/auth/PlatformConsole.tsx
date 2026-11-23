import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Activity, AlertTriangle, ArrowUpRight, Building2, CalendarClock, CheckCircle2, Copy, Database, FileText, HardDrive, RefreshCw, ShieldAlert, ShieldCheck, Users, WalletCards, Globe, KeyRound, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Badge, Button, EmptyState, ProgressSteps } from '@/components/ui'
import { AppErrorScreen } from '@/components/AppErrorScreen'

type Application = { id:string; agency_name:string; legal_name:string|null; contact_name:string; email:string; phone:string; requested_plan_code:string; status:string; submitted_at:string; reviewed_at:string|null; review_notes:string|null }
type Agency = { id:string; name:string; slug:string; email:string|null; status:string; created_at:string; approved_at:string|null }
type Subscription = { id:string; agency_id:string; agency_name:string; agency_status:string; plan_code:string|null; plan_name:string|null; status:string; currency_code:string; amount_minor:number|null; billing_interval:string; started_at:string|null; ends_at:string|null; cancel_at_period_end:boolean; created_at:string }
type ActivityItem = { id:string; action:string; entity_type:string|null; created_at:string; actor_email:string|null; details:Record<string,unknown> }
type UserActivity = { users_total:number; users_active:number; memberships_active:number }
type WebsiteConnection = { agency_id:string; agency_name:string; agency_status:string; website_url:string|null; connection_id:string|null; connection_status:string; allowed_origin:string|null; token_last_four:string|null; last_rotated_at:string|null; submission_count:number; last_submission_at:string|null }
type Overview = {
 generated_at:string
 metrics:Record<string,number>
 subscriptions:Subscription[]
 storage:{files:number;bytes:number;bucket_id:string;private:boolean|null}
 database:{bytes:number;pretty:string;version:string}
 operations:{webhook_failures:number;integration_errors:number;pending_applications:number}
 recent_activity:ActivityItem[]
}

const formatBytes=(bytes:number)=>{if(!Number.isFinite(bytes)||bytes<0)return '—';if(bytes===0)return '0 B';const units=['B','KB','MB','GB','TB'];const i=Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),units.length-1);return `${(bytes/1024**i).toFixed(i===0?0:2)} ${units[i]}`}
const formatDate=(value:string|null)=>value?new Date(value).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}):'Not set'
const formatMoney=(minor:number|null,currency:string)=>minor===null?'Not configured':new Intl.NumberFormat('en-NG',{style:'currency',currency:currency||'NGN',maximumFractionDigits:0}).format(minor/100)
const remaining=(end:string|null)=>{if(!end)return 'No end date';const days=Math.ceil((new Date(end).getTime()-Date.now())/86400000);return days<0?`Expired ${Math.abs(days)}d ago`:days===0?'Ends today':`${days} days left`}

function PlatformPager({page,total,onChange}:{page:number;total:number;onChange:(page:number)=>void}){
 const pages=Math.max(1,Math.ceil(total/50))
 if(total<=50)return null
 const start=(page-1)*50+1
 const end=Math.min(page*50,total)
 return <div className="platform-pagination"><span>Showing <strong>{start}–{end}</strong> of <strong>{total.toLocaleString()}</strong></span><div><button type="button" disabled={page<=1} onClick={()=>onChange(page-1)}><ChevronLeft size={14}/> Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={page>=pages} onClick={()=>onChange(page+1)}>Next <ChevronRight size={14}/></button></div></div>
}

function UserActivityGauge({users,activeUsers}:{users:number;activeUsers:number}){
 const percentage=users>0?Math.min(100,Math.round(activeUsers/users*100)):0
 const radius=62
 const circumference=2*Math.PI*radius
 const dash=circumference*percentage/100
 return <div className="platform-user-gauge"><div className="platform-user-gauge-chart"><svg viewBox="0 0 180 180" role="img" aria-label={percentage+'% active account coverage across '+users+' registered users'}><circle cx="90" cy="90" r={radius} fill="none" stroke="#e7edf5" strokeWidth="13"/><circle cx="90" cy="90" r={radius} fill="none" stroke="#4b78dc" strokeWidth="13" strokeLinecap="round" strokeDasharray={dash+' '+(circumference-dash)} transform="rotate(-90 90 90)"/></svg><div><strong>{users.toLocaleString()}</strong><span>Registered users</span></div></div><div className="platform-user-gauge-legend"><span><i/>Active accounts <strong>{activeUsers.toLocaleString()}</strong></span><span><i/>Coverage <strong>{percentage}%</strong></span></div></div>
}

function Metric({label,value,detail,icon:Icon}:{label:string;value:string|number;detail:string;icon:typeof Building2}){return <article className="platform-metric"><div className="platform-metric-top"><span>{label}</span><Icon size={17}/></div><strong>{value}</strong><small>{detail}</small></article>}
function Panel({title,description,action,children}:{title:string;description?:string;action?:ReactNode;children:ReactNode}){return <section className="platform-panel"><header><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</header>{children}</section>}

export function PlatformConsole({email}:{email:string}){
 const [overview,setOverview]=useState<Overview|null>(null)
 const [applications,setApplications]=useState<Application[]>([])
 const [agencies,setAgencies]=useState<Agency[]>([])
 const [websiteConnections,setWebsiteConnections]=useState<WebsiteConnection[]>([])
 const [userActivity,setUserActivity]=useState<UserActivity>({users_total:0,users_active:0,memberships_active:0})
 const [websiteUrls,setWebsiteUrls]=useState<Record<string,string>>({})
 const [websiteOrigins,setWebsiteOrigins]=useState<Record<string,string>>({})
 const [issuedKey,setIssuedKey]=useState<{agencyName:string;apiKey:string;endpoint:string}|null>(null)
 const [tab,setTab]=useState<'overview'|'agencies'|'websites'|'subscriptions'|'health'|'activity'>('overview')
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [busyId,setBusyId]=useState('')
 const [busyAgencyId,setBusyAgencyId]=useState('')
 const [notes,setNotes]=useState<Record<string,string>>({})
 const [search,setSearch]=useState('')
 const [applicationPage,setApplicationPage]=useState(1)
 const [agencyPage,setAgencyPage]=useState(1)
 const [subscriptionPage,setSubscriptionPage]=useState(1)
 const load=useCallback(async()=>{
   if(!supabase)return
   setLoading(true);setError('')
   try{
     const [summary,apps,agencyRows,websiteRows,userRows]=await Promise.all([
       supabase.rpc('get_platform_admin_overview'),
       supabase.from('agency_applications').select('id,agency_name,legal_name,contact_name,email,phone,requested_plan_code,status,submitted_at,reviewed_at,review_notes').order('submitted_at',{ascending:false}),
       supabase.from('agencies').select('id,name,slug,email,status,created_at,approved_at').order('created_at',{ascending:false}),
       supabase.rpc('get_platform_website_connections'),
       supabase.rpc('get_platform_user_activity')
     ])
     if(summary.error)throw summary.error
     if(apps.error)throw apps.error
     if(agencyRows.error)throw agencyRows.error
     if(websiteRows.error)throw websiteRows.error
     if(userRows.error)throw userRows.error
     setOverview(summary.data as Overview)
     setApplications((apps.data||[]) as Application[])
     setAgencies((agencyRows.data||[]) as Agency[])
     setWebsiteConnections((websiteRows.data||[]) as WebsiteConnection[])
     setUserActivity(userRows.data as UserActivity)
   }catch(e){setError(e instanceof Error?e.message:'Could not load platform operations data.')}
   finally{setLoading(false)}
 },[])
 useEffect(()=>{void load()},[load])
 useEffect(()=>{setApplicationPage(1);setAgencyPage(1);setSubscriptionPage(1)},[search])
 const pending=applications.filter(a=>['pending','under_review'].includes(a.status))
 const filteredAgencies=useMemo(()=>agencies.filter(a=>`${a.name} ${a.email||''} ${a.slug} ${a.status}`.toLowerCase().includes(search.toLowerCase())),[agencies,search])
 const filteredSubs=useMemo(()=> (overview?.subscriptions||[]).filter(s=>`${s.agency_name} ${s.plan_name||''} ${s.status}`.toLowerCase().includes(search.toLowerCase())),[overview,search])
 const review=async(app:Application,action:'approve'|'reject')=>{
   if(!supabase)return
   setBusyId(app.id);setError('');setNotice('')
   try{
     const rpc=action==='approve'
       ? await supabase.rpc('approve_agency_application',{_application_id:app.id,_slug:app.agency_name.toLowerCase().normalize('NFKD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)})
       : await supabase.rpc('reject_agency_application',{_application_id:app.id,_review_notes:notes[app.id]||''})
     if(rpc.error)throw rpc.error
     setNotice(action==='approve'?`${app.agency_name} approved.`:`${app.agency_name} application rejected.`)
     await load()
   }catch(e){setError(e instanceof Error?e.message:'Application review failed.')}
   finally{setBusyId('')}
 }
 const changeAgencyStatus=async(agency:Agency)=>{
   if(!supabase)return
   const next=agency.status==='active'?'suspended':'active'
   const verb=next==='suspended'?'suspend':'reactivate'
   if(!window.confirm(`Are you sure you want to ${verb} ${agency.name}? ${next==='suspended'?'Its members will lose workspace access until it is reactivated.':''}`))return
   setBusyAgencyId(agency.id);setError('');setNotice('')
   try{
     const {error}=await supabase.rpc('set_platform_agency_status',{_agency_id:agency.id,_status:next})
     if(error)throw error
     setNotice(`${agency.name} ${next==='suspended'?'suspended':'reactivated'}.`)
     await load()
   }catch(e){setError(e instanceof Error?e.message:'Could not update agency status.')}
   finally{setBusyAgencyId('')}
 }
 const configureWebsite=async(agencyId:string)=>{
   if(!supabase)return
   const websiteUrl=(websiteUrls[agencyId]||websiteConnections.find(x=>x.agency_id===agencyId)?.website_url||'').trim()
   const origin=(websiteOrigins[agencyId]||websiteConnections.find(x=>x.agency_id===agencyId)?.allowed_origin||'').trim()
   setBusyAgencyId(agencyId);setError('');setNotice('');setIssuedKey(null)
   try{
     const {data,error}=await supabase.rpc('platform_configure_website_connection',{_agency_id:agencyId,_website_url:websiteUrl,_allowed_origin:origin})
     if(error)throw error
     const result=data as {agency_name:string;api_key:string;endpoint:string}
     setIssuedKey({agencyName:result.agency_name,apiKey:result.api_key,endpoint:result.endpoint})
     setNotice(`Website intake configured for ${result.agency_name}. Copy the API key now; it will not be shown again.`)
     await load()
   }catch(e){setError(e instanceof Error?e.message:'Could not configure website intake.')}
   finally{setBusyAgencyId('')}
 }
 const disableWebsite=async(agencyId:string)=>{
   if(!supabase)return
   if(!window.confirm('Disable website submissions for this agency? Existing leads will remain unchanged.'))return
   setBusyAgencyId(agencyId);setError('');setNotice('')
   try{const {error}=await supabase.rpc('platform_disable_website_connection',{_agency_id:agencyId});if(error)throw error;setNotice('Website connection disabled.');await load()}
   catch(e){setError(e instanceof Error?e.message:'Could not disable website connection.')}
   finally{setBusyAgencyId('')}
 }
 const metrics=overview?.metrics||{}
 const hasWebsiteConnection=websiteConnections.some(item=>item.connection_status==='active')
 const hasWebsiteSubmission=websiteConnections.some(item=>item.submission_count>0)
 const dbBytes=overview?.database.bytes||0
 const dbLimit=500*1024*1024
 const storageBytes=overview?.storage.bytes||0
 const storageLimit=1024*1024*1024
 const dbPct=Math.min(100,dbBytes/dbLimit*100)
 const storagePct=Math.min(100,storageBytes/storageLimit*100)
 return <div className="platform-console">
  <aside className="platform-sidebar"><div className="platform-brand"><img src={`${import.meta.env.BASE_URL}app-icon.svg`} alt=""/><div><strong>RouteHQ</strong><span>PLATFORM CONTROL CENTRE</span></div></div><div className="platform-sidebar-caption">PLATFORM ADMINISTRATION</div>
  <nav className="platform-nav">{([{id:'overview',label:'Overview',icon:Activity},{id:'agencies',label:'Agencies',icon:Building2},{id:'websites',label:'Website intake',icon:Globe},{id:'subscriptions',label:'Subscriptions',icon:WalletCards},{id:'health',label:'System health',icon:HardDrive},{id:'activity',label:'Audit activity',icon:FileText}] as const).map(({id,label,icon:Icon})=><button key={id} className={tab===id?'active':''} onClick={()=>{setTab(id);setSearch('')}}><Icon size={16}/>{label}{id==='agencies'&&pending.length>0&&<i>{pending.length}</i>}</button>)}</nav></aside>
  <div className="platform-main"><header className="platform-top"><div className="platform-top-label">Platform operations</div><div className="platform-account"><span className="platform-live-dot"/><span>Platform administrator</span><span className="platform-account-email">{email}</span><Button variant="secondary" onClick={()=>void supabase?.auth.signOut()}>Sign out</Button></div></header>
  <main className="platform-content">
   <div className="platform-title-row"><div><span className="platform-eyebrow">WEB4 DIGITAL SYSTEMS / OPERATIONS</span><h1>Platform overview</h1><p>Manage agencies, subscriptions and the infrastructure behind RouteHQ.</p></div><Button variant="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Refresh data</Button></div>
   
   {error&&overview&&<div className="platform-alert platform-alert-error"><AlertTriangle size={17}/><span>{error}</span></div>}
   {notice&&<div className="platform-alert platform-alert-success"><CheckCircle2 size={17}/><span>{notice}</span></div>}
   {loading&&!overview?<div className="platform-loading"><span/><span/><span/><p>Loading platform data…</p></div>:!overview?<AppErrorScreen kind="database" detail={error || "Could not load platform operations data."} onRetry={()=>void load()}/>:<>
   {tab==='overview'&&<>
    <div className="platform-metrics-grid">
     <Metric label="Total agencies" value={metrics.agencies_total||0} detail={`${metrics.agencies_active||0} active · ${metrics.agencies_suspended||0} suspended`} icon={Building2}/>
     <Metric label="Agency applications" value={metrics.applications_pending||0} detail="Awaiting platform review" icon={FileText}/>
     <Metric label="Registered users" value={metrics.users_total||0} detail={`${metrics.memberships_active||0} active memberships`} icon={Users}/>
     <Metric label="Active subscriptions" value={metrics.subscriptions_active||0} detail={`${metrics.subscriptions_pending||0} pending activation`} icon={WalletCards}/>
     <Metric label="Ending in 30 days" value={metrics.subscriptions_ending_30d||0} detail="Renewal / expiry attention" icon={CalendarClock}/>
     <Metric label="Monthly recurring revenue" value={formatMoney(metrics.mrr_minor||0,'NGN')} detail="Based on active monthly records only" icon={ArrowUpRight}/>
    </div>
    <div className="platform-two-col">
     <Panel title="User activity" description="Registered accounts with an active agency membership."><UserActivityGauge users={userActivity.users_total||0} activeUsers={userActivity.users_active||0}/></Panel>
     <Panel title="Agency growth" description="Workspace provisioning and onboarding status."><div className="platform-health-list"><div><span>Active agencies</span><strong>{metrics.agencies_active||0}</strong></div><div><span>Pending applications</span><strong>{metrics.applications_pending||0}</strong></div><div><span>All registered agencies</span><strong>{metrics.agencies_total||0}</strong></div></div></Panel>
    </div>

     <div className="platform-two-col"><Panel title="Applications requiring review" description="New agencies waiting for a decision" action={<button className="platform-text-action" onClick={()=>setTab('agencies')}>View all agencies →</button>}>
      {pending.length===0?<EmptyState title="No pending applications" text="New agency applications will appear here."/>:pending.slice(0,4).map(a=><article className="platform-review-row" key={a.id}><div className="platform-review-info"><strong>{a.agency_name}</strong><span>{a.contact_name} · {a.requested_plan_code.toUpperCase()} · {formatDate(a.submitted_at)}</span></div><Badge>{a.status.replace('_',' ')}</Badge><div className="platform-row-actions"><Button disabled={!!busyId} onClick={()=>void review(a,'approve')}>{busyId===a.id?'Working…':'Approve'}</Button><Button variant="danger" disabled={!!busyId} onClick={()=>void review(a,'reject')}>Reject</Button></div></article>)}</Panel>
     <Panel title="Subscription watchlist" description="Upcoming end dates and subscriptions needing attention" action={<button className="platform-text-action" onClick={()=>setTab('subscriptions')}>View subscriptions →</button>}>
      {(overview.subscriptions||[]).filter(s=>s.status==='active'&&s.ends_at).slice(0,5).map(s=><article className="platform-watch-row" key={s.id}><div><strong>{s.agency_name}</strong><span>{s.plan_name||'Plan not assigned'} · Ends {formatDate(s.ends_at)}</span></div><div><strong>{remaining(s.ends_at)}</strong><small>{s.cancel_at_period_end?'Cancellation scheduled':'Current period'}</small></div></article>)}
      {overview.subscriptions.filter(s=>s.status==='active'&&s.ends_at).length===0&&<EmptyState title="No dated active subscriptions" text="Active subscriptions with a period end date will appear here."/>}
     </Panel>
    </div>
    <Panel title="Platform footprint" description="Current usage measured directly from the RouteHQ database">
     <div className="platform-footprint"><div><Database/><span>Database size</span><strong>{overview.database.pretty}</strong></div><div><HardDrive/><span>Document storage</span><strong>{formatBytes(overview.storage.bytes)}</strong></div><div><FileText/><span>Stored documents</span><strong>{overview.storage.files.toLocaleString()}</strong></div><div><Activity/><span>Project status</span><strong className="platform-good">Operational</strong></div></div>
    </Panel>
   </>}
   {tab==='agencies'&&<><div className="platform-toolbar"><div><h2>Agency management</h2><p>Review applications and inspect registered workspaces.</p></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search agencies…"/></div><Panel title="Applications" description="Approval creates the workspace, owner membership, initial subscription and audit event.">{applications.length===0?<EmptyState title="No applications yet" text="Applications will appear here."/>:applications.slice((applicationPage-1)*50,applicationPage*50).map(a=><article className="platform-application" key={a.id}><div className="platform-application-head"><div><strong>{a.agency_name}</strong><span>{a.contact_name} · {a.email} · {a.phone}</span></div><Badge>{a.status.replace('_',' ')}</Badge></div><div className="platform-application-meta"><span>Requested plan <b>{a.requested_plan_code.toUpperCase()}</b></span><span>Submitted <b>{formatDate(a.submitted_at)}</b></span><span>Reviewed <b>{formatDate(a.reviewed_at)}</b></span></div>{['pending','under_review'].includes(a.status)&&<div className="platform-review-controls"><input value={notes[a.id]||''} onChange={e=>setNotes(v=>({...v,[a.id]:e.target.value}))} placeholder="Review note (optional, used for rejection)"/><Button disabled={!!busyId} onClick={()=>void review(a,'approve')}>Approve agency</Button><Button variant="danger" disabled={!!busyId} onClick={()=>void review(a,'reject')}>Reject</Button></div>}{a.review_notes&&<p className="platform-note">{a.review_notes}</p>}</article>)}<PlatformPager page={applicationPage} total={applications.length} onChange={setApplicationPage}/></Panel><Panel title="Registered agencies" description="All provisioned agency workspaces."><div className="platform-table-wrap"><table><thead><tr><th>Agency</th><th>Status</th><th>Created</th><th>Approved</th><th>Workspace slug</th><th>Access</th></tr></thead><tbody>{filteredAgencies.slice((agencyPage-1)*50,agencyPage*50).map(a=><tr key={a.id}><td><strong>{a.name}</strong><small>{a.email||'No business email'}</small></td><td><Badge>{a.status}</Badge></td><td>{formatDate(a.created_at)}</td><td>{formatDate(a.approved_at)}</td><td>{a.slug}</td><td>{['active','suspended'].includes(a.status)?<Button variant={a.status==='active'?'danger':'secondary'} disabled={!!busyAgencyId} onClick={()=>void changeAgencyStatus(a)}>{busyAgencyId===a.id?'Updating…':a.status==='active'?'Suspend':'Reactivate'}</Button>:'—'}</td></tr>)}</tbody></table></div>{filteredAgencies.length===0&&<EmptyState title="No matching agencies" text="Try another search term."/>}<PlatformPager page={agencyPage} total={filteredAgencies.length} onChange={setAgencyPage}/></Panel></>}
   {tab==='websites'&&<><div className="platform-toolbar"><div><h2>Website connections</h2><p>Connect an agency website so form submissions create leads in its RouteHQ workspace.</p></div><Button variant="secondary" onClick={()=>void load()}><RefreshCw size={14}/> Refresh</Button></div>
    <ProgressSteps className="platform-website-steps" steps={[
      {title:'Connect the agency website',description:'Set its HTTPS URL and exact origin in this screen.',status:hasWebsiteConnection?'complete':'current'},
      {title:'Install the server-side form handler',description:'Add the endpoint and one-time API key to the website backend.',status:hasWebsiteSubmission?'complete':hasWebsiteConnection?'current':'upcoming'},
      {title:'Receive the first submission',description:'A real test submission will appear as a lead in that agency workspace.',status:hasWebsiteSubmission?'complete':'upcoming'}
    ]}/>
    <div className="platform-website-explainer"><div><KeyRound size={18}/><div><strong>How it works</strong><span>Enter the agency website and exact HTTPS origin. RouteHQ issues a one-time API key. The agency developer adds the endpoint and key to the website's server-side form handler. Submissions arrive as leads, with duplicate submissions safely ignored.</span></div></div><div><ShieldCheck size={18}/><div><strong>Keep the key private</strong><span>Never paste the key into public browser JavaScript or a public form. Send it only to the agency's developer or server environment.</span></div></div></div>
    {issuedKey&&<section className="platform-key-reveal"><div><strong>New API key for {issuedKey.agencyName}</strong><span>This is the only time the full key will be displayed. Copy it before leaving this screen.</span></div><code>{issuedKey.apiKey}</code><Button onClick={()=>void navigator.clipboard.writeText(issuedKey.apiKey)}><Copy size={14}/> Copy API key</Button><small>Endpoint: {issuedKey.endpoint}</small></section>}
    <div className="platform-website-list">{websiteConnections.map(connection=><article className="platform-website-card" key={connection.agency_id}><header><div><strong>{connection.agency_name}</strong><span>{connection.website_url||'No website connected'}</span></div><Badge>{connection.connection_status}</Badge></header><div className="platform-website-stats"><div><span>Submissions received</span><strong>{connection.submission_count}</strong></div><div><span>Last submission</span><strong>{connection.last_submission_at?formatDate(connection.last_submission_at):'Never'}</strong></div><div><span>API key ending</span><strong>{connection.token_last_four?'•••• '+connection.token_last_four:'Not issued'}</strong></div></div><div className="platform-website-form"><label>Website URL<input value={websiteUrls[connection.agency_id]??connection.website_url??''} onChange={e=>setWebsiteUrls(v=>({...v,[connection.agency_id]:e.target.value}))} placeholder="https://agency.example"/></label><label>Allowed origin<input value={websiteOrigins[connection.agency_id]??connection.allowed_origin??''} onChange={e=>setWebsiteOrigins(v=>({...v,[connection.agency_id]:e.target.value}))} placeholder="https://agency.example"/></label><div className="platform-row-actions"><Button disabled={!!busyAgencyId||connection.agency_status!=='active'} onClick={()=>void configureWebsite(connection.agency_id)}><KeyRound size={14}/>{busyAgencyId===connection.agency_id?'Saving…':connection.connection_id?'Rotate key / update':'Connect website'}</Button>{connection.connection_id&&connection.connection_status==='active'&&<Button variant="danger" disabled={!!busyAgencyId} onClick={()=>void disableWebsite(connection.agency_id)}>Disable connection</Button>}</div></div></article>)}</div>
    {websiteConnections.length===0&&<EmptyState title="No agencies yet" text="Approve an agency first. Its website connection will appear here."/>}
    <Panel title="Website developer hand-off" description="The connected website posts JSON from its server-side form handler. The API key must never be exposed in client-side JavaScript."><pre className="platform-code-sample">{`POST /functions/v1/website-intake
Headers:
  Content-Type: application/json
  x-routehq-key: rh_live_...

Body:
{
  "submission_id": "website-form-unique-id",
  "payload": {
    "full_name": "Amina Example",
    "email": "amina@example.com",
    "phone": "+234...",
    "interest": "Umrah",
    "message": "Please contact me"
  }
}`}</pre><p className="platform-health-help">Use a unique submission_id for each form submission. The endpoint verifies the API key and allowed website origin, creates a lead, and returns the existing lead for duplicate IDs.</p></Panel>
   </>}
   {tab==='subscriptions'&&<><div className="platform-toolbar"><div><h2>Subscriptions & billing periods</h2><p>Start dates, period end dates, renewal status and recorded plan values.</p></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search agency or plan…"/></div><div className="platform-subscription-summary"><div><span>Active</span><strong>{metrics.subscriptions_active||0}</strong></div><div><span>Pending</span><strong>{metrics.subscriptions_pending||0}</strong></div><div><span>Ending within 30 days</span><strong>{metrics.subscriptions_ending_30d||0}</strong></div><div><span>Monthly recurring revenue</span><strong>{formatMoney(metrics.mrr_minor||0,'NGN')}</strong></div></div><Panel title="All subscription records" description="A pending subscription is not yet a paid or activated subscription."><div className="platform-table-wrap"><table><thead><tr><th>Agency / plan</th><th>Status</th><th>Amount</th><th>Billing</th><th>Started</th><th>Period ends</th><th>Time remaining</th><th>Renewal</th></tr></thead><tbody>{filteredSubs.slice((subscriptionPage-1)*50,subscriptionPage*50).map(s=><tr key={s.id}><td><strong>{s.agency_name}</strong><small>{s.plan_name||s.plan_code||'No plan'}</small></td><td><Badge>{s.status}</Badge></td><td>{formatMoney(s.amount_minor,s.currency_code)}</td><td>{s.billing_interval||'—'}</td><td>{formatDate(s.started_at)}</td><td>{formatDate(s.ends_at)}</td><td>{remaining(s.ends_at)}</td><td>{s.cancel_at_period_end?'Cancels at period end':'Not scheduled'}</td></tr>)}</tbody></table></div>{filteredSubs.length===0&&<EmptyState title="No subscription records" text="Subscription records are created as agencies are approved."/>}<PlatformPager page={subscriptionPage} total={filteredSubs.length} onChange={setSubscriptionPage}/></Panel></>}
   {tab==='health'&&<><div className="platform-health-banner"><CheckCircle2/><div><strong>Database connection healthy</strong><span>Supabase reports the project as active and healthy. Values below are current point-in-time measurements.</span></div></div><div className="platform-two-col"><Panel title="Postgres database" description="Actual database size versus the Free-plan database quota."><div className="platform-usage-head"><strong>{overview.database.pretty}</strong><span>of 500 MB</span></div><div className="platform-progress"><i style={{width:`${dbPct}%`}}/></div><div className="platform-usage-foot"><span>{dbPct.toFixed(1)}% used</span><span>{formatBytes(Math.max(0,dbLimit-dbBytes))} remaining</span></div><p className="platform-health-help">Free-plan projects enter read-only mode when database size exceeds 500 MB. Database size is not the same as provisioned disk usage.</p><a href="https://supabase.com/dashboard/project/viohesitrhrtkulcdnqk/observability/database" target="_blank" rel="noreferrer">Open database reports ↗</a></Panel><Panel title="Private document storage" description="Objects currently stored in the RouteHQ documents bucket."><div className="platform-usage-head"><strong>{formatBytes(storageBytes)}</strong><span>of 1 GB</span></div><div className="platform-progress"><i style={{width:`${storagePct}%`}}/></div><div className="platform-usage-foot"><span>{storagePct.toFixed(1)}% used</span><span>{formatBytes(Math.max(0,storageLimit-storageBytes))} remaining</span></div><p className="platform-health-help">{overview.storage.files.toLocaleString()} files · {overview.storage.private===true?'Bucket is private':'Bucket privacy could not be confirmed'} · 25 MB maximum per file.</p><a href="https://supabase.com/dashboard/project/viohesitrhrtkulcdnqk/storage/buckets" target="_blank" rel="noreferrer">Manage storage buckets ↗</a></Panel><Panel title="Application operations" description="Queue and integration indicators."><div className="platform-health-list"><div><span>Webhook processing failures</span><strong>{overview.operations.webhook_failures}</strong></div><div><span>Integration errors</span><strong>{overview.operations.integration_errors}</strong></div><div><span>Pending applications</span><strong>{overview.operations.pending_applications}</strong></div><div><span>Edge Functions deployed</span><strong>1 active · website-intake</strong></div></div></Panel><Panel title="Security & performance" description="Findings from the latest Supabase advisor scan."><div className="platform-advisor-warning"><ShieldAlert/><div><strong>Leaked-password protection is disabled</strong><span>Enable it in Supabase Authentication settings to block compromised passwords.</span><a href="https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection" target="_blank" rel="noreferrer">Read remediation guide ↗</a></div></div><div className="platform-advisor-neutral"><Activity/><div><strong>Unused-index notices</strong><span>Supabase currently reports unused indexes. With a new project, low query volume makes this expected. Do not remove indexes until usage is established.</span></div></div></Panel></div><div className="platform-two-col"><Panel title="Other plan allowances" description="Free-plan quotas that matter as traffic grows."><div className="platform-health-list"><div><span>Monthly bandwidth allowance</span><strong>10 GB included</strong></div><div><span>Bandwidth consumed</span><strong>Not connected to usage API</strong></div><div><span>Database quota</span><strong>500 MB · live usage above</strong></div><div><span>Storage quota</span><strong>1 GB · live usage above</strong></div><div><span>Maximum document upload</span><strong>25 MB per file</strong></div><div><span>Compute / CPU / RAM</span><strong>Live metrics not connected</strong></div></div><p className="platform-health-help">Bandwidth includes database, Storage and Functions data sent to clients. Supabase currently allocates 5 GB cached and 5 GB uncached on the Free plan.</p></Panel><Panel title="Backups & recovery" description="Recovery readiness is a production requirement, not an optional nice-to-have."><div className="platform-health-list"><div><span>Automated backup plan</span><strong>Not configured / verified</strong></div><div><span>Point-in-time recovery</span><strong>Not available on current Free tier</strong></div><div><span>Restore test</span><strong>Not recorded</strong></div><div><span>Migration history</span><strong>Tracked in Supabase migrations</strong></div></div><p className="platform-health-help">Before onboarding real agencies, upgrade to a plan with managed backups or establish an external backup process, then perform and document a restore test.</p></Panel></div><Panel title="Infrastructure details" description="Project configuration and operational limits."><div className="platform-health-list"><div><span>Supabase project</span><strong>RouteHQ · eu-central-1</strong></div><div><span>Project reference</span><strong>viohesitrhrtkulcdnqk</strong></div><div><span>PostgreSQL version</span><strong>{overview.database.version.match(/PostgreSQL ([^ ]+)/)?.[1]||overview.database.version}</strong></div><div><span>Storage bucket</span><strong>{overview.storage.bucket_id} · private</strong></div><div><span>Last metrics refresh</span><strong>{new Date(overview.generated_at).toLocaleString()}</strong></div><div><span>Management API quota metrics</span><strong>Not connected</strong></div></div><p className="platform-health-help">Database and file totals are queried from Postgres. CPU, RAM, bandwidth, API request quotas, provisioned disk, backup status and billing overages require the Supabase Management API or observability reports. These must be fetched server-side using a scoped token, never exposed in browser code.</p></Panel></>}
   {tab==='activity'&&<Panel title="Platform audit log" description="Administrative actions recorded by the database.">{overview.recent_activity.length===0?<EmptyState title="No audit activity" text="Platform actions will appear here."/>:overview.recent_activity.map(item=><article className="platform-activity-row" key={item.id}><div className="platform-activity-icon"><ShieldCheck size={16}/></div><div><strong>{item.action}</strong><span>{item.actor_email||'System'} · {item.entity_type||'Platform'} · {new Date(item.created_at).toLocaleString()}</span></div></article>)}</Panel>}
   </>}
   <footer className="platform-footer"><span>RouteHQ Platform Operations</span><span>Data refreshed {overview?new Date(overview.generated_at).toLocaleTimeString(): '—'} · Admin access protected by MFA</span></footer>
  </main></div>
 </div>
}
