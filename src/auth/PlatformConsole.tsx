import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Building2, CalendarClock, CheckCircle2, Clock3, Database, FileText, HardDrive, RefreshCw, ShieldAlert, ShieldCheck, Users, WalletCards, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Badge, Button, EmptyState } from '@/components/ui'

type Application = { id:string; agency_name:string; legal_name:string|null; contact_name:string; email:string; phone:string; requested_plan_code:string; status:string; submitted_at:string; reviewed_at:string|null; review_notes:string|null }
type Agency = { id:string; name:string; slug:string; email:string|null; status:string; created_at:string; approved_at:string|null }
type Subscription = { id:string; agency_id:string; agency_name:string; agency_status:string; plan_code:string|null; plan_name:string|null; status:string; currency_code:string; amount_minor:number|null; billing_interval:string; started_at:string|null; ends_at:string|null; cancel_at_period_end:boolean; created_at:string }
type ActivityItem = { id:string; action:string; entity_type:string|null; created_at:string; actor_email:string|null; details:Record<string,unknown> }
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
const tone=(status:string)=>['active','approved','completed'].includes(status)?'success':['pending','under_review','trialing'].includes(status)?'warning':['suspended','rejected','past_due','canceled','cancelled','expired'].includes(status)?'danger':'neutral'

function Metric({label,value,detail,icon:Icon}:{label:string;value:string|number;detail:string;icon:typeof Building2}){return <article className="platform-metric"><div className="platform-metric-top"><span>{label}</span><Icon size={17}/></div><strong>{value}</strong><small>{detail}</small></article>}
function Panel({title,description,action,children}:{title:string;description?:string;action?:React.ReactNode;children:React.ReactNode}){return <section className="platform-panel"><header><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{action}</header>{children}</section>}

