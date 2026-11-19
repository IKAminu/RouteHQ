import { Toaster } from 'dynaura'
import 'dynaura/styles-no-font.css'
import { AuthGate, type AppMode } from '@/auth/AuthGate'
import { WorkspaceGate } from '@/auth/WorkspaceGate'
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider'

function RouteToaster() {
  const { theme } = useTheme()
  return <Toaster position="bottom-right" theme={theme} haptics={false} />
}

export default function App() {
  return <ThemeProvider>
    <RouteToaster />
    <AuthGate>
      {(_mode: AppMode) => <WorkspaceGate />}
    </AuthGate>
  </ThemeProvider>
}
