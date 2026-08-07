import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Category, Investment } from '../types'

export function useCategoriesWithInvestments() {
  const [categories, setCategories] = useState<Category[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)

  // No toca "loading": se usa para refrescar después de guardar cambios,
  // sin volver a mostrar la pantalla de carga (eso hacía perder la
  // posición del scroll cada vez que se guardaba algo).
  const reload = useCallback(async () => {
    const [{ data: cats }, { data: invs }] = await Promise.all([
      supabase.from('categories').select('*').order('created_at'),
      supabase.from('investments').select('*').order('created_at'),
    ])
    setCategories((cats as Category[]) ?? [])
    setInvestments((invs as Investment[]) ?? [])
  }, [])

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [reload])

  return { categories, investments, loading, reload }
}
