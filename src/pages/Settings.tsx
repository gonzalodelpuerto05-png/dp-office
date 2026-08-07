import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useProfiles } from '../hooks/useProfiles'
import { supabase } from '../lib/supabase'
import Modal from '../components/Modal'
import { logActivity } from '../lib/activity'

export default function Settings() {
  const { profile } = useAuth()
  const { profiles, reload } = useProfiles()
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function deleteUser(userId: string) {
    if (userId === profile?.id) {
      alert('No podés eliminar tu propio usuario.')
      return
    }
    if (!confirm('¿Eliminar este usuario? Perderá acceso a la app.')) return
    const target = profiles.find((p) => p.id === userId)
    const { error } = await supabase.functions.invoke('admin-delete-user', {
      body: { user_id: userId },
    })
    if (error) {
      setError('No se pudo eliminar el usuario.')
      return
    }
    if (target) logActivity(profile, 'eliminó', 'usuario', target.nombre)
    reload()
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-3xl font-semibold text-ink">Configuración</h1>

      <section className="bg-paper border border-line rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink">Usuarios</h2>
          {profile?.rol === 'admin' && (
            <button
              onClick={() => setShowNew(true)}
              className="px-4 py-2 rounded-lg bg-terracotta text-white text-sm font-medium hover:bg-terracotta-dark"
            >
              + Nuevo usuario
            </button>
          )}
        </div>

        {error && <p className="text-rose text-sm mb-3">{error}</p>}

        <ul className="divide-y divide-line">
          {profiles.map((p) => (
            <li key={p.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-ink">
                  {p.nombre} {p.rol === 'admin' && <span className="text-xs text-gold ml-1">Admin</span>}
                </p>
                <p className="text-sm text-ink-soft">{p.email}</p>
              </div>
              {profile?.rol === 'admin' && p.id !== profile.id && (
                <button
                  onClick={() => deleteUser(p.id)}
                  className="text-sm font-medium text-rose hover:text-rose/70"
                >
                  Eliminar
                </button>
              )}
            </li>
          ))}
        </ul>

        {profile?.rol !== 'admin' && (
          <p className="text-sm text-ink-soft mt-4">
            Solo el administrador puede crear o eliminar usuarios.
          </p>
        )}
      </section>

      {showNew && (
        <NewUserModal
          onClose={() => setShowNew(false)}
          onCreated={reload}
          onError={setError}
          creatorProfile={profile}
        />
      )}
    </div>
  )
}

function NewUserModal({
  onClose,
  onCreated,
  onError,
  creatorProfile,
}: {
  onClose: () => void
  onCreated: () => void
  onError: (msg: string) => void
  creatorProfile: ReturnType<typeof useAuth>['profile']
}) {
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!nombre.trim() || !email.trim() || password.length < 6) return
    setSaving(true)
    const { error } = await supabase.functions.invoke('admin-create-user', {
      body: { email: email.trim(), password, nombre: nombre.trim() },
    })
    setSaving(false)
    if (error) {
      onError('No se pudo crear el usuario. ¿El email ya existe?')
      return
    }
    logActivity(creatorProfile, 'creó', 'usuario', nombre.trim())
    onCreated()
    onClose()
  }

  return (
    <Modal title="Nuevo usuario" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Nombre</label>
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-line text-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-line text-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-line text-lg"
            placeholder="Mínimo 6 caracteres"
          />
        </div>
        <button
          disabled={saving}
          onClick={save}
          className="w-full py-3 rounded-xl bg-terracotta text-white font-medium hover:bg-terracotta-dark disabled:opacity-60"
        >
          {saving ? 'Creando...' : 'Crear usuario'}
        </button>
      </div>
    </Modal>
  )
}
