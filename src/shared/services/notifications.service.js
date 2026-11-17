import { supabase } from '../../core/supabase/client.js'

function db() {
  if (!supabase) throw new Error('Supabase no está configurado. Revisá .env.local.')
  return supabase
}

export const NotificationsService = {
  async list({ limit = 30 } = {}) {
    const client = db()
    const { error: reminderError } = await client.rpc('enqueue_my_editorial_due_notifications')
    if (reminderError) throw reminderError

    const { data, error } = await client
      .from('editorial_notifications')
      .select('id,editorial_unit_id,event_type,title,body,metadata,created_at,read_at')
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(Number(limit) || 30, 1), 100))
    if (error) throw error
    return data ?? []
  },

  async unreadCount() {
    const { count, error } = await db()
      .from('editorial_notifications')
      .select('id', { count: 'exact', head: true })
      .is('read_at', null)
    if (error) throw error
    return count ?? 0
  },

  async markRead(id) {
    const { data, error } = await db()
      .from('editorial_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .is('read_at', null)
      .select('id,read_at')
      .maybeSingle()
    if (error) throw error
    return data
  },

  async markAllRead() {
    const { data, error } = await db()
      .from('editorial_notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null)
      .select('id')
    if (error) throw error
    return data?.length ?? 0
  },

  subscribe(onChange) {
    const channel = db().channel('editorial-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'editorial_notifications' }, onChange)
      .subscribe()
    return () => db().removeChannel(channel)
  }
}
