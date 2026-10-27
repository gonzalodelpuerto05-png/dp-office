// Vercel Cron lo llama una vez por día: el plan gratuito de Supabase pausa el proyecto tras ~7 días sin consultas.
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }

  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return res.status(500).json({ error: 'missing env' })

  try {
    const response = await fetch(`${url}/rest/v1/categories?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    })
    return res.status(response.ok ? 200 : 502).json({ supabaseStatus: response.status })
  } catch (err) {
    return res.status(502).json({ error: String(err) })
  }
}
