import { RouterProvider } from 'react-router'
import { Toaster } from 'dynaura'
import 'dynaura/styles-no-font.css'
import { AuthGate, type AppMode } from '@/auth/AuthGate'
import { WorkspaceGate } from '@/auth/WorkspaceGate'
import { AppStoreProvider } from '@/hooks/useAppStore'
import { ThemeProvider } from '@/theme/ThemeProvider'
import { router } from '@/app/routes'

export default function App() {
  return <ThemeProvider>
    <Toaster position="bottom-right" theme="light" haptics={false} />
    <AuthGate>
      {(mode: AppMode) => mode === 'demo'
        ? <AppStoreProvider mode="demo"><RouterProvider router={router} /></AppStoreProvider>
        : <WorkspaceGate />}
    </AuthGate>
  </ThemeProvider>
}
