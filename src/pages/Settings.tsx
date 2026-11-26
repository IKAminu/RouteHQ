import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight, Building2, Check, ChevronRight, Globe2, LoaderCircle, Mail,
  Moon, Save, Shield, Sun, Users, UserRound, CreditCard, Link2, AlertCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/theme/ThemeProvider'
import { Badge, Button, Input } from '@/components/ui'

type Section = 'personal' | 'agency' | 'team'
type AgencyRecord = {
  id: string
  name: string
  legal_name: string | null
  registration_number: string | null
  email: string | null
  phone: string | null
  website_url: string | null
  country_code: string
  timezone: string
  currency_code: string
}
type Member = {
  id: string
  user_id: string
  role_id: string
  status: string
  is_owner: boolean
  joined_at: string | null
  roles?: { name?: string; code?: string } | null
}
type Plan = {
  id: string
  code: string
  name: string
  description: string | null
  max_additional_members: number
  features: Record<string, boolean>
}
type Permission = { code: string; module: string; action: string; description: string }

const agencySections = [
  { id: 'details', label: 'Agency profile', icon: Building2 },
  { id: 'website', label: 'Custom website', icon: Globe2 },
  { id: 'subscription', label: 'Plan & subscription', icon: CreditCard },
  { id: 'appearance', label: 'Appearance', icon: Sun },
  { id: 'danger', label: 'Workspace removal', icon: AlertCircle },
] as const

const teamSections = [
  { id: 'members', label: 'Team members', icon: Users },
  { id: 'permissions', label: 'Permissions', icon: Shield },
] as const

