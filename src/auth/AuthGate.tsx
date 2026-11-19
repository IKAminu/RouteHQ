import { useEffect, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { waitForMinimumLoadingTime } from '@/lib/loading'
import { dynaura } from 'dynaura'

export type AppMode = 'demo' | 'live'
type AuthStep = 'login' | 'mfa' | 'enroll' | 'forgot' | 'recover'

function AuthVisual() {
  return <aside className="auth-visual" aria-label="RouteHQ travel operations">
    <div className="auth-visual-top"><img src={`${import.meta.env.BASE_URL}brand/routehq-logo.svg`} alt="RouteHQ" /><span>TRAVEL OPERATIONS</span></div>
    <div className="auth-visual-main"><p>ROUTEHQ WORKSPACE</p><h2>Every journey.<br/>One clear view.</h2><span>Keep enquiries, bookings, travellers and payments connected from one workspace.</span>
      <div className="auth-route-flow"><div><i>01</i><span><strong>Enquiries</strong><small>Capture and qualify</small></span></div><b></b><div><i>02</i><span><strong>Bookings</strong><small>Coordinate each trip</small></span></div><b></b><div><i>03</i><span><strong>Departures</strong><small>Keep operations moving</small></span></div></div>
    </div>
    <div className="auth-visual-foot"><span>BUILT FOR TRAVEL AGENCIES</span><span>ROUTEHQ · 01</span></div>
  </aside>
}

function AuthScreen({ onAuthenticated, recoveryMode, onPasswordRecovered }: { onAuthenticated: (session: Session) => void; recoveryMode: boolean; onPasswordRecovered: () => void }) {
  const [step, setStep] = useState<AuthStep>(recoveryMode ? 'recover' : 'login')
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
      await beginSecondFactor()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in. Please try again.')
    } finally {
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
    if (newPassword.length < 10) {
      setError('Use a password with at least 10 characters.')
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
        options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.href },
      })
      if (signupError) throw signupError
      if (data.session) {
        setInfo('Your account has been created. Secure it with an authenticator to continue.')
        await beginSecondFactor()
      } else {
        setInfo('Account created. Check your email to confirm your address, then sign in to submit your agency application.')
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
      <img src={`${import.meta.env.BASE_URL}app-icon.svg`} alt="RouteHQ" className="auth-logo" />
      <p className="auth-eyebrow">AGENCY OPERATIONS</p>
      <h1>{step === 'login' ? (authMode === 'signup' ? 'Create your RouteHQ account' : 'Sign in to RouteHQ') : step === 'forgot' ? 'Reset your password' : step === 'recover' ? 'Choose a new password'  : step === 'enroll' ? 'Secure your account' : 'Verify it’s you'}</h1>
      <p className="auth-description">
        {step === 'login' ? (authMode === 'signup' ? 'Create an account first. You will submit your agency details after verifying your email.' : 'Sign in to manage your agency or submit an application to join RouteHQ.') : step === 'forgot' ? 'We will send a secure password-reset link to the email address on your account.' : step === 'recover' ? 'Choose a new password for your RouteHQ account. You will sign in again and complete two-step verification afterwards.' : step === 'enroll' ? 'Connect an authenticator app to secure your account.' : 'Enter the six-digit code from your authenticator app.'}
      </p>

      {step === 'login' && <form className="auth-form" onSubmit={authMode === 'signup' ? handleSignup : handleLogin}>
        {authMode === 'signup' && <label className="field-group">Your full name<input className="field" autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>}
        <label className="field-group">Email address<input className="field" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label className="field-group">Password<input className="field" type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} minLength={authMode === 'signup' ? 10 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        {authMode === 'signup' && <p className="auth-help">Use at least 10 characters. Email confirmation may be required before you can continue.</p>}
        {info && <p className="auth-info" role="status">{info}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="button button-primary auth-submit" disabled={busy}>{busy ? (authMode === 'signup' ? 'Creating account…' : 'Signing in…') : (authMode === 'signup' ? 'Create account' : 'Sign in')}</button>
      </form>}
      {step === 'forgot' && <form className="auth-form" onSubmit={handleSendPasswordReset}>
        <label className="field-group">Email address<input className="field" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="button button-primary auth-submit" disabled={busy}>{busy ? 'Sending link…' : 'Send password-reset link'}</button>
      </form>}
      {step === 'recover' && <form className="auth-form" onSubmit={handlePasswordRecovery}>
        <label className="field-group">New password<input className="field" type="password" autoComplete="new-password" minLength={10} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></label>
        <label className="field-group">Confirm new password<input className="field" type="password" autoComplete="new-password" minLength={10} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="button button-primary auth-submit" disabled={busy || newPassword.length < 10 || newPassword !== confirmPassword}>{busy ? 'Updating password…' : 'Update password'}</button>
      </form>}
      {step === 'login' && authMode === 'login' && <button className="auth-back" type="button" onClick={() => { setStep('forgot'); setError(''); setInfo('') }}>Forgot password?</button>}
      {step === 'login' && <button className="auth-back" type="button" onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setError(''); setInfo('') }}>{authMode === 'signup' ? 'Already registered? Sign in' : 'New to RouteHQ? Create an account'}</button>}

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
        <label className="field-group">Enter the code<input className={`field auth-code ${error ? 'has-error' : ''} ${code ? 'has-value' : ''}`} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus aria-invalid={!!error} aria-label="Six-digit authenticator code" aria-describedby="auth-code-help" value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }} placeholder="••••••" /></label><span id="auth-code-help" className="auth-code-help">Codes refresh every 30 seconds</span>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="button button-primary auth-submit" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Enable two-step verification'}</button>
      </form>}

      {step === 'mfa' && <form ref={verifyFormRef} className="auth-form" onSubmit={handleVerify}>
        <label className="field-group">Enter the code<input className={`field auth-code ${error ? 'has-error' : ''} ${code ? 'has-value' : ''}`} type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required aria-label="Six-digit authenticator code" aria-describedby="auth-code-help" value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, '').slice(0, 6)); setError('') }} placeholder="••••••" /></label><span id="auth-code-help" className="auth-code-help">Use the current code from your authenticator app</span>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="button button-primary auth-submit" disabled={busy || code.length !== 6}>{busy ? 'Verifying…' : 'Verify and continue'}</button>
      </form>}

      {step !== 'login' && <button className="auth-back" type="button" onClick={async () => { await handleBackToLogin(); onPasswordRecovered() }}>Cancel and return to sign in</button>}
      <p className="auth-footnote">Agency workspaces are activated after RouteHQ reviews and approves an application.</p>
    </section>
    <AuthVisual />
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

  if (!supabase) return <div className="auth-screen"><div className="auth-layout"><section className="auth-panel"><img src={`${import.meta.env.BASE_URL}app-icon.svg`} alt="RouteHQ" className="auth-logo" /><h1>Configuration required</h1><p className="auth-description">Supabase connection settings are missing. Contact the app administrator.</p></section><AuthVisual /></div></div>
  if (!ready) return <div className="auth-loading"><img src={`${import.meta.env.BASE_URL}app-icon.svg`} alt="" /><span>Preparing secure workspace</span><i /></div>
  if (authError) return <div className="auth-screen"><div className="auth-layout"><section className="auth-panel"><img src={`${import.meta.env.BASE_URL}app-icon.svg`} alt="RouteHQ" className="auth-logo" /><h1>Could not verify your session</h1><p className="auth-description" role="alert">{authError}</p><button className="button button-primary auth-submit" type="button" onClick={() => window.location.reload()}>Try again</button></section><AuthVisual /></div></div>
  if (!session || !authenticated || passwordRecovery) {
    return <AuthScreen
      key={passwordRecovery ? 'password-recovery' : 'sign-in'}
      recoveryMode={passwordRecovery}
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
