import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/focus', label: 'Focus' },
  { to: '/board', label: 'Board' },
  { to: '/archive', label: 'Archive' }
] as const

export default function Layout() {
  return (
    <div className="flex h-screen flex-col bg-gray-950 text-gray-100">
      <nav className="flex items-center gap-1 border-b border-gray-800 px-4 py-2">
        <span className="mr-4 text-sm font-semibold tracking-wide text-gray-400">
          Chaos Coordinator
        </span>
        {navItems.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `rounded-md px-3 py-1.5 text-sm transition-colors ${
                isActive ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
