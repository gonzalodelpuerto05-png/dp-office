import { supabase } from './supabase'
import type { Profile } from '../types'

// Registra una acción en el historial de actividad. Se llama "fire and
// forget" después de cada mutación importante: no bloquea ni revierte
// la acción principal si el log falla.
export function logActivity(
  profile: Pick<Profile, 'id' | 'nombre'> | null | undefined,
  accion: string,
  entidad: string,
  entidad_nombre: string,
  detalle?: string
) {
  if (!profile) return
  supabase
    .from('activity_log')
    .insert({
      user_id: profile.id,
      user_nombre: profile.nombre,
      accion,
      entidad,
      entidad_nombre,
      detalle: detalle ?? null,
    })
    .then(() => {})
}
