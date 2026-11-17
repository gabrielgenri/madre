import { EditorialService } from '../../shared/services/editorial.service.js'

const esc = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c])

const date = (value) => new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'medium', timeStyle: 'short'
}).format(new Date(value))

const verificationLabel = {
  pending: 'Pendiente', verified: 'Verificada', attributed: 'Atribuida',
  unverified: 'No verificada', contradictory: 'Contradictoria', missing_source: 'Sin fuente'
}

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
        <div class="sidebar-bottom"><span class="muted small">${esc(user.email)}</span><button class="button ghost full" id="sign-out">Cerrar sesión</button></div>
      </aside>
      <main class="main-content">
        <header class="topbar"><div><p class="eyebrow">NÚCLEO EDITORIAL</p><h1>Madre Editorial</h1></div><span class="status-pill">Entorno conectado</span></header>
        <section class="intro-row"><div><h2>Unidades editoriales</h2><p class="muted">Cada investigación comienza con una unidad común, sus fuentes y sus evidencias.</p></div><button class="button primary" id="new-unit">＋ Nueva unidad</button></section>
        <div id="notice" class="notice" role="status" aria-live="polite"></div>
        <section id="unit-list" class="unit-list" aria-live="polite"><div class="loading">Cargando unidades…</div></section>
      </main>
    </div>
    <dialog id="unit-dialog" class="dialog"><form id="unit-form" method="dialog" class="stack">
      <div class="dialog-head"><div><p class="eyebrow">NUEVO CONTENIDO</p><h2>Crear unidad editorial</h2></div><button type="button" class="icon-button" id="close-dialog" aria-label="Cerrar">×</button></div>
      <label for="unit-title">Título de trabajo</label><input id="unit-title" name="title" required maxlength="180" placeholder="¿Qué hecho o tema vamos a investigar?" />
      <label for="unit-summary">Resumen inicial <span class="muted">(opcional)</span></label><textarea id="unit-summary" name="summary" rows="4" placeholder="Contexto breve, origen de la información o pregunta central"></textarea>
      <div class="dialog-actions"><button type="button" class="button ghost" id="cancel-dialog">Cancelar</button><button class="button primary" type="submit">Crear unidad</button></div>
    </form></dialog>
    <dialog id="detail-dialog" class="dialog wide"><form id="detail-form" method="dialog" class="stack">
      <div class="dialog-head"><div><p class="eyebrow">UNIDAD EDITORIAL MADRE</p><h2 id="detail-heading">Editar unidad</h2></div><button type="button" class="icon-button" id="close-detail" aria-label="Cerrar">×</button></div>
      <input type="hidden" name="id" />
      <label for="detail-title">Título</label><input id="detail-title" name="title" required maxlength="180" />
      <label for="detail-summary">Resumen</label><textarea id="detail-summary" name="summary" rows="3"></textarea>
      <label for="detail-content">Contenido madre</label><textarea id="detail-content" name="content_mother" rows="8" placeholder="Desarrollá aquí el núcleo de información y contexto."></textarea>
      <label for="detail-status">Estado editorial</label><input id="detail-status" value="Borrador" readonly aria-readonly="true" />
      <p class="muted small">La revisión formal permanece bloqueada hasta completar el control editorial humano.</p>
      <div class="dialog-actions"><button type="button" class="button ghost" id="open-research">Fuentes y verificación</button><button type="button" class="button ghost" id="cancel-detail">Cerrar</button><button class="button primary" type="submit">Guardar cambios</button></div>
    </form></dialog>
    <dialog id="research-dialog" class="dialog wide"><div class="stack">
      <div class="dialog-head"><div><p class="eyebrow">TRAZABILIDAD PERIODÍSTICA</p><h2 id="research-heading">Investigación</h2></div><button type="button" class="icon-button" id="close-research" aria-label="Cerrar">×</button></div>
      <div class="research-grid">
        <section class="research-panel"><h3>Registrar fuente</h3><form id="source-form" class="stack compact">
          <label>Título / identificación</label><input name="title" required maxlength="240" placeholder="Documento, entrevista, informe…" />
          <label>Tipo de fuente</label><select name="source_type"><option value="document">Documento</option><option value="interview">Entrevista</option><option value="official">Organismo oficial</option><option value="media">Medio de comunicación</option><option value="dataset">Base de datos</option><option value="other" selected>Otra</option></select>
          <label>URL</label><input name="source_url" type="url" placeholder="https://" />
          <label>Autor / organismo</label><input name="author" />
          <label>Editor / publicación</label><input name="publisher" />
          <label>Extracto original</label><textarea name="original_text" rows="3"></textarea>
          <label>Notas de contexto</label><textarea name="notes" rows="2"></textarea>
          <button class="button primary" type="submit">Guardar fuente</button>
        </form><div id="source-list" class="record-list"></div></section>
        <section class="research-panel"><h3>Registrar afirmación</h3><form id="claim-form" class="stack compact">
          <label>Afirmación concreta</label><textarea name="claim_text" rows="3" required placeholder="Una afirmación verificable por cada registro"></textarea>
          <label>Tipo</label><select name="claim_type"><option value="fact">Hecho</option><option value="quote">Cita</option><option value="data">Dato</option><option value="opinion">Opinión</option><option value="interpretation">Interpretación</option><option value="hypothesis">Hipótesis</option></select>
          <label>Importancia</label><select name="importance"><option value="normal">Normal</option><option value="low">Baja</option><option value="high">Alta</option><option value="critical">Crítica</option></select>
          <label>Contexto / precisión</label><textarea name="context_note" rows="2"></textarea>
          <button class="button primary" type="submit">Guardar afirmación</button>
        </form><div id="claim-list" class="record-list"></div></section>
        <section class="research-panel"><h3>Vincular evidencia</h3><form id="evidence-form" class="stack compact">
          <label>Afirmación relacionada</label><select name="claim_id" id="evidence-claim"><option value="">Evidencia general</option></select>
          <label>Fuente relacionada</label><select name="source_id" id="evidence-source"><option value="">Sin fuente vinculada</option></select>
          <label>Extracto / evidencia</label><textarea name="evidence_text" rows="3" required></textarea>
          <label>Localizador (página, minuto, párrafo)</label><input name="locator" placeholder="Pág. 4 / 00:12:30 / párrafo 8" />
          <label>Relación</label><select name="relation"><option value="supports">Apoya</option><option value="contradicts">Contradice</option><option value="contextualizes">Contextualiza</option></select>
          <button class="button primary" type="submit">Guardar evidencia</button>
        </form><div id="evidence-list" class="record-list"></div></section>
      </div>
      <section class="research-panel"><h3>Verificación humana</h3><p class="muted small">Solo perfiles con rol revisor, editor o administrador pueden registrar una verificación. La base de datos valida el permiso.</p><div id="verification-list" class="record-list"></div></section>
      <div class="dialog-actions"><button type="button" class="button ghost" id="research-done">Volver a la unidad</button></div>
    </div></dialog>`

  root.querySelector('#sign-out').addEventListener('click', onSignOut)
  const createDialog = root.querySelector('#unit-dialog')
  const detailDialog = root.querySelector('#detail-dialog')
  const researchDialog = root.querySelector('#research-dialog')
  const notice = root.querySelector('#notice')
  let activeUnitId = null
  let bundle = { sources: [], claims: [], evidences: [], verifications: [] }

  root.querySelector('#new-unit').addEventListener('click', () => createDialog.showModal())
  root.querySelector('#close-dialog').addEventListener('click', () => createDialog.close())
  root.querySelector('#cancel-dialog').addEventListener('click', () => createDialog.close())
  root.querySelector('#close-detail').addEventListener('click', () => detailDialog.close())
  root.querySelector('#cancel-detail').addEventListener('click', () => detailDialog.close())
  root.querySelector('#close-research').addEventListener('click', () => researchDialog.close())
  root.querySelector('#research-done').addEventListener('click', () => researchDialog.close())
  root.querySelector('#open-research').addEventListener('click', async () => {
    activeUnitId = root.querySelector('#detail-form').elements.id.value
    await loadResearch()
    detailDialog.close()
    researchDialog.showModal()
  })

  root.querySelector('#unit-form').addEventListener('submit', async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const button = event.currentTarget.querySelector('[type="submit"]')
    button.disabled = true
    try {
      await EditorialService.create({ title: form.get('title'), summary: form.get('summary') })
      createDialog.close(); event.currentTarget.reset()
      notice.textContent = 'Unidad editorial creada.'
      await loadUnits()
    } catch (error) { notice.textContent = error.message }
    finally { button.disabled = false }
  })

  root.querySelector('#detail-form').addEventListener('submit', async (event) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const button = event.currentTarget.querySelector('[type="submit"]')
    button.disabled = true
    try {
      await EditorialService.update(form.get('id'), { title: form.get('title'), summary: form.get('summary'), content_mother: form.get('content_mother') })
      notice.textContent = 'Cambios guardados.'
      detailDialog.close(); await loadUnits()
    } catch (error) { notice.textContent = error.message }
    finally { button.disabled = false }
  })

  async function submitResearch(formId, method, valuesMap) {
    const form = root.querySelector(formId)
    form.addEventListener('submit', async (event) => {
      event.preventDefault()
      const button = form.querySelector('[type="submit"]')
      button.disabled = true
      try {
        const data = new FormData(form)
        const values = Object.fromEntries([...data.entries()].map(([key, value]) => [key, String(value)]))
        await EditorialService[method](activeUnitId, values)
        form.reset()
        notice.textContent = 'Registro de investigación guardado.'
        await loadResearch()
      } catch (error) { notice.textContent = error.message }
      finally { button.disabled = false }
    })
  }
  submitResearch('#source-form', 'addSource')
  submitResearch('#claim-form', 'addClaim')
  submitResearch('#evidence-form', 'addEvidence')

  async function loadResearch() {
    try {
      bundle = await EditorialService.researchBundle(activeUnitId)
      root.querySelector('#source-list').innerHTML = bundle.sources.map(item => `<article class="record-item"><strong>${esc(item.title)}</strong><span>${esc(item.publisher || item.author || item.source_type)}</span>${item.source_url ? `<a href="${esc(item.source_url)}" target="_blank" rel="noopener noreferrer">Abrir fuente ↗</a>` : ''}</article>`).join('') || '<p class="muted small">Todavía no hay fuentes.</p>'
      root.querySelector('#claim-list').innerHTML = bundle.claims.map(item => `<article class="record-item"><strong>${esc(item.claim_text)}</strong><span>${esc(item.claim_type)} · ${esc(verificationLabel[item.verification_status] || item.verification_status)}</span></article>`).join('') || '<p class="muted small">Todavía no hay afirmaciones.</p>'
      root.querySelector('#evidence-list').innerHTML = bundle.evidences.map(item => `<article class="record-item"><strong>${esc(item.evidence_text)}</strong><span>${esc(item.relation)} · ${esc(item.locator || 'Sin localizador')}</span></article>`).join('') || '<p class="muted small">Todavía no hay evidencias.</p>'
      root.querySelector('#evidence-claim').innerHTML = '<option value="">Evidencia general</option>' + bundle.claims.map(item => `<option value="${esc(item.id)}">${esc(item.claim_text.slice(0, 100))}</option>`).join('')
      root.querySelector('#evidence-source').innerHTML = '<option value="">Sin fuente vinculada</option>' + bundle.sources.map(item => `<option value="${esc(item.id)}">${esc(item.title)}</option>`).join('')
      root.querySelector('#verification-list').innerHTML = bundle.claims.map(claim => {
        const last = bundle.verifications.find(item => item.claim_id === claim.id)
        return `<article class="record-item"><strong>${esc(claim.claim_text)}</strong><span>Estado: ${esc(verificationLabel[(bundle.verifications.find(item => item.claim_id === claim.id)?.status) || claim.verification_status] || claim.verification_status)}</span><form class="verify-form compact" data-claim-id="${esc(claim.id)}"><select name="status" aria-label="Resultado de verificación"><option value="verified">Verificada</option><option value="attributed">Atribuida</option><option value="unverified">No verificada</option><option value="contradictory">Contradictoria</option><option value="missing_source">Sin fuente</option></select><input name="rationale" placeholder="Fundamento de la revisión" /><button class="button ghost" type="submit">Registrar revisión humana</button></form>${last ? `<span>Última revisión: ${esc(verificationLabel[last.status] || last.status)} · ${date(last.checked_at)}</span>` : ''}</article>`
      }).join('') || '<p class="muted small">Agregá afirmaciones para iniciar la verificación.</p>'
      root.querySelectorAll('.verify-form').forEach(form => form.addEventListener('submit', async event => {
        event.preventDefault()
        const button = form.querySelector('button')
        button.disabled = true
        try {
          const values = Object.fromEntries(new FormData(form).entries())
          await EditorialService.addVerification(form.dataset.claimId, values)
          notice.textContent = 'Verificación humana registrada.'
          await loadResearch()
        } catch (error) { notice.textContent = error.message }
        finally { button.disabled = false }
      }))
    } catch (error) {
      notice.textContent = `No se pudo cargar la investigación: ${error.message}`
    }
  }

  async function openUnit(id) {
    try {
      const unit = await EditorialService.get(id)
      const form = root.querySelector('#detail-form')
      form.elements.id.value = unit.id
      form.elements.title.value = unit.title ?? ''
      form.elements.summary.value = unit.summary ?? ''
      form.elements.content_mother.value = unit.content_mother ?? ''
      root.querySelector('#detail-status').value = unit.status === 'published' ? 'Publicado' : unit.status === 'reviewed' ? 'Revisado' : 'Borrador'
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
      list.innerHTML = units.map(unit => `<button class="unit-card" data-id="${esc(unit.id)}"><span class="unit-card-top"><span class="state state-${esc(unit.status)}">${unit.status === 'draft' ? 'Borrador' : unit.status === 'reviewed' ? 'Revisado' : 'Publicado'}</span><time>${date(unit.updated_at)}</time></span><strong>${esc(unit.title)}</strong><span class="unit-summary">${esc(unit.summary || 'Sin resumen inicial.')}</span><span class="unit-open">Abrir unidad →</span></button>`).join('')
      list.querySelectorAll('[data-id]').forEach(button => button.addEventListener('click', () => openUnit(button.dataset.id)))
    } catch (error) {
      list.innerHTML = `<div class="empty-state"><h3>No se pudieron cargar las unidades</h3><p>${esc(error.message)}</p><button class="button ghost" id="retry">Reintentar</button></div>`
      list.querySelector('#retry').addEventListener('click', loadUnits)
    }
  }
  await loadUnits()
}
