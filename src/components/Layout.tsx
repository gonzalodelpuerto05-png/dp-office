import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/', label: 'Inicio', end: true },
  { to: '/inversiones', label: 'Inversiones' },
  { to: '/tablero', label: 'Tablero' },
  { to: '/reportes', label: 'Reportes' },
  { to: '/configuracion', label: 'Configuración' },
]

export default function Layout() {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <aside className="lg:w-64 shrink-0 bg-paper border-b lg:border-b-0 lg:border-r border-line">
        <div className="p-6">
          <h1 className="text-2xl font-semibold text-ink">DP Office</h1>
          <p className="text-sm text-ink-soft mt-1">Family Office</p>
        </div>
        <nav className="px-3 flex lg:flex-col gap-1 flex-wrap">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                  isActive
                    ? 'bg-terracotta text-white'
                    : 'text-ink-soft hover:bg-cream hover:text-ink'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 mt-4 lg:mt-auto lg:absolute lg:bottom-0 lg:w-64">
          <div className="px-4 py-3 bg-cream rounded-xl">
            <p className="text-sm font-medium text-ink">{profile?.nombre ?? 'Usuario'}</p>
            <p className="text-xs text-ink-soft truncate">{profile?.email}</p>
            <button
              onClick={signOut}
              className="mt-2 text-sm font-medium text-terracotta hover:text-terracotta-dark"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>
      <main className="flex-1 p-5 sm:p-8 max-w-7xl mx-auto w-full">
        <Outlet />
      </main>
    </div>
  )
}
