import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  IconHome,
  IconBriefcase,
  IconBoard,
  IconDocument,
  IconGear,
  IconLogout,
  IconClock,
  IconSearch,
} from './icons'
import GlobalSearch from './GlobalSearch'

const NAV = [
  { to: '/', label: 'Inicio', end: true, Icon: IconHome },
  { to: '/inversiones', label: 'Inversiones', Icon: IconBriefcase },
  { to: '/tablero', label: 'Tablero', Icon: IconBoard },
  { to: '/reportes', label: 'Reportes', Icon: IconDocument },
  { to: '/actividad', label: 'Actividad', Icon: IconClock },
  { to: '/configuracion', label: 'Configuración', Icon: IconGear },
]

export default function Layout() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const [searchOpen, setSearchOpen] = useState(false)
  // En el tablero semanal las 7 columnas necesitan todo el ancho posible,
  // así que ahí la barra lateral se angosta a solo iconos.
  const collapsed = location.pathname.startsWith('/tablero')

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <aside
        className={`lg:relative shrink-0 bg-paper border-b lg:border-b-0 lg:border-r border-line lg:transition-[width] lg:duration-200 ${
          collapsed ? 'lg:w-20' : 'lg:w-64'
        }`}
      >
        <div className="p-6 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold text-ink">
              <span className={collapsed ? 'lg:hidden' : ''}>DP Office</span>
              <span className={collapsed ? 'hidden lg:inline' : 'hidden'}>DP</span>
            </h1>
            <p className={`text-sm text-ink-soft mt-1 ${collapsed ? 'lg:hidden' : ''}`}>Family Office</p>
          </div>
          <button
            onClick={() => setSearchOpen(true)}
            title="Buscar"
            className="text-ink-soft hover:text-terracotta shrink-0 p-1"
          >
            <IconSearch />
          </button>
        </div>
        <nav className="px-3 flex lg:flex-col gap-1 flex-wrap">
          {NAV.map(({ to, label, end, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                  collapsed ? 'lg:justify-center lg:px-2' : ''
                } ${isActive ? 'bg-terracotta text-white' : 'text-ink-soft hover:bg-cream hover:text-ink'}`
              }
            >
              <Icon className="shrink-0" />
              <span className={collapsed ? 'lg:hidden' : ''}>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div
          className={`p-4 mt-4 lg:mt-auto lg:absolute lg:bottom-0 ${collapsed ? 'lg:w-20' : 'lg:w-64'}`}
        >
          <div
            className={`bg-cream rounded-xl ${
              collapsed ? 'lg:p-2 lg:flex lg:flex-col lg:items-center gap-2' : 'px-4 py-3'
            }`}
          >
            <div className={collapsed ? 'lg:hidden' : ''}>
              <p className="text-sm font-medium text-ink">{profile?.nombre ?? 'Usuario'}</p>
              <p className="text-xs text-ink-soft truncate">{profile?.email}</p>
            </div>
            <span
              className={`${
                collapsed ? 'hidden lg:flex' : 'hidden'
              } w-9 h-9 rounded-full bg-terracotta text-white items-center justify-center text-sm font-semibold`}
              title={profile?.nombre}
            >
              {(profile?.nombre ?? 'U').charAt(0).toUpperCase()}
            </span>
            <button
              onClick={signOut}
              title="Cerrar sesión"
              className={`text-terracotta hover:text-terracotta-dark ${
                collapsed ? 'hidden lg:block' : 'hidden'
              }`}
            >
              <IconLogout />
            </button>
            <button
              onClick={signOut}
              className={`mt-2 text-sm font-medium text-terracotta hover:text-terracotta-dark ${
                collapsed ? 'lg:hidden' : ''
              }`}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </aside>
      <main className={`flex-1 w-full p-5 sm:p-8 ${collapsed ? '' : 'max-w-7xl mx-auto'}`}>
        <Outlet />
      </main>
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </div>
  )
}
