import { Routes, Route, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Layout from './components/Layout'
import FocusView from './views/FocusView'
import BoardView from './views/BoardView'
import ArchiveView from './views/ArchiveView'
import SettingsView from './views/SettingsView'

export default function App() {
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null)

  useEffect(() => {
    // Check if LLM is configured on mount
    void window.api.invoke('llm:checkHealth').then((result) => {
      setIsConfigured(result.configured)
    })
  }, [])

  // Show loading state while checking configuration
  if (isConfigured === null) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950 text-gray-400">
        Loading...
      </div>
    )
  }

  // If not configured, redirect to settings with a message
  if (!isConfigured) {
    return (
      <Routes>
        <Route element={<Layout />}>
          <Route path="*" element={<Navigate to="/settings" replace />} />
          <Route path="/settings" element={<SettingsView firstRun={true} />} />
        </Route>
      </Routes>
    )
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/focus" replace />} />
        <Route path="/focus" element={<FocusView />} />
        <Route path="/board" element={<BoardView />} />
        <Route path="/archive" element={<ArchiveView />} />
        <Route path="/settings" element={<SettingsView />} />
      </Route>
    </Routes>
  )
}
