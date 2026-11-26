import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { waitForMinimumLoadingTime } from '@/lib/loading'
import { dynaura } from 'dynaura'

export type AppMode = 'demo' | 'live'
type AuthStep = 'login' | 'mfa' | 'enroll' | 'forgot' | 'recover'

type AuthVisualVariant = 'dashboard' | 'motion' | 'quote'

const authRedirectUrl = () => new URLSearchParams(window.location.search).has('invite')
  ? window.location.href
  : authRedirectUrl()

function AuthVisual({ variant }: { variant: AuthVisualVariant }) {
  return <aside className={"auth-visual auth-visual-" + variant} aria-label="RouteHQ product introduction">
    {variant === 'dashboard' && <div className="auth-dashboard-preview" aria-hidden="true">
            <div className="auth-preview-window">
        <div className="auth-preview-window-top"><span>Overview</span><span>Last 30 days&nbsp;⌄</span></div>
        <div className="auth-preview-metrics">
          <div><small>Active enquiries</small><strong>128</strong><em>↑ 12.8%</em></div>
          <div><small>Confirmed bookings</small><strong>64</strong><em>↑ 8.4%</em></div>
          <div><small>Upcoming departures</small><strong>18</strong><em>Next 30 days</em></div>
        </div>
        <div className="auth-preview-lower">
          <div className="auth-preview-chart">
            <div><strong>Booking activity</strong><small>Enquiries converted over time</small></div>
            <div className="auth-preview-bars"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
            <div className="auth-preview-axis"><span>01 Nov</span><span>08 Nov</span><span>15 Nov</span><span>20 Nov</span></div>
          </div>
          <div className="auth-preview-activity"><strong>Recent activity</strong><div><i></i><span><b>New enquiry received</b><small>Umrah · 4 travellers</small></span></div><div><i></i><span><b>Booking confirmed</b><small>December departure</small></span></div><div><i></i><span><b>Payment recorded</b><small>Customer account</small></span></div></div>
        </div>
      </div>
    </div>}

    {variant === 'motion' && <div className="auth-motion-stage">
      <video
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
        poster="https://images.pexels.com/videos/5649209/free-video-5649209.jpg?auto=compress&cs=tinysrgb&w=1600"
      >
        <source src="https://videos.pexels.com/video-files/5649209/5649209-hd_1920_1080_25fps.mp4" type="video/mp4" />
      </video>
      <div className="auth-motion-shade"></div>
          </div>}

    {variant === 'quote' && <div className="auth-quote-stage">
      <div className="auth-quote-mark" aria-hidden="true">“</div>
      <blockquote>Great journeys are built on details handled well.</blockquote>
      <div className="auth-quote-rule" aria-hidden="true"></div>
      <p>THE ROUTEHQ PRINCIPLE</p>
    </div>}

  </aside>
}

function VerificationCodeInput({ value, onChange, description, hasError = false, autoFocus = false }: { value: string; onChange: (value: string) => void; description: string; hasError?: boolean; autoFocus?: boolean }) {
  return <div className={`auth-pin-input ${hasError ? 'has-error' : ''}`}>
    <label className="auth-pin-label" htmlFor="auth-verification-code">Secure code</label>
    <div className="auth-pin-group">
      <input
        id="auth-verification-code"
        className="auth-pin-native-input"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        required
        autoFocus={autoFocus}
        aria-label="Six-digit authenticator code"
        aria-invalid={hasError}
        aria-describedby="auth-code-help"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\\D/g, '').slice(0, 6))}
      />
      {Array.from({ length: 6 }, (_, index) => <span key={index} className={`auth-pin-slot ${index === 3 ? 'auth-pin-slot-break' : ''} ${value[index] ? 'is-filled' : ''}`}>
        {value[index] ?? <i />}
      </span>)}
    </div>
    <p id="auth-code-help" className="auth-pin-description">{description}</p>
  </div>
}

