import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Category, Investment } from '../types'

export function useCategoriesWithInvestments() {
  const [categories, setCategories] = useState<Category[]>([])
  const [investments, setInvestments] = useState<Investment[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const [{ data: cats }, { data: invs }] = await Promise.all([
      supabase.from('categories').select('*').order('created_at'),
      supabase.from('investments').select('*').order('created_at'),
    ])
    setCategories((cats as Category[]) ?? [])
    setInvestments((invs as Investment[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return { categories, investments, loading, reload }
}
