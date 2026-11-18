import { DashboardService } from '../../shared/services/dashboard.service.js'
import './dashboard.css'

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char])

const shortDate = value => new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' }).format(new Date(value))

export function mountDashboard(root, onOpenUnit) {
  const topbar = root.querySelector('.topbar')
  if (!topbar) return () => {}
  const host = document.createElement('section')
  host.className = 'editorial-dashboard'
  host.setAttribute('aria-labelledby', 'dashboard-heading')
  host.innerHTML = `
    <div class="dashboard-head">
      <div><p class="eyebrow">GESTIÓN EDITORIAL</p><h2 id="dashboard-heading">Panel de gestión</h2><p class="muted small">Una lectura operativa de la producción, las revisiones y la actividad del equipo.</p></div>
      <button type="button" class="button ghost" data-dashboard-refresh>Actualizar datos</button>
    </div>
    <div class="dashboard-metrics" id="dashboard-metrics" aria-live="polite"><p class="muted small">Cargando indicadores…</p></div>
    <div class="dashboard-grid">
      <section class="dashboard-panel"><div class="dashboard-panel-head"><h3>Producción por estado</h3><span class="muted small">Unidades visibles</span></div><div id="dashboard-status"></div></section>
      <section class="dashboard-panel"><div class="dashboard-panel-head"><h3>Carga por responsable</h3><span class="muted small">Unidades en borrador asignadas</span></div><div id="dashboard-workload"></div></section>
      <section class="dashboard-panel dashboard-activity"><div class="dashboard-panel-head"><h3>Actividad reciente</h3><span class="muted small">Últimos 14 días · planificación y revisión</span></div><div id="dashboard-activity"></div></section>
      <section class="dashboard-panel"><div class="dashboard-panel-head"><h3>Requieren atención</h3><span class="muted small">Vencimientos y revisiones</span></div><div id="dashboard-attention"></div></section>
    </div>
    <p class="dashboard-footnote">Los indicadores respetan los permisos y la visibilidad de datos de la sesión actual. El promedio de aprobación considera solicitudes y aprobaciones de la misma versión registradas en los últimos 30 días.</p>
    <p class="dashboard-error" id="dashboard-error" role="status" aria-live="polite"></p>`
  topbar.insertAdjacentElement('afterend', host)

  const metrics = host.querySelector('#dashboard-metrics')
  const status = host.querySelector('#dashboard-status')
  const workload = host.querySelector('#dashboard-workload')
  const activity = host.querySelector('#dashboard-activity')
  const attention = host.querySelector('#dashboard-attention')
  const errorBox = host.querySelector('#dashboard-error')
  const refreshButton = host.querySelector('[data-dashboard-refresh]')
  let disposed = false

  function render(data) {
    const m = data.metrics
    const cards = [
      ['En producción', m.inProduction, 'unidades en borrador'],
      ['Esperando revisión', m.inReview, 'solicitudes vigentes'],
      ['Vencidas', m.overdue, 'requieren seguimiento'],
      ['Revisadas', m.reviewed, 'aprobadas editorialmente'],
      ['Publicadas', m.published, 'estado publicado'],
      ['Tiempo de aprobación', m.averageApprovalHours === null ? '—' : m.averageApprovalHours + ' h', 'promedio · últimos 30 días']
    ]
    metrics.innerHTML = cards.map(([label, value, detail]) => `<article class="dashboard-metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`).join('')

    const total = Math.max(1, m.total)
    status.innerHTML = data.status.map(item => `
      <div class="dashboard-bar-row"><div><span>${escapeHtml(item.label)}</span><strong>${item.count}</strong></div>
      <div class="dashboard-bar-track"><span style="width:${Math.min(100, item.count / total * 100)}%"></span></div></div>`).join('')

    const maxLoad = Math.max(1, ...data.workload.map(item => item.count))
    workload.innerHTML = data.workload.length ? data.workload.map(item => `
      <div class="dashboard-bar-row"><div><span>${escapeHtml(item.name)}</span><strong>${item.count}</strong></div>
      <div class="dashboard-bar-track"><span style="width:${item.count / maxLoad * 100}%"></span></div></div>`).join('') : '<p class="muted small">No hay unidades en borrador asignadas a responsables visibles.</p>'

    const maxActivity = Math.max(1, ...data.activity.map(item => item.planning + item.review))
    activity.innerHTML = `<div class="dashboard-activity-chart" role="img" aria-label="Actividad diaria de planificación y revisión en los últimos catorce días">${data.activity.map(item => {
      const planningHeight = item.planning / maxActivity * 100
      const reviewHeight = item.review / maxActivity * 100
      return `<div class="dashboard-day"><div class="dashboard-columns"><span class="dashboard-column planning" style="height:${planningHeight}%"></span><span class="dashboard-column review" style="height:${reviewHeight}%"></span></div><small>${shortDate(item.date)}</small></div>`
    }).join('')}</div><div class="dashboard-legend"><span><i class="planning"></i> Planificación</span><span><i class="review"></i> Revisión</span></div>`

    attention.innerHTML = data.attention.length ? data.attention.map(item => `
      <button type="button" class="dashboard-attention-item" data-open-unit="${escapeHtml(item.id)}"><span><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.reason)}${item.dueAt ? ' · ' + escapeHtml(shortDate(item.dueAt)) : ''}</small></span><span aria-hidden="true">→</span></button>`).join('') : '<p class="muted small">No hay unidades vencidas ni esperando revisión en esta vista.</p>'
    attention.querySelectorAll('[data-open-unit]').forEach(button => button.addEventListener('click', () => onOpenUnit(button.dataset.openUnit)))
  }

  async function refresh() {
    refreshButton.disabled = true
    errorBox.textContent = ''
    metrics.innerHTML = '<p class="muted small">Actualizando indicadores…</p>'
    try {
      const data = await DashboardService.overview()
      if (!disposed) render(data)
    } catch (error) {
      if (!disposed) {
        metrics.innerHTML = '<p class="muted small">No se pudieron cargar los indicadores.</p>'
        errorBox.textContent = error.message
      }
    } finally {
      refreshButton.disabled = false
    }
  }

  refreshButton.addEventListener('click', refresh)
  refresh()
  return () => { disposed = true; host.remove() }
}
