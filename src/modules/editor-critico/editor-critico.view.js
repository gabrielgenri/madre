import { CriticalEditorService } from './editor-critico.service.js'
import './editor-critico.css'

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char])

const severityLabel = { critical: 'Crítica', warning: 'Advertencia', note: 'Nota' }
const attentionLabel = { high: 'Atención alta', medium: 'Atención media', low: 'Sin alertas destacadas' }
const decisionLabel = { resolved: 'Resuelta', accepted: 'Aceptada para seguimiento', discarded: 'Descartada' }

export function mountCriticalEditor(host, unitId) {
  if (!host || !unitId) return () => {}
  host.innerHTML = `
    <section class="critical-editor" aria-labelledby="critical-editor-heading">
      <div class="critical-editor-head">
        <div><p class="eyebrow">SEGUNDA INSTANCIA DE CONTROL</p><h3 id="critical-editor-heading">Editor Crítico</h3>
        <p class="muted small">Análisis asistido de sesgos, atribuciones, riesgos potenciales, claridad y coherencia entre los seis formatos. No verifica externamente ni aprueba contenidos.</p></div>
        <button type="button" class="button primary" data-critical-run>Ejecutar análisis</button>
      </div>
      <p class="critical-editor-status muted small" data-critical-status role="status" aria-live="polite">Consultando informes anteriores…</p>
      <div data-critical-report><p class="muted small">Todavía no hay un informe del Editor Crítico.</p></div>
    </section>`
  const runButton = host.querySelector('[data-critical-run]')
  const status = host.querySelector('[data-critical-status]')
  const reportHost = host.querySelector('[data-critical-report]')
  let disposed = false
  let history = []

  function renderReport(review) {
    const metrics = review.metrics ?? {}
    const findings = review.findings ?? []
    const catalog = metrics.reference_catalog ?? {}
    const sourceNames = new Map((catalog.sources ?? []).map(item => [item.id, item.title]))
    const claimNames = new Map((catalog.claims ?? []).map(item => [item.id, item.text]))
    const formatNames = new Map((catalog.formats ?? []).map(item => [item.id, item.label]))
    const references = refs => {
      const labels = [
        ...(refs?.source_ids ?? []).map(id => 'Fuente: ' + (sourceNames.get(id) || id.slice(0, 8))),
        ...(refs?.claim_ids ?? []).map(id => 'Afirmación: ' + (claimNames.get(id) || id.slice(0, 8))),
        ...(refs?.format_ids ?? []).map(id => 'Formato: ' + (formatNames.get(id) || id.slice(0, 8)))
      ]
      return labels.length ? '<small class="critical-references">' + labels.map(esc).join(' · ') + '</small>' : ''
    }
    const comparisons = metrics.format_comparisons ?? []
    const observations = review.observations ?? []
    const questions = metrics.review_questions ?? []
    reportHost.innerHTML = `
      <div class="critical-report-meta"><strong>${esc(attentionLabel[metrics.overall_attention] || 'Informe generado')}</strong><span>Versión ${esc(metrics.source_version_number ?? '—')} · ${new Date(review.created_at).toLocaleString('es-AR')}</span><span>${findings.length} observaciones · ${comparisons.length}/6 formatos comparados</span></div>
      <p class="critical-summary">${esc(metrics.summary || 'El análisis no produjo una síntesis.')}</p>
      <div class="critical-findings"><h4>Observaciones del análisis</h4>
        ${findings.length ? findings.map((item, index) => `
          <article class="critical-finding severity-${esc(item.severity)}">
            <div class="critical-finding-title"><span>${esc(severityLabel[item.severity] || item.severity)} · ${esc(item.category || 'other')}</span><strong>${esc(item.title)}</strong></div>
            <p>${esc(item.detail)}</p>
            ${item.suggested_action ? '<p class="critical-action"><strong>Acción sugerida:</strong> ' + esc(item.suggested_action) + '</p>' : ''}
            ${references(item.evidence_refs)}
            <form class="critical-decision-form" data-finding-index="${index}">
              <label>Decisión humana</label><select name="decision"><option value="resolved">Marcar resuelta</option><option value="accepted">Aceptar para seguimiento</option><option value="discarded">Descartar observación</option></select>
              <input name="rationale" required minlength="3" maxlength="1200" placeholder="Fundamento de la decisión" />
              <button type="submit" class="button ghost">Registrar decisión</button>
            </form>
          </article>`).join('') : '<p class="muted small">No se identificaron observaciones específicas. Esto no equivale a aprobación.</p>'}
      </div>
      <div class="critical-comparisons"><h4>Coherencia entre formatos</h4>
        ${comparisons.map(item => `<article><strong>${esc(item.format_type)}</strong><span>${esc(item.consistency)}</span><p>${esc(item.detail)}</p>${references(item.evidence_refs)}</article>`).join('') || '<p class="muted small">No hay comparaciones disponibles.</p>'}
      </div>
      ${questions.length ? '<div class="critical-questions"><h4>Preguntas para la revisión humana</h4><ul>' + questions.map(item => '<li>' + esc(item) + '</li>').join('') + '</ul></div>' : ''}
      ${observations.length ? '<div class="critical-decisions"><h4>Decisiones registradas</h4>' + observations.map(item => '<p><span>' + esc(severityLabel[item.severity] || item.severity) + '</span> ' + esc(item.note) + '</p>').join('') + '</div>' : ''}
      <p class="critical-disclaimer">Informe asistido por IA. No constituye verificación externa, dictamen jurídico ni aprobación editorial. Las decisiones y la publicación siguen bajo responsabilidad humana.</p>`
    reportHost.querySelectorAll('.critical-decision-form').forEach(form => form.addEventListener('submit', async event => {
      event.preventDefault()
      const button = form.querySelector('button')
      const index = Number(form.dataset.findingIndex)
      const finding = findings[index]
      const data = new FormData(form)
      button.disabled = true
      try {
        await CriticalEditorService.recordDecision(review.id, finding, String(data.get('decision')), String(data.get('rationale')))
        status.textContent = 'Decisión humana registrada en el historial.'
        await refresh()
      } catch (error) {
        status.textContent = error.message
        button.disabled = false
      }
    }))
  }

  async function refresh() {
    try {
      history = await CriticalEditorService.history(unitId)
      if (disposed) return
      if (!history.length) {
        reportHost.innerHTML = '<p class="muted small">Todavía no hay un informe del Editor Crítico para esta unidad.</p>'
        status.textContent = 'El análisis está disponible para la versión madre vigente.'
        return
      }
      renderReport(history[0])
      status.textContent = history.length + ' informe(s) conservado(s). El más reciente corresponde a la versión ' + (history[0].metrics?.source_version_number ?? '—') + '.'
    } catch (error) {
      if (!disposed) status.textContent = error.message
    }
  }

  runButton.addEventListener('click', async () => {
    runButton.disabled = true
    status.textContent = 'Analizando contenido madre, investigación y formatos. Esto puede demorar unos instantes…'
    reportHost.innerHTML = '<p class="muted small">El Editor Crítico está evaluando el material disponible…</p>'
    try {
      await CriticalEditorService.run(unitId)
      if (!disposed) {
        status.textContent = 'Informe generado y guardado. Requiere evaluación humana.'
        await refresh()
      }
    } catch (error) {
      if (!disposed) {
        status.textContent = error.message
        reportHost.innerHTML = '<p class="muted small">No se guardó un informe nuevo.</p>'
      }
    } finally {
      runButton.disabled = false
    }
  })

  refresh()
  return () => { disposed = true; host.innerHTML = '' }
}