function AuthScreen({ onAuthenticated, recoveryMode, onPasswordRecovered, initialSession }: { onAuthenticated: (session: Session) => void; recoveryMode: boolean; onPasswordRecovered: () => void; initialSession?: Session | null }) {
  const [step, setStep] = useState<AuthStep>(recoveryMode ? 'recover' : 'login')
  const [visualVariant] = useState<AuthVisualVariant>(() => {
    const variants: AuthVisualVariant[] = ['dashboard', 'motion', 'quote']
    return variants[Math.floor(Math.random() * variants.length)]
  })
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [info, setInfo] = useState('')
  const [code, setCode] = useState('')
  const [factorId, setFactorId] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [setupSecret, setSetupSecret] = useState('')
  const [showSetupSecret, setShowSetupSecret] = useState(false)
  const [secretCopied, setSecretCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const verifyFormRef = useRef<HTMLFormElement>(null)
  const verifyInFlight = useRef(false)
  const secondFactorStarted = useRef(false)

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('invite')
    if (!token || !supabase) return
    let active = true
    void (async () => {
      try {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
        const tokenHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
        const { data, error } = await supabase.rpc('preview_agency_invitation', { _token_hash: tokenHash })
        if (error) throw error
        if (!active) return
        setEmail(String(data.invited_email ?? ''))
        setInfo(`You've been invited to join ${data.agency_name} as ${data.role_name}. Sign in or create an account using the invited email address.`)
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'This invitation link could not be verified.')
      }
    })()
    return () => { active = false }
  }, [])

  const beginSecondFactor = async () => {
    const { data: factors, error: factorsError } = await supabase!.auth.mfa.listFactors()
    if (factorsError) throw factorsError

    const verifiedFactor = factors.totp.find((factor) => factor.status === 'verified')
    if (verifiedFactor) {
      const { data: challenge, error: challengeError } = await supabase!.auth.mfa.challenge({ factorId: verifiedFactor.id })
      if (challengeError) throw challengeError
      setFactorId(verifiedFactor.id)
      setChallengeId(challenge.id)
      setStep('mfa')
      return
    }

    const unverifiedFactors = factors.totp.filter((factor) => factor.status !== 'verified')
    for (const factor of unverifiedFactors) {
      const { error: removeError } = await supabase!.auth.mfa.unenroll({ factorId: factor.id })
      if (removeError) throw new Error(`An unfinished authenticator setup could not be reset: ${removeError.message}. Please contact the app administrator.`)
    }

    const { data: enrollment, error: enrollmentError } = await supabase!.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'RouteHQ Authenticator',
      issuer: 'RouteHQ',
    })
    if (enrollmentError) throw enrollmentError
    setFactorId(enrollment.id)
    setQrCode(enrollment.totp.qr_code)
    setSetupSecret(enrollment.totp.secret)
    setShowSetupSecret(false)
    setSecretCopied(false)
    setStep('enroll')
  }

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      const normalizedEmail = email.trim().toLowerCase()
      const { data, error: loginError } = await supabase!.auth.signInWithPassword({ email: normalizedEmail, password })
      if (loginError) {
        if (loginError.code === 'invalid_credentials' || loginError.message.toLowerCase().includes('invalid login credentials')) {
          throw new Error('Email or password is incorrect. Use “Forgot password?” to securely set a new password for this account.')
        }
        throw loginError
      }
      if (!data.session) throw new Error('Sign-in did not return a valid session.')
      secondFactorStarted.current = true
      await beginSecondFactor()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setInfo('')
    setBusy(true)
    try {
      const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString()
      const { error: oauthError } = await supabase!.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, queryParams: { access_type: 'offline', prompt: 'select_account' } },
      })
      if (oauthError) throw oauthError
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in could not be started.')
      setBusy(false)
    }
  }

  const handleSendPasswordReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      const normalizedEmail = email.trim().toLowerCase()
      if (!normalizedEmail) throw new Error('Enter the email address for your RouteHQ account.')
      const { error: resetError } = await supabase!.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).toString(),
      })
      if (resetError) throw resetError
      setInfo('If an account exists for that address, Supabase has sent a password-reset link. Check your inbox and spam folder.')
      setStep('login')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request a password reset. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handlePasswordRecovery = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setInfo('')
    if (newPassword.length < 12) {
      setError('Use a password with at least 12 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('The two passwords do not match.')
      return
    }
    setBusy(true)
    try {
      const { error: updateError } = await supabase!.auth.updateUser({ password: newPassword })
      if (updateError) throw updateError
      const { error: signOutError } = await supabase!.auth.signOut()
      if (signOutError) throw signOutError
      setPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setStep('login')
      setInfo('Your password has been changed. Sign in with your new password, then complete two-step verification.')
      onPasswordRecovered()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your password. Request a new reset link and try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setInfo('')
    setBusy(true)
    try {
      const normalizedEmail = email.trim().toLowerCase()
      const { data, error: signupError } = await supabase!.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: { full_name: fullName.trim() }, emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).toString() },
      })
      if (signupError) throw signupError
      if (data.session) {
        setInfo('Your account has been created. Secure it with an authenticator to continue.')
        await beginSecondFactor()
      } else {
        setInfo(new URLSearchParams(window.location.search).has('invite') ? 'Account created. Confirm your email, then sign in with the invited address to accept the invitation.' : 'Account created. Check your email to confirm your address, then sign in to submit your agency application.')
        setAuthMode('login')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (verifyInFlight.current) return
    verifyInFlight.current = true
    setError('')
    setBusy(true)
    try {
      let activeChallengeId = challengeId
      if (!activeChallengeId) {
        const { data, error: challengeError } = await supabase!.auth.mfa.challenge({ factorId })
        if (challengeError) throw challengeError
        activeChallengeId = data.id
      }
      const { error: verifyError } = await supabase!.auth.mfa.verify({
        factorId,
        challengeId: activeChallengeId,
        code: code.replace(/\s/g, ''),
      })
      if (verifyError) throw verifyError
      const { data, error: sessionError } = await supabase!.auth.getSession()
      if (sessionError) throw sessionError
      if (!data.session) throw new Error('Your session could not be confirmed. Please sign in again.')
      dynaura.success({ title: 'Verification complete', description: 'Your RouteHQ session is secured.' })
      onAuthenticated(data.session)
    } catch (err) {
      setCode('')
      setError(err instanceof Error ? err.message : 'The verification code was not accepted.')
    } finally {
      verifyInFlight.current = false
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!initialSession || step !== 'login' || secondFactorStarted.current) return
    secondFactorStarted.current = true
    setBusy(true)
    beginSecondFactor().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Could not start two-step verification.')
      secondFactorStarted.current = false
    }).finally(() => setBusy(false))
  }, [initialSession, step])

  useEffect(() => {
    if ((step === 'mfa' || step === 'enroll') && code.length === 6 && !busy && !error && !verifyInFlight.current) {
      verifyFormRef.current?.requestSubmit()
    }
  }, [code, step, busy, error])

  const handleBackToLogin = async () => {
    if (factorId && step === 'enroll') {
      const { error: removeError } = await supabase!.auth.mfa.unenroll({ factorId })
      if (removeError) {
        setError(`Could not cancel authenticator setup: ${removeError.message}`)
        return
      }
    }
    await supabase!.auth.signOut()
    secondFactorStarted.current = false
    setStep('login')
    setPassword('')
    setCode('')
    setFactorId('')
    setChallengeId('')
    setQrCode('')
    setSetupSecret('')
    setShowSetupSecret(false)
    setSecretCopied(false)
    setError('')
  }

  return <div className="auth-screen">
    <div className="auth-layout">
    <section className="auth-panel">
      <img src={`${import.meta.env.BASE_URL}brand/routehq-logo.svg`} alt="RouteHQ" className="auth-logo" />

      {step === 'login' && <>
        <div className="auth-form-heading">
          <h1>{authMode === 'signup' ? 'Create account' : 'Login'}</h1>
          <div className="auth-mode-switch" role="group" aria-label="Choose login or sign up">
            <button type="button" className={authMode === 'login' ? 'active' : ''} aria-pressed={authMode === 'login'} onClick={() => { setAuthMode('login'); setError(''); setInfo('') }}>Login</button>
            <button type="button" className={authMode === 'signup' ? 'active' : ''} aria-pressed={authMode === 'signup'} onClick={() => { setAuthMode('signup'); setError(''); setInfo('') }}>Sign up</button>
          </div>
        </div>
        <form className="auth-form" onSubmit={authMode === 'signup' ? handleSignup : handleLogin}>
          {authMode === 'signup' && <label className="field-group">Full name<input className="field" autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>}
          <label className="field-group">Email<input className="field" type="email" autoComplete="username" placeholder="you@example.com" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="field-group">Password
            <span className="auth-password-wrap">
              <input className="field" type={showPassword ? 'text' : 'password'} autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} placeholder="Enter password" minLength={authMode === 'signup' ? 12 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} />
              <button className="auth-password-toggle" type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </span>
          </label>
          {authMode === 'login' && <div className="auth-forgot-row"><button type="button" onClick={() => { setStep('forgot'); setError(''); setInfo('') }}>Forgot password?</button></div>}
          {authMode === 'signup' && <p className="auth-help">Use at least 12 characters. Email confirmation may be required.</p>}
          {info && <p className="auth-info" role="status">{info}</p>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="button button-primary auth-submit" disabled={busy}>{busy ? (authMode === 'signup' ? 'Creating account…' : 'Signing in…') : (authMode === 'signup' ? 'Create account' : 'Login')}</button>
          <div className="auth-divider"><span>OR</span></div>
          <button className="auth-google-button" type="button" disabled={busy} onClick={handleGoogleSignIn}>
            <svg width="20" height="20" viewBox="0 0 21 20" fill="none" aria-hidden="true"><path d="M19.6 10.23c0-.68-.06-1.34-.18-1.98H10.5v3.75h5.1a4.36 4.36 0 0 1-1.89 2.86v2.34h3.06c1.79-1.65 2.83-4.08 2.83-6.97Z" fill="#4285F4"/><path d="M10.5 20c2.55 0 4.69-.85 6.25-2.3l-3.06-2.34c-.85.57-1.93.91-3.19.91-2.46 0-4.54-1.66-5.28-3.89H2.06v2.41A9.44 9.44 0 0 0 10.5 20Z" fill="#34A853"/><path d="M5.22 12.38a5.67 5.67 0 0 1 0-3.76V6.21H2.06a9.5 9.5 0 0 0 0 8.58l3.16-2.41Z" fill="#FBBC05"/><path d="M10.5 4.73c1.39 0 2.64.48 3.62 1.43l2.72-2.72C15.18 1.91 13.05 1 10.5 1a9.44 9.44 0 0 0-8.44 5.21l3.16 2.41c.74-2.23 2.82-3.89 5.28-3.89Z" fill="#EA4335"/></svg>
            <span>Continue with Google</span>
          </button>
        </form>
      </>}
      {step === 'forgot' && <form className="auth-form" onSubmit={handleSendPasswordReset}>
        <label className="field-group">Email address<input className="field" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="button button-primary auth-submit" disabled={busy}>{busy ? 'Sending link…' : 'Send password-reset link'}</button>
      </form>}
      {step === 'recover' && <form className="auth-form" onSubmit={handlePasswordRecovery}>
        <label className="field-group">New password<input className="field" type="password" autoComplete="new-password" minLength={12} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
        <label className="field-group">Confirm new password<input className="field" type="password" autoComplete="new-password" minLength={12} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="button button-primary auth-submit" disabled={busy || newPassword.length < 12 || newPassword !== confirmPassword}>{busy ? 'Updating password…' : 'Update password'}</button>
      </form>}

      {step === 'enroll' && <form ref={verifyFormRef} className="auth-form" onSubmit={handleVerify}>
        <div className="auth-qr"><img src={qrCode} alt="Authenticator setup QR code" /></div>
        <p className="auth-help">Open Google Authenticator, Microsoft Authenticator, 1Password or another TOTP app and scan this QR code. Then enter the six-digit code it generates.</p>
        <div className="auth-manual-setup">
          <p className="auth-help"><strong>Can't scan the QR code?</strong> If you're setting this up on the same phone, add the account manually using the setup key below.</p>
          <div className="auth-secret-row">
            <code className="auth-secret-value">{showSetupSecret ? setupSecret : '•••• •••• •••• ••••'}</code>
            <button className="button button-secondary" type="button" onClick={() => setShowSetupSecret((visible) => !visible)}>{showSetupSecret ? 'Hide key' : 'Show key'}</button>
            <button className="button button-secondary" type="button" disabled={!setupSecret} onClick={async () => {
              try {
                await navigator.clipboard.writeText(setupSecret)
                setSecretCopied(true)
                setError('')
              } catch {
                setError('Could not copy the setup key. You can reveal it and enter it manually.')
              }
            }}>{secretCopied ? 'Copied' : 'Copy key'}</button>
          </div>
          <p className="auth-help">In your authenticator app, choose the option to enter a setup key manually. Use the account name RouteHQ and select time-based (TOTP) if asked.</p>
          <p className="auth-help">Keep this key private. Anyone who has it can generate your verification codes.</p>
        </div>
        <VerificationCodeInput value={code} onChange={(value) => { setCode(value); setError('') }} description="Codes refresh every 30 seconds" hasError={!!error} autoFocus />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="button button-primary auth-submit" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Enable two-step verification'}</button>
      </form>}

      {step === 'mfa' && <form ref={verifyFormRef} className="auth-form" onSubmit={handleVerify}>
        <VerificationCodeInput value={code} onChange={(value) => { setCode(value); setError('') }} description="Use the current code from your authenticator app" hasError={!!error} autoFocus />
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="button button-primary auth-submit" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify and continue'}</button>
      </form>}

      {step !== 'login' && <button className="auth-back" type="button" onClick={async () => { await handleBackToLogin(); onPasswordRecovered() }}><ArrowLeft size={15} aria-hidden="true" /> <span>Cancel and return to sign in</span></button>}
    </section>
    <AuthVisual variant={visualVariant} />
    </div>
  </div>
}

