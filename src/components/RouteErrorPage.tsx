import { isRouteErrorResponse, useRouteError } from 'react-router'
import { AppErrorScreen } from '@/components/AppErrorScreen'

export function RouteErrorPage() {
  const error = useRouteError()
  const message = error instanceof Error ? error.message : ''
  const isNotFound = isRouteErrorResponse(error) && error.status === 404
  const detail = isNotFound
    ? 'RouteHQ could not find the page you requested (404). Check the address or return to the dashboard.'
    : message || 'An unexpected route error occurred. Reload the application and try again.'
  return <AppErrorScreen kind="unexpected" detail={detail} onRetry={() => window.location.reload()} />
}
