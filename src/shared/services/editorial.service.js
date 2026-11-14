import { supabase } from '../../core/supabase/client.js'

function client() {
  if (!supabase) throw new Error('Supabase no está configurado. Revisá .env.local.')
  return supabase
}

export const EditorialService = {
  async list() {
    const { data, error } = await client()
      .from('editorial_units')
      .select('id,title,summary,status,created_at,updated_at,created_by')
      .order('updated_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async create({ title, summary = '' }) {
    const { data: authData, error: authError } = await client().auth.getUser()
    if (authError) throw authError
    if (!authData.user) throw new Error('La sesión expiró. Volvé a ingresar.')

    const { data, error } = await client()
      .from('editorial_units')
      .insert({
        title: title.trim(),
        summary: summary.trim(),
        created_by: authData.user.id,
        status: 'draft'
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  async update(id, changes) {
    const allowed = {}
    for (const key of ['title', 'summary', 'content_mother']) {
      if (key in changes) allowed[key] = changes[key]
    }
    const { data, error } = await client()
      .from('editorial_units')
      .update(allowed)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async get(id) {
    const { data, error } = await client()
      .from('editorial_units')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw error
    return data
  }
}