export function PlatformConsole({email}:{email:string}){
 const [overview,setOverview]=useState<Overview|null>(null)
 const [applications,setApplications]=useState<Application[]>([])
 const [agencies,setAgencies]=useState<Agency[]>([])
 const [tab,setTab]=useState<'overview'|'agencies'|'subscriptions'|'health'|'activity'>('overview')
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [busyId,setBusyId]=useState('')
 const [busyAgencyId,setBusyAgencyId]=useState('')
 const [notes,setNotes]=useState<Record<string,string>>({})
 const [search,setSearch]=useState('')
 const load=useCallback(async()=>{
   if(!supabase)return
   setLoading(true);setError('')
   try{
     const [summary,apps,agencyRows]=await Promise.all([
       supabase.rpc('get_platform_admin_overview'),
       supabase.from('agency_applications').select('id,agency_name,legal_name,contact_name,email,phone,requested_plan_code,status,submitted_at,reviewed_at,review_notes').order('submitted_at',{ascending:false}),
       supabase.from('agencies').select('id,name,slug,email,status,created_at,approved_at').order('created_at',{ascending:false})
     ])
     if(summary.error)throw summary.error
     if(apps.error)throw apps.error
     if(agencyRows.error)throw agencyRows.error
     setOverview(summary.data as Overview)
     setApplications((apps.data||[]) as Application[])
     setAgencies((agencyRows.data||[]) as Agency[])
   }catch(e){setError(e instanceof Error?e.message:'Could not load platform operations data.')}
   finally{setLoading(false)}
 },[])
 useEffect(()=>{void load()},[load])
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
 const metrics=overview?.metrics||{}
 const dbBytes=overview?.database.bytes||0
 const dbLimit=500*1024*1024
 const storageBytes=overview?.storage.bytes||0
 const storageLimit=1024*1024*1024
 const dbPct=Math.min(100,dbBytes/dbLimit*100)
 const storagePct=Math.min(100,storageBytes/storageLimit*100)
 return <div className="platform-console">
  <header className="platform-top"><div className="platform-brand"><img src={`${import.meta.env.BASE_URL}app-icon.svg`} alt=""/><div><strong>RouteHQ</strong><span>PLATFORM CONTROL CENTRE</span></div></div><div className="platform-account"><span className="platform-live-dot"/><span>Platform administrator</span><span className="platform-account-email">{email}</span><Button variant="secondary" onClick={()=>void supabase?.auth.signOut()}>Sign out</Button></div></header>
  <main className="platform-content">
   <div className="platform-title-row"><div><span className="platform-eyebrow">WEB4 DIGITAL SYSTEMS / OPERATIONS</span><h1>Platform overview</h1><p>Manage agencies, subscriptions and the infrastructure behind RouteHQ.</p></div><Button variant="secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={15}/> Refresh data</Button></div>
   <nav className="platform-tabs">{([{id:'overview',label:'Overview',icon:Activity},{id:'agencies',label:'Agencies',icon:Building2},{id:'subscriptions',label:'Subscriptions',icon:WalletCards},{id:'health',label:'System health',icon:HardDrive},{id:'activity',label:'Audit activity',icon:FileText}] as const).map(({id,label,icon:Icon})=><button key={id} className={tab===id?'active':''} onClick={()=>{setTab(id);setSearch('')}}><Icon size={16}/>{label}{id==='agencies'&&pending.length>0&&<i>{pending.length}</i>}</button>)}</nav>
   {error&&<div className="platform-alert platform-alert-error"><AlertTriangle size={17}/><span>{error}</span></div>}
   {notice&&<div className="platform-alert platform-alert-success"><CheckCircle2 size={17}/><span>{notice}</span></div>}
   {loading&&!overview?<div className="platform-loading"><span/><span/><span/><p>Loading platform data…</p></div>:!overview?<EmptyState title="Platform data unavailable" text="Refresh the dashboard. If the problem continues, inspect the Supabase project and admin permissions."/>:<>
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
     <Panel title="Applications requiring review" description="New agencies waiting for a decision" action={<button className="platform-text-action" onClick={()=>setTab('agencies')}>View all agencies →</button>}>
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
   {tab==='agencies'&&<><div className="platform-toolbar"><div><h2>Agency management</h2><p>Review applications and inspect registered workspaces.</p></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search agencies…"/></div><Panel title="Applications" description="Approval creates the workspace, owner membership, initial subscription and audit event.">{applications.length===0?<EmptyState title="No applications yet" text="Applications will appear here."/>:applications.map(a=><article className="platform-application" key={a.id}><div className="platform-application-head"><div><strong>{a.agency_name}</strong><span>{a.contact_name} · {a.email} · {a.phone}</span></div><Badge>{a.status.replace('_',' ')}</Badge></div><div className="platform-application-meta"><span>Requested plan <b>{a.requested_plan_code.toUpperCase()}</b></span><span>Submitted <b>{formatDate(a.submitted_at)}</b></span><span>Reviewed <b>{formatDate(a.reviewed_at)}</b></span></div>{['pending','under_review'].includes(a.status)&&<div className="platform-review-controls"><input value={notes[a.id]||''} onChange={e=>setNotes(v=>({...v,[a.id]:e.target.value}))} placeholder="Review note (optional, used for rejection)"/><Button disabled={!!busyId} onClick={()=>void review(a,'approve')}>Approve agency</Button><Button variant="danger" disabled={!!busyId} onClick={()=>void review(a,'reject')}>Reject</Button></div>}{a.review_notes&&<p className="platform-note">{a.review_notes}</p>}</article>)}</Panel><Panel title="Registered agencies" description="All provisioned agency workspaces."><div className="platform-table-wrap"><table><thead><tr><th>Agency</th><th>Status</th><th>Created</th><th>Approved</th><th>Workspace slug</th><th>Access</th></tr></thead><tbody>{filteredAgencies.map(a=><tr key={a.id}><td><strong>{a.name}</strong><small>{a.email||'No business email'}</small></td><td><Badge>{a.status}</Badge></td><td>{formatDate(a.created_at)}</td><td>{formatDate(a.approved_at)}</td><td>{a.slug}</td><td>{['active','suspended'].includes(a.status)?<Button variant={a.status==='active'?'danger':'secondary'} disabled={!!busyAgencyId} onClick={()=>void changeAgencyStatus(a)}>{busyAgencyId===a.id?'Updating…':a.status==='active'?'Suspend':'Reactivate'}</Button>:'—'}</td></tr>)}</tbody></table></div>{filteredAgencies.length===0&&<EmptyState title="No matching agencies" text="Try another search term."/>}</Panel></>}
   {tab==='subscriptions'&&<><div className="platform-toolbar"><div><h2>Subscriptions & billing periods</h2><p>Start dates, period end dates, renewal status and recorded plan values.</p></div><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search agency or plan…"/></div><div className="platform-subscription-summary"><div><span>Active</span><strong>{metrics.subscriptions_active||0}</strong></div><div><span>Pending</span><strong>{metrics.subscriptions_pending||0}</strong></div><div><span>Ending within 30 days</span><strong>{metrics.subscriptions_ending_30d||0}</strong></div><div><span>Monthly recurring revenue</span><strong>{formatMoney(metrics.mrr_minor||0,'NGN')}</strong></div></div><Panel title="All subscription records" description="A pending subscription is not yet a paid or activated subscription."><div className="platform-table-wrap"><table><thead><tr><th>Agency / plan</th><th>Status</th><th>Amount</th><th>Billing</th><th>Started</th><th>Period ends</th><th>Time remaining</th><th>Renewal</th></tr></thead><tbody>{filteredSubs.map(s=><tr key={s.id}><td><strong>{s.agency_name}</strong><small>{s.plan_name||s.plan_code||'No plan'}</small></td><td><Badge>{s.status}</Badge></td><td>{formatMoney(s.amount_minor,s.currency_code)}</td><td>{s.billing_interval||'—'}</td><td>{formatDate(s.started_at)}</td><td>{formatDate(s.ends_at)}</td><td>{remaining(s.ends_at)}</td><td>{s.cancel_at_period_end?'Cancels at period end':'Not scheduled'}</td></tr>)}</tbody></table></div>{filteredSubs.length===0&&<EmptyState title="No subscription records" text="Subscription records are created as agencies are approved."/>}</Panel></>}
   {tab==='health'&&<><div className="platform-health-banner"><CheckCircle2/><div><strong>Database connection healthy</strong><span>Supabase reports the project as active and healthy. Values below are current point-in-time measurements.</span></div></div><div className="platform-two-col"><Panel title="Postgres database" description="Actual database size versus the Free-plan database quota."><div className="platform-usage-head"><strong>{overview.database.pretty}</strong><span>of 500 MB</span></div><div className="platform-progress"><i style={{width:`${dbPct}%`}}/></div><div className="platform-usage-foot"><span>{dbPct.toFixed(1)}% used</span><span>{formatBytes(Math.max(0,dbLimit-dbBytes))} remaining</span></div><p className="platform-health-help">Free-plan projects enter read-only mode when database size exceeds 500 MB. Database size is not the same as provisioned disk usage.</p><a href="https://supabase.com/dashboard/project/viohesitrhrtkulcdnqk/observability/database" target="_blank" rel="noreferrer">Open database reports ↗</a></Panel><Panel title="Private document storage" description="Objects currently stored in the RouteHQ documents bucket."><div className="platform-usage-head"><strong>{formatBytes(storageBytes)}</strong><span>of 1 GB</span></div><div className="platform-progress"><i style={{width:`${storagePct}%`}}/></div><div className="platform-usage-foot"><span>{storagePct.toFixed(1)}% used</span><span>{formatBytes(Math.max(0,storageLimit-storageBytes))} remaining</span></div><p className="platform-health-help">{overview.storage.files.toLocaleString()} files · {overview.storage.private===true?'Bucket is private':'Bucket privacy could not be confirmed'} · 25 MB maximum per file.</p><a href="https://supabase.com/dashboard/project/viohesitrhrtkulcdnqk/storage/buckets" target="_blank" rel="noreferrer">Manage storage buckets ↗</a></Panel><Panel title="Application operations" description="Queue and integration indicators."><div className="platform-health-list"><div><span>Webhook processing failures</span><strong>{overview.operations.webhook_failures}</strong></div><div><span>Integration errors</span><strong>{overview.operations.integration_errors}</strong></div><div><span>Pending applications</span><strong>{overview.operations.pending_applications}</strong></div><div><span>Edge Functions deployed</span><strong>0</strong></div></div></Panel><Panel title="Security & performance" description="Findings from the latest Supabase advisor scan."><div className="platform-advisor-warning"><ShieldAlert/><div><strong>Leaked-password protection is disabled</strong><span>Enable it in Supabase Authentication settings to block compromised passwords.</span><a href="https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection" target="_blank" rel="noreferrer">Read remediation guide ↗</a></div></div><div className="platform-advisor-neutral"><Activity/><div><strong>Unused-index notices</strong><span>Supabase currently reports unused indexes. With a new project, low query volume makes this expected. Do not remove indexes until usage is established.</span></div></div></Panel></div><Panel title="Infrastructure details" description="Project configuration and operational limits."><div className="platform-health-list"><div><span>Supabase project</span><strong>RouteHQ · eu-central-1</strong></div><div><span>Project reference</span><strong>viohesitrhrtkulcdnqk</strong></div><div><span>PostgreSQL version</span><strong>{overview.database.version.split(' ')[0]}</strong></div><div><span>Storage bucket</span><strong>{overview.storage.bucket_id} · private</strong></div><div><span>Last metrics refresh</span><strong>{new Date(overview.generated_at).toLocaleString()}</strong></div><div><span>Management API quota metrics</span><strong>Not connected</strong></div></div><p className="platform-health-help">Database and file totals are queried from Postgres. CPU, RAM, bandwidth, API request quotas, provisioned disk, backup status and billing overages require the Supabase Management API or observability reports. These must be fetched server-side using a scoped token, never exposed in browser code.</p></Panel></>}
   {tab==='activity'&&<Panel title="Platform audit log" description="Administrative actions recorded by the database.">{overview.recent_activity.length===0?<EmptyState title="No audit activity" text="Platform actions will appear here."/>:overview.recent_activity.map(item=><article className="platform-activity-row" key={item.id}><div className="platform-activity-icon"><ShieldCheck size={16}/></div><div><strong>{item.action}</strong><span>{item.actor_email||'System'} · {item.entity_type||'Platform'} · {new Date(item.created_at).toLocaleString()}</span></div></article>)}</Panel>}
   </>}
   <footer className="platform-footer"><span>RouteHQ Platform Operations</span><span>Data refreshed {overview?new Date(overview.generated_at).toLocaleTimeString(): '—'} · Admin access protected by MFA</span></footer>
  </main>
 </div>
}
