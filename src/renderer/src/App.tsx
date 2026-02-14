import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import FocusView from './views/FocusView'
import BoardView from './views/BoardView'
import ArchiveView from './views/ArchiveView'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/focus" replace />} />
        <Route path="/focus" element={<FocusView />} />
        <Route path="/board" element={<BoardView />} />
        <Route path="/archive" element={<ArchiveView />} />
      </Route>
    </Routes>
  )
}
