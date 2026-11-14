import { EditorialService } from '../../shared/services/editorial.service.js'

const esc = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c])

const date = (value) => new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium', timeStyle: 'short'
}).format(new Date(value))

export async function renderWorkspace(root, user, onSignOut) {
  root.innerHTML = `
    <div class="shell">
      <aside class="sidebar">
        <a class="brand" href="#" aria-label="Madre inicio">MADRE<span class="dot">.</span></a>
        <p class="eyebrow">ESPACIO DE TRABAJO</p>
        <nav aria-label="Navegación principal">
          <a class="nav-item active" href="#editorial">Madre Editorial</a>
          <span class="nav-item disabled">Biblioteca Riojana <small>Próximamente</small></span>
          <span class="nav-item disabled">Editor Crítico <small>Próximamente</small></span>
          <span class="nav-item disabled">Transcripción <small>Próximamente</small></span>
          <span class="nav-item disabled">Observatorios <small>Próximamente</small></span>
          <span class="nav-item disabled">Distribución <small>Próximamente</small></span>
        </nav>
        <div class="sidebar-bottom">
          <span class="muted small">${esc(user.email)}</span>
          <button class="button ghost full" id="sign-out">Cerrar sesión</button>
        </div>
      </aside>
      <main class="main-content">
        <header class="topbar">
          <div><p class="eyebrow">NÚCLEO EDITORIAL</p><h1>Madre Editorial</h1></div>
          <span class="status-pill">Entorno conectado</span>
        </header>
        <section class="intro-row">
          <div><h2>Unidades editoriales</h2><p class="muted">Cada investigación comienza con una unidad común, sus fuentes y sus evidencias.</p></div>
          <button class="button primary" id="new-unit">＋ Nueva unidad</button>
        </section>
        <div id="notice" class="notice" role="status" aria-live="polite"></div>
        <section id="unit-list" class="unit-list" aria-live="polite"><div class="loading">Cargando unidades…</div></section>
      </main>
    </div>
    <dialog id="unit-dialog" class="dialog">
      <form id="unit-form" method="dialog" class="stack">
        <div class="dialog-head"><div><p class="eyebrow">NUEVO CONTENIDO</p><h2>Crear unidad editorial</h2></div><button type="button" class="icon-button" id="close-dialog" aria-label="Cerrar">×</button></div>
        <label for="unit-title">Título de trabajo</label>
        <input id="unit-title" name="title" required maxlength="180" placeholder="¿Qué hecho o tema vamos a investigar?" />
        <label for="unit-summary">Resumen inicial <span class="muted">(opcional)</span></label>
        <textarea id="unit-summary" name="summary" rows="4" placeholder="Contexto breve, origen de la información o pregunta central"></textarea>
        <div class="dialog-actions"><button type="button" class="button ghost" id="cancel-dialog">Cancelar</button><button class="button primary" type="submit">Crear unidad</button></div>
      </form>
    </dialog>
    <dialog id="detail-dialog" class="dialog wide">
      <form id="detail-form" method="dialog" class="stack">
        <div class="dialog-head"><div><p class="eyebrow">UNIDAD EDITORIAL MADRE</p><h2 id="detail-heading">Editar unidad</h2></div><button type="button" class="icon-button" id="close-detail" aria-label="Cerrar">×</button></div>
        <input type="hidden" name="id" />
        <label for="detail-title">Título</label><input id="detail-title" name="title" required maxlength="180" />
        <label for="detail-summary">Resumen</label><textarea id="detail-summary" name="summary" rows="3"></textarea>
        <label for="detail-content">Contenido madre</label><textarea id="detail-content" name="content_mother" rows="10" placeholder="Desarrollá aquí el núcleo de información y contexto. La verificación y la trazabilidad se incorporarán en los siguientes incrementos."></textarea>
        <label for="detail-status">Estado editorial</label>
        <input id="detail-status" value="Borrador" readonly aria-readonly="true" />
        <p class="muted small">La revisión se habilitará cuando estén implementados el registro de fuentes, evidencias y el control editorial. Esta versión solo guarda borradores.</p>
        <div class="dialog-actions"><button type="button" class="button ghost" id="cancel-detail">Cerrar</button><button class="button primary" type="submit">Guardar cambios</button></div>
      </form>
    </dialog>`

  root.querySelector('#sign-out').addEventListener('click', onSignOut)
  const createDialog = root.querySelector('#unit-dialog')
  const detailDialog = root.querySelector('#detail-dialog')
  const notice = root.querySelector('#notice')

  root.querySelector('#new-unit').addEventListener('click', () => createDialog.showModal())
  root.querySelector('#close-dialog').addEventListener('click', () => createDialog.close())
  root.querySelector('#cancel-dialog').addEventListener('click', () => createDialog.close())
  root.querySelector('#close-detail').addEventListener('click', () => detailDialog.close())
  root.querySelector('#cancel-detail').addEventListener('click', () => detailDialog.close())

  root.querySelector('#unit-form').addEventListener('submit', async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const button = event.currentTarget.querySelector('[type="submit"]')
    button.disabled = true
    try {
      await EditorialService.create({ title: form.get('title'), summary: form.get('summary') })
      createDialog.close()
      event.currentTarget.reset()
      notice.textContent = 'Unidad editorial creada.'
      await loadUnits()
    } catch (error) {
      notice.textContent = error.message
    } finally { button.disabled = false }
  })

  root.querySelector('#detail-form').addEventListener('submit', async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const button = event.currentTarget.querySelector('[type="submit"]')
    button.disabled = true
    try {
      await EditorialService.update(form.get('id'), {
        title: form.get('title'),
        summary: form.get('summary'),
        content_mother: form.get('content_mother'),
        status: 'draft'
      })
      detailDialog.close()
      notice.textContent = 'Cambios guardados.'
      await loadUnits()
    } catch (error) {
      notice.textContent = error.message
    } finally { button.disabled = false }
  })

  async function openUnit(id) {
    try {
      const unit = await EditorialService.get(id)
      const form = root.querySelector('#detail-form')
      form.elements.id.value = unit.id
      form.elements.title.value = unit.title ?? ''
      form.elements.summary.value = unit.summary ?? ''
      form.elements.content_mother.value = unit.content_mother ?? ''
      root.querySelector('#detail-status').value = 'Borrador'
      root.querySelector('#detail-heading').textContent = unit.title
      detailDialog.showModal()
    } catch (error) { notice.textContent = error.message }
  }

  async function loadUnits() {
    const list = root.querySelector('#unit-list')
    list.innerHTML = '<div class="loading">Cargando unidades…</div>'
    try {
      const units = await EditorialService.list()
      if (!units.length) {
        list.innerHTML = '<div class="empty-state"><span class="empty-mark">＋</span><h3>La primera unidad empieza acá</h3><p>Creá una unidad editorial para organizar el tema, las fuentes y el trabajo periodístico.</p><button class="button primary" id="empty-create">Crear primera unidad</button></div>'
        list.querySelector('#empty-create').addEventListener('click', () => createDialog.showModal())
        return
      }
      list.innerHTML = units.map((unit) => `
        <button class="unit-card" data-id="${esc(unit.id)}">
          <span class="unit-card-top"><span class="state state-${esc(unit.status)}">${unit.status === 'draft' ? 'Borrador' : unit.status === 'reviewed' ? 'Revisado' : 'Publicado'}</span><time>${date(unit.updated_at)}</time></span>
          <strong>${esc(unit.title)}</strong>
          <span class="unit-summary">${esc(unit.summary || 'Sin resumen inicial.')}</span>
          <span class="unit-open">Abrir unidad →</span>
        </button>`).join('')
      list.querySelectorAll('[data-id]').forEach((button) => button.addEventListener('click', () => openUnit(button.dataset.id)))
    } catch (error) {
      list.innerHTML = `<div class="empty-state"><h3>No se pudieron cargar las unidades</h3><p>${esc(error.message)}</p><button class="button ghost" id="retry">Reintentar</button></div>`
      list.querySelector('#retry').addEventListener('click', loadUnits)
    }
  }
  await loadUnits()
}