function SettingsNotice({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'success' | 'error' }) {
  return <div className={`rh-settings-notice is-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>
}

function SettingsField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return <div className="rh-settings-field"><div className="rh-settings-field-copy"><label>{label}</label>{hint && <p>{hint}</p>}</div><div className="rh-settings-field-control">{children}</div></div>
}

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const [section, setSection] = useState<Section>('personal')
  const [agencySection, setAgencySection] = useState<(typeof agencySections)[number]['id']>('details')
  const [teamSection, setTeamSection] = useState<(typeof teamSections)[number]['id']>('members')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [userId, setUserId] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [profileName, setProfileName] = useState('')
  const [profilePhone, setProfilePhone] = useState('')
  const [agency, setAgency] = useState<AgencyRecord | null>(null)
  const [agencyDraft, setAgencyDraft] = useState<AgencyRecord | null>(null)
  const [context, setContext] = useState<{ membership_id: string; is_owner: boolean; role_code: string; plan_code: string; plan_name: string; subscription_status: string; max_additional_members: number } | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [rolePermissions, setRolePermissions] = useState<Array<{ role_id: string; permission_code: string }>>([])
  const [memberOverrides, setMemberOverrides] = useState<Array<{ membership_id: string; permission_code: string; is_allowed: boolean }>>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscription, setSubscription] = useState<{ status: string; billing_interval: string; current_period_end: string | null } | null>(null)
  const [deletionReason, setDeletionReason] = useState('')
  const [deletionBusy, setDeletionBusy] = useState(false)
  const [deletionStatus, setDeletionStatus] = useState<{ status: string; reason: string; requested_at: string } | null>(null)

  const canManageAgency = Boolean(context?.is_owner || context?.role_code === 'administrator')
  const canManageTeam = Boolean(context?.is_owner || ['administrator', 'manager'].includes(context?.role_code || ''))
  const activeMembers = members.filter((member) => member.status === 'active' && !member.is_owner)
  const pendingInvitations = members.filter((member) => member.status === 'invited' && !member.is_owner)
  const usedSeats = activeMembers.length + pendingInvitations.length
  const seatLimit = context?.max_additional_members ?? 0
  const currentPlan = plans.find((plan) => plan.code === context?.plan_code)

  const loadSettings = async () => {
    if (!supabase) { setError('The database connection is not configured.'); setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const [{ data: authData, error: authError }, { data: rawContext, error: contextError }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.rpc('get_my_agency_context'),
      ])
      if (authError) throw authError
      if (contextError) throw contextError
      const user = authData.user
      if (!user) throw new Error('Your session has expired. Sign in again to manage settings.')
      const current = Array.isArray(rawContext) ? rawContext[0] : rawContext
      if (!current?.agency_id) throw new Error('This account is not linked to an active agency workspace.')
      setUserId(user.id)
      setUserEmail(user.email || '')
      setProfileName(String(user.user_metadata?.full_name || user.user_metadata?.name || ''))
      setProfilePhone(String(user.user_metadata?.phone || ''))
      setContext(current)
      const [agencyResult, membersResult, permissionsResult, overridesResult, plansResult, subscriptionResult, deletionResult] = await Promise.all([
        supabase.from('agencies').select('id,name,legal_name,registration_number,email,phone,website_url,country_code,timezone,currency_code').eq('id', current.agency_id).single(),
        supabase.from('agency_memberships').select('id,user_id,role_id,status,is_owner,joined_at,roles(name,code)').eq('agency_id', current.agency_id).order('created_at', { ascending: true }),
        supabase.from('permissions').select('code,module,action,description').order('module').order('action'),
        supabase.from('member_permissions').select('membership_id,permission_code,is_allowed').in('membership_id', (await supabase.from('agency_memberships').select('id').eq('agency_id', current.agency_id)).data?.map((item) => item.id) || []),
        supabase.from('plans').select('id,code,name,description,max_additional_members,features').eq('is_active', true).order('created_at'),
        supabase.from('subscriptions').select('status,billing_interval,current_period_end').eq('agency_id', current.agency_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('agency_deletion_requests').select('status,reason,requested_at').eq('agency_id', current.agency_id).order('requested_at', { ascending: false }).limit(1).maybeSingle(),
      ])
      if (agencyResult.error) throw agencyResult.error
      if (membersResult.error) throw membersResult.error
      setAgency(agencyResult.data as AgencyRecord)
      setAgencyDraft(agencyResult.data as AgencyRecord)
      const loadedMembers = (membersResult.data || []) as unknown as Member[]
      setMembers(loadedMembers)
      setSelectedMemberId((currentId) => currentId && loadedMembers.some((member) => member.id === currentId) ? currentId : loadedMembers.find((member) => !member.is_owner && member.status === 'active')?.id || '')
      setPermissions((permissionsResult.data || []) as Permission[])
      setMemberOverrides((overridesResult.data || []) as typeof memberOverrides)
      const roleIds = [...new Set(loadedMembers.map((member) => member.role_id))]
      if (roleIds.length) {
        const { data: rolePermissionData, error: rolePermissionError } = await supabase.from('role_permissions').select('role_id,permission_code').in('role_id', roleIds)
        if (rolePermissionError) throw rolePermissionError
        setRolePermissions((rolePermissionData || []) as typeof rolePermissions)
      } else setRolePermissions([])
      setPlans((plansResult.data || []) as Plan[])
      setSubscription(subscriptionResult.data)
      setDeletionStatus(deletionResult.data as typeof deletionStatus)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Settings could not be loaded.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void loadSettings() }, [])

  const saveProfile = async () => {
    if (!supabase) return
    setSaving(true); setError(''); setNotice('')
    try {
      const { error: updateError } = await supabase.auth.updateUser({ data: { full_name: profileName.trim(), phone: profilePhone.trim() } })
      if (updateError) throw updateError
      setNotice('Your personal profile has been saved.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Your profile could not be saved.') }
    finally { setSaving(false) }
  }

  const saveAgency = async () => {
    if (!supabase || !agencyDraft || !agency) return
    setSaving(true); setError(''); setNotice('')
    try {
      const { data, error: updateError } = await supabase.from('agencies')
        .update({
          name: agencyDraft.name.trim(),
          legal_name: agencyDraft.legal_name?.trim() || null,
          registration_number: agencyDraft.registration_number?.trim() || null,
          email: agencyDraft.email?.trim() || null,
          phone: agencyDraft.phone?.trim() || null,
          website_url: agencyDraft.website_url?.trim() || null,
          country_code: agencyDraft.country_code,
          timezone: agencyDraft.timezone,
          currency_code: agencyDraft.currency_code,
          updated_at: new Date().toISOString(),
        }).eq('id', agency.id)
        .select('id,name,legal_name,registration_number,email,phone,website_url,country_code,timezone,currency_code').single()
      if (updateError) throw updateError
      setAgency(data as AgencyRecord); setAgencyDraft(data as AgencyRecord)
      setNotice('Agency settings have been saved.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Agency settings could not be saved.') }
    finally { setSaving(false) }
  }

  const setMemberPermission = async (memberId: string, permissionCode: string, allowed: boolean) => {
    if (!supabase) return
    setError(''); setNotice('')
    const existing = memberOverrides.find((item) => item.membership_id === memberId && item.permission_code === permissionCode)
    try {
      if (existing) {
        const { error: updateError } = await supabase.from('member_permissions').update({ is_allowed: allowed, updated_by: userId, updated_at: new Date().toISOString() }).eq('membership_id', memberId).eq('permission_code', permissionCode)
        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase.from('member_permissions').insert({ membership_id: memberId, permission_code: permissionCode, is_allowed: allowed, updated_by: userId })
        if (insertError) throw insertError
      }
      setMemberOverrides((items) => existing
        ? items.map((item) => item.membership_id === memberId && item.permission_code === permissionCode ? { ...item, is_allowed: allowed } : item)
        : [...items, { membership_id: memberId, permission_code: permissionCode, is_allowed: allowed }])
      setNotice('Permission updated.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Permission could not be updated.') }
  }

  const submitDeletion = async () => {
    if (!supabase || !context?.is_owner) return
    setDeletionBusy(true); setError(''); setNotice('')
    try {
      const { error: rpcError } = await supabase.rpc('request_agency_deletion', { _reason: deletionReason.trim() })
      if (rpcError) throw rpcError
      setDeletionReason('')
      setNotice('Your workspace deletion request has been submitted for review.')
      await loadSettings()
    } catch (err) { setError(err instanceof Error ? err.message : 'The deletion request could not be submitted.') }
    finally { setDeletionBusy(false) }
  }

  const navItems = section === 'agency' ? agencySections : section === 'team' ? teamSections : []
  const activeSubsection = section === 'agency' ? agencySection : teamSection
  const permissionGroups = useMemo(() => permissions.reduce<Record<string, Permission[]>>((groups, item) => {
    groups[item.module] = [...(groups[item.module] || []), item]
    return groups
  }, {}), [permissions])
  const selectedMember = members.find((member) => member.id === selectedMemberId && !member.is_owner && member.status === 'active') || null

  const renderPersonal = () => <div className="rh-settings-content">
    <div className="rh-settings-heading"><div><h2>Personal profile</h2><p>Manage the details attached to your RouteHQ login.</p></div><Button onClick={() => void saveProfile()} disabled={saving}><Save size={15}/>{saving ? 'Saving…' : 'Save changes'}</Button></div>
    <div className="rh-settings-card">
      <div className="rh-settings-card-intro"><div><h3>Profile information</h3><p>Update your name and contact details. Your login email is managed by your sign-in method.</p></div></div>
      <SettingsField label="Full name" hint="The name shown to your agency team."><Input value={profileName} onChange={(event) => setProfileName(event.target.value)} placeholder="Your full name" /></SettingsField>
      <SettingsField label="Email address" hint="Used to sign in to RouteHQ."><Input value={userEmail} disabled /></SettingsField>
      <SettingsField label="Phone number"><Input value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} placeholder="+234…" /></SettingsField>
      <div className="rh-settings-footer"><span>Changes apply to your personal account only.</span><Button onClick={() => void saveProfile()} disabled={saving}><Save size={15}/>{saving ? 'Saving…' : 'Save profile'}</Button></div>
    </div>
    <div className="rh-settings-card">
      <div className="rh-settings-card-intro"><div><h3>Appearance</h3><p>Choose the theme used on this device.</p></div></div>
      <div className="rh-theme-choices">
        <button type="button" className={theme === 'light' ? 'is-selected' : ''} onClick={() => setTheme('light')}><span className="rh-theme-preview light"><Sun size={20}/></span><span><strong>Light mode</strong><small>Bright, clean surfaces</small></span>{theme === 'light' && <Check size={17}/>}</button>
        <button type="button" className={theme === 'dark' ? 'is-selected' : ''} onClick={() => setTheme('dark')}><span className="rh-theme-preview dark"><Moon size={20}/></span><span><strong>Night mode</strong><small>Graphite surfaces and restrained accents</small></span>{theme === 'dark' && <Check size={17}/>}</button>
      </div>
    </div>
  </div>

  const renderAgency = () => {
    if (agencySection === 'details' || agencySection === 'website') return <div className="rh-settings-content">
      <div className="rh-settings-heading"><div><h2>{agencySection === 'website' ? 'Custom website' : 'Agency profile'}</h2><p>{agencySection === 'website' ? 'Manage the website connected to your RouteHQ workspace.' : 'The identity and contact details used across your agency workspace.'}</p></div><Button onClick={() => void saveAgency()} disabled={saving || !canManageAgency}><Save size={15}/>{saving ? 'Saving…' : 'Save changes'}</Button></div>
      <div className="rh-settings-card">
        <div className="rh-settings-card-intro"><div><h3>{agencySection === 'website' ? 'Website details' : 'Business information'}</h3><p>{agencySection === 'website' ? 'Add your agency website address. Website lead capture requires a separate secure connection.' : 'Keep your agency information accurate for documents and account administration.'}</p></div></div>
        {agencySection === 'details' ? <>
          <SettingsField label="Agency name"><Input value={agencyDraft?.name || ''} onChange={(event) => setAgencyDraft((current) => current ? { ...current, name: event.target.value } : current)} disabled={!canManageAgency} /></SettingsField>
          <SettingsField label="Registered business name"><Input value={agencyDraft?.legal_name || ''} onChange={(event) => setAgencyDraft((current) => current ? { ...current, legal_name: event.target.value } : current)} disabled={!canManageAgency} placeholder="Optional" /></SettingsField>
          <SettingsField label="Registration number"><Input value={agencyDraft?.registration_number || ''} onChange={(event) => setAgencyDraft((current) => current ? { ...current, registration_number: event.target.value } : current)} disabled={!canManageAgency} placeholder="Optional" /></SettingsField>
          <SettingsField label="Business email"><Input type="email" value={agencyDraft?.email || ''} onChange={(event) => setAgencyDraft((current) => current ? { ...current, email: event.target.value } : current)} disabled={!canManageAgency} /></SettingsField>
          <SettingsField label="Business phone"><Input value={agencyDraft?.phone || ''} onChange={(event) => setAgencyDraft((current) => current ? { ...current, phone: event.target.value } : current)} disabled={!canManageAgency} /></SettingsField>
          <SettingsField label="Default currency"><Input value={agencyDraft?.currency_code || 'NGN'} onChange={(event) => setAgencyDraft((current) => current ? { ...current, currency_code: event.target.value.toUpperCase() } : current)} disabled={!canManageAgency} /></SettingsField>
          <SettingsField label="Time zone"><Input value={agencyDraft?.timezone || 'Africa/Lagos'} onChange={(event) => setAgencyDraft((current) => current ? { ...current, timezone: event.target.value } : current)} disabled={!canManageAgency} /></SettingsField>
        </> : <>
          <SettingsField label="Website URL" hint="Use the full HTTPS address of your agency website."><Input type="url" value={agencyDraft?.website_url || ''} onChange={(event) => setAgencyDraft((current) => current ? { ...current, website_url: event.target.value } : current)} disabled={!canManageAgency} placeholder="https://www.youragency.com" /></SettingsField>
          <div className="rh-website-status"><div className="rh-settings-icon"><Link2 size={18}/></div><div><strong>Website lead capture</strong><p>Connect your website to send enquiries directly into RouteHQ Leads. The secure connection and API key are configured separately by RouteHQ.</p></div><Badge>Not connected</Badge></div>
          <SettingsNotice>Saving your website address does not automatically connect lead capture. The connection must be configured and verified separately.</SettingsNotice>
        </>}
        {!canManageAgency && <SettingsNotice>You can view these details, but your current role does not have permission to edit agency settings.</SettingsNotice>}
        <div className="rh-settings-footer"><span>Changes are saved to this agency workspace.</span><Button onClick={() => void saveAgency()} disabled={saving || !canManageAgency}><Save size={15}/>{saving ? 'Saving…' : 'Save changes'}</Button></div>
      </div>
    </div>

    if (agencySection === 'subscription') return <div className="rh-settings-content">
      <div className="rh-settings-heading"><div><h2>Plan & subscription</h2><p>Review your current RouteHQ plan and the features available to your agency.</p></div></div>
      <div className="rh-current-plan"><div><span className="rh-eyebrow">CURRENT PLAN</span><h3>{context?.plan_name || currentPlan?.name || 'Plan unavailable'}</h3><p>{currentPlan?.description || 'Your current agency subscription.'}</p></div><Badge>{subscription?.status || context?.subscription_status || 'Unknown status'}</Badge></div>
      <div className="rh-plan-usage"><div><span>Team seats</span><strong>{usedSeats} / {seatLimit} additional members</strong></div><div className="rh-seat-track"><span style={{ width: `${seatLimit ? Math.min(100, usedSeats / seatLimit * 100) : 0}%` }}/></div><small>The agency owner is not counted as an additional seat.</small></div>
      <div className="rh-plan-grid">{plans.map((plan) => <article className={plan.code === context?.plan_code ? 'is-current' : ''} key={plan.id}><div className="rh-plan-card-top"><h3>{plan.name}</h3>{plan.code === context?.plan_code && <Badge>Current plan</Badge>}</div><p>{plan.description}</p><ul><li>{plan.max_additional_members} additional team seats</li><li>{plan.features?.website_integration ? 'Custom website integration' : 'No website integration'}</li><li>{plan.features?.automation ? 'Advanced automation' : 'Standard workflows'}</li><li>{plan.features?.custom_permissions ? 'Custom team permissions' : 'Standard access only'}</li></ul>{plan.code !== context?.plan_code && <Button variant="secondary" disabled><ArrowUpRight size={15}/>Upgrade options coming soon</Button>}</article>)}</div>
      <SettingsNotice>Plan changes are not processed in this app yet. Self-service checkout and subscription billing need to be connected before an upgrade can take effect. Your current plan and seat limit above are read from the live subscription records.</SettingsNotice>
    </div>

    if (agencySection === 'appearance') return <div className="rh-settings-content"><div className="rh-settings-heading"><div><h2>Appearance</h2><p>Set the display theme for this device.</p></div></div><div className="rh-settings-card"><div className="rh-theme-choices"><button type="button" className={theme === 'light' ? 'is-selected' : ''} onClick={() => setTheme('light')}><span className="rh-theme-preview light"><Sun size={20}/></span><span><strong>Light mode</strong><small>Bright, clean surfaces</small></span>{theme === 'light' && <Check size={17}/>}</button><button type="button" className={theme === 'dark' ? 'is-selected' : ''} onClick={() => setTheme('dark')}><span className="rh-theme-preview dark"><Moon size={20}/></span><span><strong>Night mode</strong><small>Graphite surfaces and restrained accents</small></span>{theme === 'dark' && <Check size={17}/>}</button></div></div></div>

    return <div className="rh-settings-content"><div className="rh-settings-heading"><div><h2>Workspace removal</h2><p>Request permanent removal of this agency workspace.</p></div></div><div className="rh-settings-card rh-settings-danger"><h3>Request workspace deletion</h3><p>Deletion is not immediate. RouteHQ reviews the request before a platform administrator can remove the workspace. Your data remains available while the request is reviewed.</p>{deletionStatus && <div className="rh-deletion-status"><strong>Latest request</strong><Badge>{deletionStatus.status}</Badge><small>Submitted {new Date(deletionStatus.requested_at).toLocaleString()}</small><p>{deletionStatus.reason}</p></div>}{context?.is_owner ? <><SettingsField label="Reason for deletion" hint="Optional. This helps us understand the request."><textarea value={deletionReason} onChange={(event) => setDeletionReason(event.target.value)} rows={3} maxLength={2000} placeholder="Tell us why you are requesting deletion."/></SettingsField><div className="rh-settings-footer"><span>Only the agency owner can submit this request.</span><Button variant="danger" disabled={deletionBusy || Boolean(deletionStatus && ['pending','approved','processing'].includes(deletionStatus.status))} onClick={() => void submitDeletion()}>{deletionBusy ? 'Submitting…' : 'Submit deletion request'}</Button></div></> : <SettingsNotice>Only the agency owner can request workspace deletion.</SettingsNotice>}</div></div>
  }

  const renderTeam = () => <div className="rh-settings-content">
    <div className="rh-settings-heading"><div><h2>{teamSection === 'members' ? 'Team members' : 'Permissions'}</h2><p>{teamSection === 'members' ? 'See who has access to this agency workspace.' : 'Manage additional permissions for active team members.'}</p></div>{teamSection === 'members' && <Button disabled title="Team invitations will be enabled with the invitation delivery workflow."><Mail size={15}/>Invite member</Button>}</div>
    {teamSection === 'members' ? <div className="rh-settings-card">
      <div className="rh-team-summary"><div><strong>{members.filter((member) => member.status === 'active').length} active members</strong><span>{usedSeats} of {seatLimit} additional seats used</span></div><Badge>{context?.plan_name || 'Current plan'}</Badge></div>
      <div className="rh-team-table-wrap"><table className="rh-team-table"><thead><tr><th>Member</th><th>Role</th><th>Status</th><th>Joined</th><th/></tr></thead><tbody>{members.map((member) => <tr key={member.id}><td><div className="rh-member-cell"><span className="rh-member-avatar">{member.is_owner ? <UserRound size={17}/> : <Users size={17}/>}</span><span><strong>{member.is_owner ? 'Agency owner' : member.user_id === userId ? userEmail : `Team member · ${member.user_id.slice(0, 8)}`}</strong><small>{member.user_id === userId ? 'You' : member.user_id}</small></span></div></td><td>{member.roles?.name || 'Assigned role'}</td><td><Badge>{member.status}</Badge></td><td>{member.joined_at ? new Date(member.joined_at).toLocaleDateString() : '—'}</td><td>{member.is_owner ? <span className="rh-muted">Owner</span> : <button className="rh-text-action" onClick={() => setTeamSection('permissions')} disabled={!canManageTeam}>Manage access <ChevronRight size={14}/></button>}</td></tr>)}</tbody></table></div>
      <SettingsNotice>Invitations, resend, and member removal require the secure invitation and membership-management workflow. Those actions are not enabled yet, so no member can be added or removed from this screen today.</SettingsNotice>
    </div> : <div className="rh-settings-card">
      {!canManageTeam && <SettingsNotice>Your role does not have permission to manage team permissions.</SettingsNotice>}
      {activeMembers.length === 0 ? <p className="rh-empty">There are no additional active team members yet.</p> : <div className="rh-permission-editor"><div className="rh-permission-member-select"><label htmlFor="rh-permission-member">Team member</label><select id="rh-permission-member" value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.target.value)}>{activeMembers.map((member) => <option key={member.id} value={member.id}>{(member.roles?.name || 'Team member') + ' · ' + member.user_id.slice(0, 8)}</option>)}</select></div>{selectedMember && Object.entries(permissionGroups).map(([group, items]) => <div className="rh-permission-group" key={group}><h3>{group.replaceAll('_', ' ')}</h3>{items.map((permission) => { const override = memberOverrides.find((item) => item.membership_id === selectedMember.id && item.permission_code === permission.code); const inherited = rolePermissions.some((item) => item.role_id === selectedMember.role_id && item.permission_code === permission.code); const checked = override?.is_allowed ?? inherited; return <label className="rh-permission-row" key={permission.code}><span><strong>{permission.action.replaceAll('_', ' ')}</strong><small>{permission.description}</small></span><input type="checkbox" checked={checked} disabled={!canManageTeam} onChange={(event) => void setMemberPermission(selectedMember.id, permission.code, event.target.checked)}/></label> })}</div>)}</div>}
    </div>}
  </div>

  return <div className="page rh-settings-page">
    <div className="rh-settings-page-header"><div><span className="rh-eyebrow">WORKSPACE CONFIGURATION</span><h1>Settings</h1><p>Manage your profile, agency workspace and team access.</p></div></div>
    <div className="rh-settings-switch" role="tablist" aria-label="Settings category">
      <button role="tab" aria-selected={section === 'personal'} className={section === 'personal' ? 'is-active' : ''} onClick={() => setSection('personal')}><UserRound size={16}/>Personal profile</button>
      <button role="tab" aria-selected={section === 'agency'} className={section === 'agency' ? 'is-active' : ''} onClick={() => setSection('agency')}><Building2 size={16}/>Agency</button>
      <button role="tab" aria-selected={section === 'team'} className={section === 'team' ? 'is-active' : ''} onClick={() => setSection('team')}><Users size={16}/>Team</button>
    </div>
    {error && <SettingsNotice tone="error">{error}</SettingsNotice>}
    {notice && <SettingsNotice tone="success">{notice}</SettingsNotice>}
    {loading ? <div className="rh-settings-loading"><LoaderCircle size={19}/>Loading your settings…</div> : <div className="rh-settings-layout">
      {section !== 'personal' && <nav className="rh-settings-nav" aria-label={section === 'agency' ? 'Agency settings' : 'Team settings'}>{navItems.map((item) => { const Icon = item.icon; const active = activeSubsection === item.id; return <button key={item.id} className={active ? 'is-active' : ''} onClick={() => section === 'agency' ? setAgencySection(item.id as typeof agencySection) : setTeamSection(item.id as typeof teamSection)}><Icon size={16}/><span>{item.label}</span><ChevronRight size={14}/></button> })}</nav>}
      {section === 'personal' ? renderPersonal() : section === 'agency' ? renderAgency() : renderTeam()}
    </div>}
  </div>
}
