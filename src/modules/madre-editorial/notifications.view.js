import { NotificationsService } from '../../shared/services/notifications.service.js'

const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[char])

const formatDate = value => new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short', timeStyle: 'short'
}).format(new Date(value))

const labels = {
  work_assigned: 'Asignación',
  work_reassigned: 'Cambio de asignación',
  review_requested: 'Revisión solicitada',
  changes_requested: 'Correcciones solicitadas',
  review_approved: 'Aprobación',
  due_soon: 'Vencimiento próximo',
  overdue: 'Vencida'
}

export function mountNotifications(root, onOpenUnit) {
  const topbar = root.querySelector('.topbar')
  if (!topbar) return () => {}

  const host = document.createElement('div')
  host.className = 'notification-center'
  host.innerHTML = `
    <button type="button" class="notification-trigger" id="notifications-trigger"
      aria-expanded="false" aria-controls="notifications-panel" aria-label="Abrir notificaciones">
      <span aria-hidden="true">♧</span><span>Notificaciones</span>
      <span class="notification-count" id="notification-count" hidden>0</span>
    </button>
    <section class="notification-panel" id="notifications-panel" hidden aria-label="Notificaciones editoriales">
      <div class="notification-panel-head">
        <div><strong>Notificaciones</strong><p class="muted small">Actividad de tu trabajo editorial</p></div>
        <button type="button" class="button ghost" id="notifications-read-all">Marcar todas leídas</button>
      </div>
      <div class="notification-items" id="notification-items" aria-live="polite">
        <p class="muted small">Cargando notificaciones…</p>
      </div>
    </section>`
  topbar.append(host)

  const trigger = host.querySelector('#notifications-trigger')
  const panel = host.querySelector('#notifications-panel')
  const items = host.querySelector('#notification-items')
  const count = host.querySelector('#notification-count')
  let notifications = []
  let disposed = false

  async function refresh() {
    try {
      notifications = await NotificationsService.list({ limit: 40 })
      const unread = notifications.filter(item => !item.read_at).length
      count.textContent = unread > 99 ? '99+' : String(unread)
      count.hidden = unread === 0
      items.innerHTML = notifications.length ? notifications.map(item => `
        <button type="button" class="notification-item ${item.read_at ? '' : 'unread'}"
          data-notification-id="${escapeHtml(item.id)}" data-unit-id="${escapeHtml(item.editorial_unit_id)}">
          <span class="notification-item-top"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(labels[item.event_type] || 'Actividad')}</small></span>
          <span class="notification-body">${escapeHtml(item.body)}</span>
          <time>${escapeHtml(formatDate(item.created_at))}</time>
        </button>`).join('') : '<p class="muted small notification-empty">No tenés notificaciones. Las novedades editoriales aparecerán acá.</p>'
    } catch (error) {
      items.innerHTML = '<p class="muted small notification-empty">No se pudieron cargar las notificaciones: ' + escapeHtml(error.message) + '</p>'
    }
  }

  trigger.addEventListener('click', async () => {
    const opening = panel.hidden
    panel.hidden = !opening
    trigger.setAttribute('aria-expanded', String(opening))
    if (opening) await refresh()
  })

  host.querySelector('#notifications-read-all').addEventListener('click', async () => {
    const button = host.querySelector('#notifications-read-all')
    button.disabled = true
    try {
      await NotificationsService.markAllRead()
      await refresh()
    } catch (error) {
      items.innerHTML = '<p class="muted small">' + escapeHtml(error.message) + '</p>'
    } finally {
      button.disabled = false
    }
  })

  items.addEventListener('click', async event => {
    const itemButton = event.target.closest('[data-notification-id]')
    if (!itemButton) return
    const notification = notifications.find(item => item.id === itemButton.dataset.notificationId)
    if (!notification) return
    itemButton.disabled = true
    try {
      if (!notification.read_at) await NotificationsService.markRead(notification.id)
      panel.hidden = true
      trigger.setAttribute('aria-expanded', 'false')
      await refresh()
      await onOpenUnit(notification.editorial_unit_id)
    } catch (error) {
      itemButton.disabled = false
      items.insertAdjacentHTML('afterbegin', '<p class="muted small">' + escapeHtml(error.message) + '</p>')
    }
  })

  const unsubscribe = NotificationsService.subscribe(() => {
    if (!disposed) refresh()
  })
  refresh()

  return () => {
    disposed = true
    unsubscribe?.()
    host.remove()
  }
}