export function AuthGate({ children }: { children: (mode: AppMode) => ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [authError, setAuthError] = useState('')
  const [passwordRecovery, setPasswordRecovery] = useState(() => new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type') === 'recovery')

  useEffect(() => {
    if (!supabase) return
    let alive = true
    const checkSession = async (current: Session | null) => {
      if (!alive) return
      try {
        if (!current) {
          await waitForMinimumLoadingTime()
          if (alive) {
            setSession(null)
            setAuthenticated(false)
            setAuthError('')
            setReady(true)
          }
          return
        }
        const { data, error } = await supabase!.auth.mfa.getAuthenticatorAssuranceLevel()
        if (error) throw error
        await waitForMinimumLoadingTime()
        if (alive) {
          setSession(current)
          setAuthenticated(data.currentLevel === 'aal2')
          setAuthError('')
          setReady(true)
        }
      } catch (error) {
        await waitForMinimumLoadingTime()
        if (alive) {
          setSession(null)
          setAuthenticated(false)
          setAuthError(error instanceof Error ? error.message : 'The sign-in service could not be reached. Check your connection and try again.')
          setReady(true)
        }
      }
    }
    supabase!.auth.getSession().then(({ data, error }) => {
      if (error) throw error
      return checkSession(data.session)
    }).catch((error: unknown) => {
      if (!alive) return
      setAuthError(error instanceof Error ? error.message : 'The sign-in service could not be reached. Check your connection and try again.')
      setReady(true)
    })
    const { data: listener } = supabase!.auth.onAuthStateChange((event, current) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true)
        setSession(current)
        setAuthenticated(false)
        setReady(true)
        return
      }
      if (event === 'SIGNED_OUT') setPasswordRecovery(false)
      window.setTimeout(() => { void checkSession(current) }, 0)
    })
    return () => { alive = false; listener.subscription.unsubscribe() }
  }, [])

  if (!supabase) return <div className="auth-screen"><div className="auth-layout"><section className="auth-panel"><img src={`${import.meta.env.BASE_URL}brand/routehq-logo.svg`} alt="RouteHQ" className="auth-logo" /><h1>Configuration required</h1><p className="auth-description">Supabase connection settings are missing. Contact the app administrator.</p></section><AuthVisual variant="dashboard" /></div></div>
  if (!ready) return <div className="auth-loading"><picture><source srcSet={`${import.meta.env.BASE_URL}brand/loading/routehq-loader.gif`} type="image/gif" /><img src={`${import.meta.env.BASE_URL}brand/routehq-logo.svg`} alt="" /></picture><span>Preparing secure workspace</span><i /></div>
  if (authError) return <div className="auth-screen"><div className="auth-layout"><section className="auth-panel"><img src={`${import.meta.env.BASE_URL}brand/routehq-logo.svg`} alt="RouteHQ" className="auth-logo" /><h1>Could not verify your session</h1><p className="auth-description" role="alert">{authError}</p><button className="button button-primary auth-submit" type="button" onClick={() => window.location.reload()}>Try again</button></section><AuthVisual variant="dashboard" /></div></div>
  if (!session || !authenticated || passwordRecovery) {
    return <AuthScreen
      key={passwordRecovery ? 'password-recovery' : 'sign-in'}
      recoveryMode={passwordRecovery}
      initialSession={session}
      onPasswordRecovered={() => {
        setPasswordRecovery(false)
        setSession(null)
        setAuthenticated(false)
        setReady(true)
      }}
      onAuthenticated={(nextSession) => {
        setPasswordRecovery(false)
        setSession(nextSession)
        setAuthenticated(true)
        setReady(true)
      }}
    />
  }
  return <>{children('live')}</>
}
