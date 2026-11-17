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

export const EditorialService = {
  async list() {
    const { data, error } = await client().from('editorial_units')
      .select('id,title,summary,status,created_at,updated_at,created_by')
      .order('updated_at', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async create({ title, summary = '' }) {
    const user = await currentUser()
    const { data, error } = await client().from('editorial_units')
      .insert({ title: title.trim(), summary: summary.trim(), created_by: user.id, status: 'draft' })
      .select().single()
    if (error) throw error
    return data
  },

  async update(id, changes, changeNote) {
    const allowed = {}
    for (const key of ['title', 'summary', 'content_mother']) {
      if (key in changes) allowed[key] = changes[key]
    }
    const { data, error } = await client().rpc('update_editorial_unit_with_version', {
      p_unit_id: id,
      p_changes: allowed,
      p_change_note: changeNote
    })
    if (error) throw error
    return data
  },

  async versions(unitId) {
    const { data, error } = await client().from('editorial_versions')
      .select('id,version_number,snapshot,change_note,created_by,created_at')
      .eq('editorial_unit_id', unitId)
      .order('version_number', { ascending: false })
    if (error) throw error
    return data ?? []
  },

  async formats(unitId) {
    const { data, error } = await client().from('editorial_formats')
      .select('id,format_type,title,content,status,source_version_id,is_stale,updated_at')
      .eq('editorial_unit_id', unitId)
      .order('format_type')
    if (error) throw error
    return data ?? []
  },

  async latestVersionId(unitId) {
    const { data, error } = await client().from('editorial_versions')
      .select('id,version_number')
      .eq('editorial_unit_id', unitId)
      .order('version_number', { ascending: false })
      .limit(1)
      .single()
    if (error) throw error
    return data
  },

  async generateFormat(unitId, formatType) {
    const { data, error } = await client().functions.invoke('generate-editorial-format', {
      body: { unit_id: unitId, format_type: formatType }
    })
    if (error) {
      let detail = ''
      try {
        const response = error.context?.clone ? error.context.clone() : error.context
        const payload = response?.json ? await response.json() : null
        detail = payload?.error ?? ''
      } catch {
        // El SDK puede devolver un error sin cuerpo JSON legible.
      }
      throw new Error(detail || error.message || 'No se pudo generar el borrador.')
    }
    return data
  },

  async saveFormat(unitId, values) {
    const { data, error } = await client().rpc('save_editorial_format', {
      p_unit_id: unitId,
      p_format_type: values.format_type,
      p_title: values.title,
      p_content: values.content
    })
    if (error) throw error
    return data
  },

  async get(id) {
    const { data, error } = await client().from('editorial_units').select('*').eq('id', id).single()
    if (error) throw error
    return data
  },

  async researchBundle(unitId) {
    const db = client()
    const [sources, claims] = await Promise.all([
      db.from('sources').select('*').eq('editorial_unit_id', unitId).order('created_at', { ascending: false }),
      db.from('claims').select('*').eq('editorial_unit_id', unitId).order('created_at', { ascending: false })
    ])
    if (sources.error) throw sources.error
    if (claims.error) throw claims.error
    const claimIds = (claims.data ?? []).map(item => item.id)
    let evidences = []
    let verifications = []
    if (claimIds.length) {
      const [evidenceResult, verificationResult] = await Promise.all([
        db.from('evidences').select('*').eq('editorial_unit_id', unitId).order('created_at', { ascending: false }),
        db.from('verifications').select('*').in('claim_id', claimIds).order('checked_at', { ascending: false })
      ])
      if (evidenceResult.error) throw evidenceResult.error
      if (verificationResult.error) throw verificationResult.error
      evidences = evidenceResult.data ?? []
      verifications = verificationResult.data ?? []
    } else {
      const { data, error } = await db.from('evidences').select('*').eq('editorial_unit_id', unitId).order('created_at', { ascending: false })
      if (error) throw error
      evidences = data ?? []
    }
    return { sources: sources.data ?? [], claims: claims.data ?? [], evidences, verifications }
  },

  async addSource(unitId, values) {
    const user = await currentUser()
    const { data, error } = await client().from('sources').insert({
      editorial_unit_id: unitId, title: values.title.trim(), source_type: values.source_type || 'other',
      source_url: values.source_url.trim() || null, publisher: values.publisher.trim() || null,
      author: values.author.trim() || null, original_text: values.original_text.trim() || null,
      notes: values.notes.trim() || null, created_by: user.id
    }).select().single()
    if (error) throw error
    return data
  },

  async addClaim(unitId, values) {
    const user = await currentUser()
    const { data, error } = await client().from('claims').insert({
      editorial_unit_id: unitId, claim_text: values.claim_text.trim(),
      claim_type: values.claim_type, importance: values.importance, context_note: values.context_note.trim() || null,
      created_by: user.id
    }).select().single()
    if (error) throw error
    return data
  },

  async addEvidence(unitId, values) {
    const user = await currentUser()
    const { data, error } = await client().from('evidences').insert({
      editorial_unit_id: unitId, claim_id: values.claim_id || null, source_id: values.source_id || null,
      evidence_text: values.evidence_text.trim(), locator: values.locator.trim() || null,
      relation: values.relation, created_by: user.id
    }).select().single()
    if (error) throw error
    return data
  },

  async addVerification(claimId, values) {
    const user = await currentUser()
    const { data, error } = await client().from('verifications').insert({
      claim_id: claimId, status: values.status, rationale: values.rationale.trim() || null, checked_by: user.id
    }).select().single()
    if (error) throw error
    return data
  }
}
