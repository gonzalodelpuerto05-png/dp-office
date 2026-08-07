import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').order('nombre')
    setProfiles((data as Profile[]) ?? [])
  }, [])

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [reload])

  return { profiles, loading, reload }
}
