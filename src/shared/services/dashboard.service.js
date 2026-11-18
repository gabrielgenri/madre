import { supabase } from '../../core/supabase/client.js'

function client() {
  if (!supabase) throw new Error('Supabase no está configurado. Revisá .env.local.')
  return supabase
}

const isoDaysAgo = days => new Date(Date.now() - days * 86400000).toISOString()

export const DashboardService = {
  async overview() {
    const db = client()
    const since30 = isoDaysAgo(30)
    const since14 = isoDaysAgo(14)
    const { data: units, error: unitsError } = await db.from('editorial_units')
      .select('id,title,status,assigned_to,created_by,priority,due_at,updated_at')
      .order('updated_at', { ascending: false })
    if (unitsError) throw unitsError
    const rows = units ?? []
    if (!rows.length) return {
      metrics: { total: 0, inProduction: 0, inReview: 0, overdue: 0, reviewed: 0, published: 0, averageApprovalHours: null },
      status: [], workload: [], activity: [], attention: []
    }

    const ids = rows.map(unit => unit.id)
    const [versionsResult, reviewsResult, workResult, profilesResult] = await Promise.all([
      db.from('editorial_versions').select('id,editorial_unit_id,version_number').in('editorial_unit_id', ids).order('version_number', { ascending: false }),
      db.from('editorial_review_events').select('editorial_unit_id,source_version_id,event_type,created_at').in('editorial_unit_id', ids).gte('created_at', since30).order('created_at', { ascending: true }),
      db.from('editorial_work_events').select('editorial_unit_id,created_at').in('editorial_unit_id', ids).gte('created_at', since14).order('created_at', { ascending: true }),
      db.from('profiles').select('id,display_name')
    ])
    if (versionsResult.error) throw versionsResult.error
    if (reviewsResult.error) throw reviewsResult.error
    if (workResult.error) throw workResult.error
    // Los nombres son auxiliares; la métrica sigue disponible si el perfil no es legible por RLS.
    const profiles = profilesResult.error ? [] : (profilesResult.data ?? [])

    const latestVersion = new Map()
    for (const version of versionsResult.data ?? []) {
      if (!latestVersion.has(version.editorial_unit_id)) latestVersion.set(version.editorial_unit_id, version.id)
    }
    const latestReview = new Map()
    for (const event of [...(reviewsResult.data ?? [])].reverse()) {
      if (!latestReview.has(event.editorial_unit_id)) latestReview.set(event.editorial_unit_id, event)
    }

    const now = Date.now()
    const draft = rows.filter(item => item.status === 'draft')
    const overdue = draft.filter(item => item.due_at && new Date(item.due_at).getTime() < now)
    const waiting = draft.filter(item => {
      const review = latestReview.get(item.id)
      return review?.event_type === 'review_requested' && review.source_version_id === latestVersion.get(item.id)
    })
    const reviewed = rows.filter(item => item.status === 'reviewed')
    const published = rows.filter(item => item.status === 'published')

    const statusCounts = [
      { key: 'draft', label: 'En producción', count: draft.length - waiting.length },
      { key: 'review', label: 'Esperando revisión', count: waiting.length },
      { key: 'reviewed', label: 'Revisadas', count: reviewed.length },
      { key: 'published', label: 'Publicadas', count: published.length }
    ]
    const activeByPerson = new Map()
    for (const unit of draft) {
      if (!unit.assigned_to) continue
      activeByPerson.set(unit.assigned_to, (activeByPerson.get(unit.assigned_to) ?? 0) + 1)
    }
    const profileNames = new Map(profiles.map(profile => [profile.id, profile.display_name || 'Integrante ' + profile.id.slice(0, 8)]))
    const workload = [...activeByPerson.entries()]
      .map(([id, count]) => ({ id, name: profileNames.get(id) || 'Integrante ' + id.slice(0, 8), count }))
      .sort((a, b) => b.count - a.count).slice(0, 6)

    const activityMap = new Map()
    const addActivity = (timestamp, kind) => {
      const key = new Date(timestamp).toISOString().slice(0, 10)
      const item = activityMap.get(key) ?? { date: key, planning: 0, review: 0 }
      item[kind] += 1
      activityMap.set(key, item)
    }
    for (const event of workResult.data ?? []) addActivity(event.created_at, 'planning')
    for (const event of reviewsResult.data ?? []) addActivity(event.created_at, 'review')
    const activity = Array.from({ length: 14 }, (_, index) => {
      const date = new Date(Date.now() - (13 - index) * 86400000).toISOString().slice(0, 10)
      return activityMap.get(date) ?? { date, planning: 0, review: 0 }
    })

    const requests = new Map()
    const durations = []
    for (const event of reviewsResult.data ?? []) {
      const key = event.editorial_unit_id + ':' + event.source_version_id
      if (event.event_type === 'review_requested') requests.set(key, new Date(event.created_at).getTime())
      if (event.event_type === 'approved' && requests.has(key)) {
        const hours = (new Date(event.created_at).getTime() - requests.get(key)) / 3600000
        if (hours >= 0) durations.push(hours)
        requests.delete(key)
      }
    }
    const averageApprovalHours = durations.length
      ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length * 10) / 10
      : null

    const attentionById = new Map([...waiting, ...overdue].map(unit => [unit.id, unit]))
    const attention = [...attentionById.values()].sort((a, b) => {
      const aOver = a.due_at && new Date(a.due_at).getTime() < now ? 0 : 1
      const bOver = b.due_at && new Date(b.due_at).getTime() < now ? 0 : 1
      return aOver - bOver || new Date(a.due_at || a.updated_at) - new Date(b.due_at || b.updated_at)
    }).slice(0, 6).map(unit => ({
      id: unit.id, title: unit.title,
      reason: unit.due_at && new Date(unit.due_at).getTime() < now ? 'Vencida' : 'Esperando revisión',
      dueAt: unit.due_at
    }))

    return {
      metrics: {
        total: rows.length, inProduction: draft.length, inReview: waiting.length,
        overdue: overdue.length, reviewed: reviewed.length, published: published.length,
        averageApprovalHours
      },
      status: statusCounts, workload, activity, attention
    }
  }
}
