import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertCircle, AlertTriangle, Clipboard, Database, RefreshCw, WifiOff } from 'lucide-react'

type ErrorKind = 'database' | 'unexpected'
function classify(detail: string, kind: ErrorKind) {
  const value = detail.toLowerCase()
  if (/failed to fetch|network|offline|internet|connection|timeout|timed out/.test(value)) return { title: 'Connection interrupted', description: 'RouteHQ could not reach the service. Check your internet connection, then retry. Your existing database records have not been replaced with empty data.', code: 'NETWORK' }
  if (/jwt|token|session|unauthori[sz]ed|401|expired/.test(value)) return { title: 'Your session needs attention', description: 'Your sign-in session may have expired. Try again first. If the problem continues, sign out and sign in again.', code: 'AUTH' }
  if (/permission|forbidden|row.level|rls|403|not allowed/.test(value)) return { title: 'Access could not be verified', description: 'Your account may not currently have permission to read this workspace. Check that you are signed into the correct agency account or contact the platform administrator.', code: 'PERMISSION' }
  if (/does not exist|could not find the table|schema cache|pgrst|column/.test(value)) return { title: 'The database needs an update', description: 'The application and database may be on different schema versions. No records will be edited until the required database structure is available.', code: 'SCHEMA' }
  if (/429|rate limit|too many requests/.test(value)) return { title: 'Too many requests', description: 'The service is temporarily limiting requests. Wait a moment and retry.', code: 'RATE_LIMIT' }
  if (/500|502|503|504|internal server|temporarily unavailable/.test(value)) return { title: 'The service is temporarily unavailable', description: 'The database service returned a server error. Your workspace is paused until a fresh load succeeds.', code: 'SERVER' }
  return kind === 'database'
    ? { title: 'We couldn’t load this workspace', description: 'RouteHQ could not safely finish loading your agency records. Editing is paused so an incomplete load cannot overwrite existing data. Retry the connection or reload the app.', code: 'DATA_LOAD' }
    : { title: 'Something unexpected happened', description: 'RouteHQ stopped this screen rather than continuing in an unstable state. Reload the app to start a clean session.', code: 'APP_ERROR' }
}
export function AppErrorScreen({ kind, detail, onRetry }: { kind: ErrorKind; detail: string; onRetry?: () => void }) {
  const info = classify(detail, kind)
  const Icon = info.code === 'NETWORK' ? WifiOff : info.code === 'SCHEMA' ? Database : info.code === 'PERMISSION' || info.code === 'AUTH' ? AlertCircle : AlertTriangle
  const copyDetails = () => { void navigator.clipboard?.writeText(`RouteHQ error [${info.code}]\n${info.title}\n${detail}`) }
  return <main className="app-error-screen" role="alert">
    <section className="app-error-card">
      <div className="app-error-brand"><span className="app-error-mark"><Icon size={22}/></span><span>RouteHQ · Recovery</span></div>
      <h1>{info.title}</h1>
      <p className="app-error-copy">{info.description}</p>
      <span className="app-error-code">ERROR {info.code}</span>
      <div className="app-error-actions">
        {onRetry && <button type="button" onClick={onRetry}><RefreshCw size={15}/> Try again</button>}
        <button type="button" onClick={() => window.location.reload()}><RefreshCw size={15}/> Reload app</button>
        <button type="button" onClick={copyDetails}><Clipboard size={15}/> Copy error details</button>
      </div>
      <details className="app-error-details"><summary>Technical details</summary><pre className="app-error-technical">{detail}</pre></details>
    </section>
  </main>
}
type BoundaryState = { error: Error | null }
export class AppErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null }
  static getDerivedStateFromError(error: Error): BoundaryState { return { error } }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('RouteHQ application error', error, info.componentStack) }
  render() {
    if (this.state.error) return <AppErrorScreen kind="unexpected" detail={this.state.error.stack || this.state.error.message} />
    return this.props.children
  }
}
