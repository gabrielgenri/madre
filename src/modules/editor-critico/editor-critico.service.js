import { supabase } from '../../core/supabase/client.js'

function client() {
  if (!supabase) throw new Error('Supabase no está configurado. Revisá .env.local.')
  return supabase
}

async function currentUser() {
  const { data, error } = await client().auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error('La sesión expiró. Volvé a ingresar.')
  return data.user
}

const attentionStatus = level => level === 'high' || level === 'medium' ? 'needs_attention' : 'checks_complete'

export const CriticalEditorService = {
  async run(unitId) {
    const user = await currentUser()
    const { data, error } = await client().functions.invoke('editorial-critical-review', {
      body: { unit_id: unitId }
    })
    if (error) {
      let detail = ''
      try {
        const response = error.context?.clone ? error.context.clone() : error.context
        const payload = response?.json ? await response.json() : null
        detail = payload?.error ?? ''
      } catch {}
      throw new Error(detail || error.message || 'No se pudo ejecutar el Editor Crítico.')
    }
    if (!data?.source_version_id || !data?.report) throw new Error('El Editor Crítico devolvió un informe incompleto.')

    const latest = await client().from('editorial_versions').select('id,version_number')
      .eq('editorial_unit_id', unitId).order('version_number', { ascending: false }).limit(1).single()
    if (latest.error) throw latest.error
    if (latest.data.id !== data.source_version_id) {
      throw new Error('El Contenido Madre cambió durante el análisis. Volvé a ejecutar el Editor Crítico para revisar la versión vigente.')
    }

    const report = data.report
    const findings = Array.isArray(report.findings) ? report.findings : []
    const comparisons = Array.isArray(report.format_comparisons) ? report.format_comparisons : []
    const { data: saved, error: saveError } = await client().from('editorial_quality_reviews').insert({
      editorial_unit_id: unitId,
      source_version_id: data.source_version_id,
      scope: 'cross_format',
      status: attentionStatus(report.overall_attention),
      checklist: Array.isArray(report.checklist) ? report.checklist : [],
      findings,
      metrics: {
        engine: 'editor_critico_ai',
        model: data.model || 'unknown',
        source_version_number: data.source_version_number,
        generated_at: data.generated_at,
        summary: report.summary || '',
        overall_attention: report.overall_attention || 'medium',
        format_comparisons: comparisons,
        review_questions: Array.isArray(report.review_questions) ? report.review_questions : [],
        reference_catalog: data.reference_catalog || {},
        finding_counts: {
          critical: findings.filter(item => item.severity === 'critical').length,
          warning: findings.filter(item => item.severity === 'warning').length,
          note: findings.filter(item => item.severity === 'note').length
        },
        formats_reviewed: comparisons.length
      },
      created_by: user.id
    }).select().single()
    if (saveError) throw saveError
    return saved
  },

  async history(unitId) {
    const { data, error } = await client().from('editorial_quality_reviews')
      .select('id,source_version_id,status,checklist,findings,metrics,created_at,created_by')
      .eq('editorial_unit_id', unitId)
      .eq('scope', 'cross_format')
      .order('created_at', { ascending: false })
      .limit(40)
    if (error) throw error
    const reports = (data ?? []).filter(item => item.metrics?.engine === 'editor_critico_ai')
    const ids = reports.map(item => item.id)
    if (!ids.length) return []
    const { data: observations, error: observationError } = await client().from('editorial_quality_observations')
      .select('id,review_id,severity,note,created_at,created_by')
      .in('review_id', ids)
      .order('created_at', { ascending: false })
    if (observationError) throw observationError
    return reports.map(item => ({
      ...item,
      observations: (observations ?? []).filter(note => note.review_id === item.id)
    }))
  },

  async recordDecision(reviewId, finding, decision, rationale) {
    const user = await currentUser()
    const labels = {
      resolved: 'Resuelta',
      accepted: 'Aceptada para seguimiento',
      discarded: 'Descartada'
    }
    if (!labels[decision]) throw new Error('Decisión editorial no válida.')
    const note = `Decisión editorial humana: ${labels[decision]}. Hallazgo: ${String(finding?.title || 'Observación').slice(0, 180)}. Fundamento: ${String(rationale || '').trim()}`
    const { data, error } = await client().from('editorial_quality_observations').insert({
      review_id: reviewId,
      severity: ['critical', 'warning', 'note'].includes(finding?.severity) ? finding.severity : 'note',
      note,
      created_by: user.id
    }).select().single()
    if (error) throw error
    return data
  }
}
