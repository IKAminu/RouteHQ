import { useCallback, useEffect, useState } from 'react'
import RouteHQSettings, { type Member, type PermissionGroup, type Plan, type Role, type SettingsData, type SettingsActions } from '@/pages/RouteHQSettings'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/theme/ThemeProvider'

type AgencyContext = {
  agency_id: string
  agency_name: string
  membership_id: string
  role_id: string
  role_code: string
  is_owner: boolean
  plan_code: string | null
  plan_name: string | null
  subscription_status: string | null
}

const timezones = [
  'Africa/Lagos', 'Africa/Abidjan', 'Africa/Cairo', 'Africa/Johannesburg',
  'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles',
  'Asia/Dubai', 'Asia/Riyadh', 'Asia/Kolkata', 'Asia/Singapore',
].map((value) => ({ value, label: value.replace(/_/g, ' ') }))
const dateFormats = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD' },
]
const formatDate = (value?: string | null) => value
  ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  : undefined
const messageOf = (error: unknown) => error instanceof Error ? error.message : 'The requested change could not be completed.'

const initialData: SettingsData = {
  loading: true,
  viewer: { isOwner: false, canManageTeam: false, canManageAgency: false, canManageBilling: false },
}

export function SettingsPage() {
  const { preference, setTheme } = useTheme()
  const [data, setData] = useState<SettingsData>(initialData)
  const [loadError, setLoadError] = useState('')

  const refresh = useCallback(async () => {
    if (!supabase) {
      setLoadError('RouteHQ is not connected to its database. Check the application environment settings.')
      setData((current) => ({ ...current, loading: false }))
      return
    }

    setLoadError('')
    setData((current) => ({ ...current, loading: true }))
    try {
      const [{ data: authResult, error: authError }, { data: contextResult, error: contextError }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.rpc('get_my_agency_context'),
      ])
      if (authError) throw authError
      if (contextError) throw contextError
      const user = authResult.user
      if (!user) throw new Error('Your session has expired. Sign in again.')
      const context = (Array.isArray(contextResult) ? contextResult[0] : contextResult) as AgencyContext | null
      if (!context?.agency_id) throw new Error('This account is not connected to an active RouteHQ agency.')

      const [
        agencyResult, membersResult, rolesResult, permissionsResult,
        plansResult, subscriptionResult, invitationsResult, currentOverridesResult,
      ] = await Promise.all([
        supabase.from('agencies')
          .select('id,name,legal_name,registration_number,email,phone,website_url,country_code,timezone,currency_code')
          .eq('id', context.agency_id).single(),
        supabase.from('agency_memberships')
          .select('id,user_id,role_id,status,is_owner,joined_at,created_at')
          .eq('agency_id', context.agency_id).order('created_at', { ascending: true }),
        supabase.from('roles')
          .select('id,agency_id,code,name,description,is_system,is_owner_role')
          .or(`agency_id.is.null,agency_id.eq.${context.agency_id}`)
          .order('name'),
        supabase.from('permissions').select('code,module,action,description').order('module').order('action'),
        supabase.from('plans').select('id,code,name,description,max_additional_members,features')
          .eq('is_active', true).order('created_at'),
        supabase.from('subscriptions')
          .select('status,billing_interval,current_period_start,current_period_end,plan_id')
          .eq('agency_id', context.agency_id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('agency_invitations')
          .select('id,invited_email,role_id,status,created_at,expires_at')
          .eq('agency_id', context.agency_id).order('created_at', { ascending: false }),
        supabase.from('member_permissions')
          .select('permission_code,is_allowed')
          .eq('membership_id', context.membership_id),
      ])
      for (const result of [agencyResult, membersResult, rolesResult, permissionsResult, plansResult, subscriptionResult, invitationsResult, currentOverridesResult]) {
        if (result.error) throw result.error
      }

      const agency = agencyResult.data
      if (!agency) throw new Error('Agency details could not be found for this workspace.')
      const memberships = membersResult.data ?? []
      const roleRows = rolesResult.data ?? []
      const permissionRows = permissionsResult.data ?? []
      const planRows = plansResult.data ?? []
      const invitations = invitationsResult.data ?? []
      const currentRoleId = memberships.find((member) => member.id === context.membership_id)?.role_id ?? context.role_id
      const roleIds = [...new Set([...roleRows.map((r) => r.id), ...memberships.map((m) => m.role_id)])]
      const rolePermissionsResult = roleIds.length
        ? await supabase.from('role_permissions').select('role_id,permission_code').in('role_id', roleIds)
        : { data: [], error: null }
      if (rolePermissionsResult.error) throw rolePermissionsResult.error
      const rolePermissions = rolePermissionsResult.data ?? []
      const overrides = currentOverridesResult.data ?? []
      const hasPermission = (code: string) => {
        if (context.is_owner) return true
        const override = overrides.find((item) => item.permission_code === code)
        if (override) return override.is_allowed
        return rolePermissions.some((item) => item.role_id === currentRoleId && item.permission_code === code)
      }

      const metadata = user.user_metadata ?? {}
      const savedPreferences = metadata.routehq_preferences ?? {}
      const currentPreference = ['light', 'dark', 'system'].includes(savedPreferences.theme)
        ? savedPreferences.theme as 'light' | 'dark' | 'system'
        : preference
      if (currentPreference !== preference) setTheme(currentPreference)

      const plans: Plan[] = planRows.map((plan) => ({
        id: plan.code === 'basic' ? 'basic' : plan.code === 'growth' ? 'growth' : 'pro',
        name: plan.name,
        price: 'Contact RouteHQ',
        seatLimit: plan.max_additional_members,
        features: [
          `${plan.max_additional_members} additional team seats`,
          ...(plan.features?.website_integration ? ['Website integration'] : []),
          ...(plan.features?.automation ? ['Advanced automation'] : []),
          ...(plan.features?.custom_permissions ? ['Custom permissions'] : []),
        ],
      }))
      const subscription = subscriptionResult.data
      const activePlan = planRows.find((plan) => plan.id === subscription?.plan_id)
        ?? planRows.find((plan) => plan.code === context.plan_code)
      const activePlanCode = activePlan?.code === 'growth' ? 'growth' : activePlan?.code === 'pro' ? 'pro' : 'basic'
      const activePlanLimit = activePlan?.max_additional_members ?? 0

      const roles: Role[] = roleRows.map((role) => ({
        id: role.id,
        label: role.name,
        description: role.description ?? '',
        permissions: rolePermissions.filter((item) => item.role_id === role.id).map((item) => item.permission_code),
        editable: false,
      }))
      const groupsMap = permissionRows.reduce<Record<string, PermissionGroup['items']>>((groups, item) => {
        const label = item.module.replaceAll('_', ' ')
        groups[label] = [...(groups[label] ?? []), {
          id: item.code,
          label: item.description,
          description: `${item.module.replaceAll('_', ' ')} · ${item.action.replaceAll('_', ' ')}`,
        }]
        return groups
      }, {})
      const groups: PermissionGroup[] = Object.entries(groupsMap).map(([label, items]) => ({ label, items }))

      const teamMembers: Member[] = memberships.map((member) => ({
        id: member.id,
        name: member.user_id === user.id
          ? String(metadata.full_name || metadata.name || user.email || 'You')
          : 'Team member',
        email: member.user_id === user.id ? user.email ?? '' : '',
        role: member.role_id,
        status: member.status === 'active' ? 'active' : member.status === 'invited' ? 'pending' : 'expired',
        date: formatDate(member.joined_at ?? member.created_at) ?? '—',
        isOwner: member.is_owner,
      }))
      for (const invitation of invitations) {
        const status = invitation.status === 'pending' && new Date(invitation.expires_at).getTime() > Date.now()
          ? 'pending'
          : 'expired'
        teamMembers.push({
          id: invitation.id,
          name: invitation.invited_email,
          email: invitation.invited_email,
          role: invitation.role_id,
          status,
          date: formatDate(invitation.created_at) ?? '—',
        })
      }
      const seatsUsed = memberships.filter((member) => !member.is_owner && ['active', 'invited'].includes(member.status)).length
        + invitations.filter((invite) => invite.status === 'pending' && new Date(invite.expires_at).getTime() > Date.now()).length

      let twoFactorEnabled: boolean | undefined
      try {
        const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors()
        if (factorError) throw factorError
        twoFactorEnabled = factors.totp.some((factor) => factor.status === 'verified')
      } catch {
        twoFactorEnabled = undefined
      }

      setData({
        loading: false,
        viewer: {
          isOwner: context.is_owner,
          canManageTeam: hasPermission('team.invite') || hasPermission('team.manage_permissions'),
          canManageAgency: hasPermission('agency_settings.manage'),
          canManageBilling: hasPermission('billing.manage'),
        },
        profile: {
          name: String(metadata.full_name || metadata.name || ''),
          email: user.email ?? '',
          emailVerified: Boolean(user.email_confirmed_at),
          phone: String(metadata.phone ?? ''),
          jobTitle: String(metadata.job_title ?? ''),
          bio: String(metadata.bio ?? ''),
          avatarUrl: undefined,
        },
        preferences: {
          theme: currentPreference,
          timezone: String(savedPreferences.timezone || agency.timezone || 'Africa/Lagos'),
          dateFormat: String(savedPreferences.dateFormat || 'DD/MM/YYYY'),
          language: String(savedPreferences.language || 'en'),
        },
        timezones,
        dateFormats,
        languages: [{ value: 'en', label: 'English' }],
        security: { twoFactorEnabled },
        agency: {
          name: agency.name,
          email: agency.email ?? '',
          phone: agency.phone ?? '',
          address: '',
          country: agency.country_code ?? 'NG',
          state: '',
          website: agency.website_url ?? '',
          description: agency.legal_name ?? '',
          registration: agency.registration_number ?? undefined,
          logoUrl: undefined,
        },
        team: {
          members: teamMembers,
          roles,
          groups,
          seatsUsed,
          seatLimit: activePlanLimit,
        },
        billing: {
          plan: activePlanCode,
          status: subscription?.status ?? context.subscription_status ?? 'unknown',
          period: subscription?.billing_interval === 'year' ? 'Annual billing' : 'Monthly billing',
          startedAt: formatDate(subscription?.current_period_start),
          renewsAt: formatDate(subscription?.current_period_end),
          plans,
          invoices: undefined,
          paymentMethod: undefined,
        },
        unsupported: ['sessions', 'invoices'],
      })
    } catch (error) {
      setLoadError(messageOf(error))
      setData((current) => ({ ...current, loading: false }))
    }
  }, [preference, setTheme])

  useEffect(() => { void refresh() }, [refresh])

  const actions: Partial<SettingsActions> = {
    saveProfile: async (profile) => {
      if (!supabase) return { error: 'Database connection unavailable.' }
      const { error } = await supabase.auth.updateUser({
        data: {
          full_name: profile.name.trim(),
          phone: profile.phone.trim(),
          job_title: profile.jobTitle.trim(),
          bio: profile.bio.trim(),
        },
      })
      if (error) return { error: error.message }
      await refresh()
    },
    savePreferences: async (preferences) => {
      if (!supabase) return { error: 'Database connection unavailable.' }
      const { error } = await supabase.auth.updateUser({
        data: { routehq_preferences: preferences },
      })
      if (error) return { error: error.message }
      setTheme(preferences.theme)
      await refresh()
    },
    changePassword: async () => {
      if (!supabase) return { error: 'Database connection unavailable.' }
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError) return { error: userError.message }
      if (!user?.email) return { error: 'No sign-in email is available for this account.' }
      const { error } = await supabase.auth.resetPasswordForEmail(user.email)
      return error ? { error: error.message } : undefined
    },
    signOut: async () => {
      if (!supabase) return { error: 'Database connection unavailable.' }
      const { error } = await supabase.auth.signOut()
      if (error) return { error: error.message }
      window.location.reload()
    },
    saveAgency: async (agency) => {
      if (!supabase) return { error: 'Database connection unavailable.' }
      const { data: contextData, error: contextError } = await supabase.rpc('get_my_agency_context')
      if (contextError) return { error: contextError.message }
      const current = (Array.isArray(contextData) ? contextData[0] : contextData) as AgencyContext | null
      if (!current?.agency_id) return { error: 'Agency workspace not found.' }
      const { error } = await supabase.from('agencies').update({
        name: agency.name.trim(),
        email: agency.email.trim() || null,
        phone: agency.phone.trim() || null,
        legal_name: agency.description.trim() || null,
        website_url: agency.website.trim() || null,
        country_code: agency.country.trim().toUpperCase().slice(0, 2) || 'NG',
        updated_at: new Date().toISOString(),
      }).eq('id', current.agency_id)
      if (error) return { error: error.message }
      await refresh()
    },
    deleteAgency: async () => {
      if (!supabase) return { error: 'Database connection unavailable.' }
      const { error } = await supabase.rpc('request_agency_deletion', { _reason: 'Requested by the agency owner from RouteHQ settings.' })
      if (error) return { error: error.message }
      await refresh()
    },
  }

  if (loadError && !data.profile) {
    return <div className="mx-auto max-w-3xl px-6 py-12"><div className="rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-700 dark:text-red-300" role="alert"><strong className="block">Settings could not be loaded</strong><p className="mt-2">{loadError}</p><button className="mt-4 rounded-lg bg-neutral-900 px-3 py-2 text-white dark:bg-white dark:text-neutral-900" onClick={() => void refresh()}>Try again</button></div></div>
  }

  const params = new URLSearchParams(window.location.search)
  const requestedTab = params.get('tab')
  const requestedSection = params.get('section')
  const initialTab = requestedTab === 'agency' || requestedTab === 'team' || requestedTab === 'integrations'
    ? requestedTab
    : 'personal'
  return <RouteHQSettings data={data} actions={actions} initialTab={initialTab} initialSection={requestedSection || undefined} />
}
