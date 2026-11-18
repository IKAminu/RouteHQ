import { RouterProvider } from 'react-router'
import { Toaster } from 'dynaura'
import 'dynaura/styles-no-font.css'
import { AuthGate, type AppMode } from '@/auth/AuthGate'
import { WorkspaceGate } from '@/auth/WorkspaceGate'
import { AppStoreProvider } from '@/hooks/useAppStore'
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider'
import { router } from '@/app/routes'

function RouteToaster() {
  const { theme } = useTheme()
  return <Toaster position="bottom-right" theme={theme} haptics={false} />
}

export default function App() {
  return <ThemeProvider>
    <RouteToaster />
    <AuthGate>
      {(mode: AppMode) => mode === 'demo'
        ? <AppStoreProvider mode="demo"><RouterProvider router={router} /></AppStoreProvider>
        : <WorkspaceGate />}
    </AuthGate>
  </ThemeProvider>
}
