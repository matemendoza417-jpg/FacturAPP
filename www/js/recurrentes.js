// ============================================================
//  recurrentes.js — Facturas recurrentes
//  Permite crear plantillas de facturas que se generan
//  automáticamente cada mes/bimestre/trimestre/etc.
// ============================================================

const REC_DB_KEY = 'facturapp_recurrentes';
let _recLongPressTimer = null;
let _recLongPressTriggered = false;

function getRecurrentes() {
  try {
    const raw = localStorage.getItem(REC_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (_) {}
  return [];
}

function saveRecurrentes(lista) {
  localStorage.setItem(REC_DB_KEY, JSON.stringify(Array.isArray(lista) ? lista : []));
  if (typeof _cloudSync === 'function' && typeof sbIsConfigured === 'function' && sbIsConfigured()) {
    (Array.isArray(lista) ? lista : []).forEach(item => {
      const plain = { ...item };
      delete plain.productos;
      delete plain.materiales;
      _cloudSync('recurrentes', plain);
    });
  }
}

function _diasFrecuencia(frecuencia) {
  switch (frecuencia) {
    case 'mensual':     return 30;
    case 'bimestral':   return 60;
    case 'trimestral':  return 90;
    case 'semestral':   return 180;
    case 'anual':       return 365;
    default:            return 30;
  }
}

function _sumaFrecuencia(fechaStr, frecuencia) {
  const d = new Date(fechaStr);
  d.setDate(d.getDate() + _diasFrecuencia(frecuencia));
  return d.toISOString().split('T')[0];
}

function _formatFechaCorta(fechaStr) {
  if (!fechaStr) return '—';
  const [y, m, d] = fechaStr.split('-');
  return `${d}/${m}/${y}`;
}

// ── Render listado ─────────────────────────────────────────
function renderRecurrentes() {
  const list = document.getElementById('recurrentes-list');
  const empty = document.getElementById('recurrentes-empty');
  const stats = document.getElementById('recurrentes-stats');
  if (!list) return;

  const recs = getRecurrentes();
  list.innerHTML = '';

  if (stats) {
    const activas = recs.filter(r => r.activa).length;
    stats.innerHTML = `
      <div class="hist-stat"><div class="val">${recs.length}</div><div class="lbl">Plantillas</div></div>
      <div class="hist-stat"><div class="val">${activas}</div><div class="lbl">Activas</div></div>
    `;
  }

  if (!recs.length) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  recs.forEach((r, index) => {
    const card = document.createElement('div');
    card.className = 'emitida-card rec-card';
    card.style.animationDelay = `${index * 40}ms`;

    const estadoBadge = r.activa
      ? '<span class="orden-estado completada">✓ Activa</span>'
      : '<span class="orden-estado pendiente">⏸ Pausada</span>';

    const totalEstimado = (r.productos || []).reduce((a, p) => a + (Number(p.subtotal_linea) || 0), 0);

    card.innerHTML = `
      <div class="emitida-card-top">
        <div class="emitida-info">
          <span class="emitida-num">${escapeHtml(r.nombre || 'Sin nombre')}</span>
          <span class="emitida-fecha">${escapeHtml(r.frecuencia || 'mensual')}</span>
        </div>
        ${estadoBadge}
      </div>
      <div class="emitida-card-sub">
        <span>👤 ${escapeHtml(r.cliente?.nombre || '—')}</span>
        <span>🏢 ${escapeHtml(r.emisor?.nombre || '—')}</span>
      </div>
      <div class="emitida-card-sub" style="margin-top:4px">
        <span>📅 Próxima: ${_formatFechaCorta(r.proximaGeneracion)}</span>
        <span>💰 ~${totalEstimado.toFixed(2)} €</span>
      </div>
      <div class="emitida-hold-hint">Mantén pulsado para ver opciones</div>
    `;

    card.onpointerdown = ev => _startRecLongPress(ev, r.id);
    card.onpointerup = _cancelRecLongPress;
    card.onpointerleave = _cancelRecLongPress;
    card.onpointercancel = _cancelRecLongPress;
    card.oncontextmenu = ev => { ev.preventDefault(); showRecContextMenu(r.id); };
    card.onclick = () => {
      if (_recLongPressTriggered) { _recLongPressTriggered = false; return; }
      showToast('Mantén pulsado para ver las opciones');
    };
    list.appendChild(card);
  });
}

function _startRecLongPress(ev, id) {
  _cancelRecLongPress();
  _recLongPressTriggered = false;
  ev.currentTarget.classList.add('long-pressing');
  _recLongPressTimer = setTimeout(() => {
    _recLongPressTriggered = true;
    ev.currentTarget.classList.remove('long-pressing');
    showRecContextMenu(id);
  }, 520);
}

function _cancelRecLongPress(ev) {
  if (_recLongPressTimer) clearTimeout(_recLongPressTimer);
  _recLongPressTimer = null;
  if (ev?.currentTarget) ev.currentTarget.classList.remove('long-pressing');
}

function showRecContextMenu(id) {
  const rec = getRecurrentes().find(r => r.id === id);
  if (!rec) return;
  const encoded = encodeURIComponent(id);
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div class="action-sheet" onclick="event.stopPropagation()">
      <div class="sheet-handle"></div>
      <div class="sheet-title">Factura Recurrente</div>
      <div class="sheet-subtitle">${escapeHtml(rec.nombre)}</div>
      <div class="sheet-actions">
        <button class="sheet-action" onclick="closeModal();editarRecurrente('${encoded}')">✏️ Editar plantilla</button>
        <button class="sheet-action" onclick="closeModal();generarRecurrenteAhora('${encoded}')">⚡ Generar ahora</button>
        <button class="sheet-action" onclick="closeModal();toggleRecurrenteActiva('${encoded}')">
          ${rec.activa ? '⏸ Pausar' : '▶️ Activar'}
        </button>
        <button class="sheet-action danger" onclick="closeModal();eliminarRecurrente('${encoded}')">🗑️ Eliminar</button>
      </div>
      <button class="sheet-cancel" onclick="closeModal()">Cancelar</button>
    </div>
  `;
  overlay.classList.remove('hidden');
  overlay.onclick = closeModal;
}

// ── Render functions para formulario recurrente (IDs propios) ──
function _recRenderEmisorList() {
  const container = document.getElementById('rec-emisores-list');
  if (!container) return;
  const emisores = getEmisores();
  container.innerHTML = '';

  emisores.forEach(em => {
    const div = document.createElement('div');
    div.className = 'select-card' + (state.emisor?.nombre === em.nombre ? ' selected' : '');
    div.setAttribute('role', 'button');
    div.innerHTML = `
      <div class="select-card-body">
        <strong>${escapeHtml(em.nombre)}</strong>
        <small>${escapeHtml(em.cp_ciudad)} · ${escapeHtml(em.doi)}</small>
      </div>
      ${em._predefined ? '<span class="select-card-badge">Predefinido</span>' : ''}
      <div class="select-check" aria-hidden="true"></div>
    `;
    div.onclick = () => { state.emisor = em; _recRenderEmisorList(); Sound.select(); };
    container.appendChild(div);
  });
}

function _recRenderClienteList() {
  const container = document.getElementById('rec-clientes-list');
  if (!container) return;
  const clientes = getClientes();
  container.innerHTML = '';

  clientes.forEach(cl => {
    const div = document.createElement('div');
    div.className = 'select-card' + (state.cliente?.nombre === cl.nombre ? ' selected' : '');
    div.setAttribute('role', 'button');
    div.innerHTML = `
      <div class="select-card-body">
        <strong>${escapeHtml(cl.nombre)}</strong>
        <small>${escapeHtml(cl.direccion || '')} · ${escapeHtml(cl.doi || cl.email || '')}</small>
      </div>
      <div class="select-check" aria-hidden="true"></div>
    `;
    div.onclick = () => { state.cliente = cl; _recRenderClienteList(); Sound.select(); };
    container.appendChild(div);
  });
}

function _recRenderProductosList() {
  const container = document.getElementById('rec-productos-list');
  if (!container) return;
  container.innerHTML = '';
  state.productos.forEach((p, i) => container.appendChild(_recMakeItemCard(p, i, 'producto')));
}

function _recRenderMaterialesList() {
  const container = document.getElementById('rec-materiales-list');
  if (!container) return;
  container.innerHTML = '';
  state.materiales.forEach((m, i) => container.appendChild(_recMakeItemCard(m, i, 'material')));
}

function _recMakeItemCard(item, idx, tipo) {
  const div = document.createElement('div');
  div.className = 'item-card';
  var c = Number(item.cantidad) || 0;
  const cant = Number.isInteger(c) ? String(c) : c.toFixed(2);
  div.innerHTML = `
    <div class="item-card-body">
      <div class="item-desc">${escapeHtml(item.descripcion)}</div>
      <div class="item-meta">${cant} × ${item.precio_unitario.toFixed(2)} €</div>
    </div>
    <div class="item-card-total">${item.subtotal_linea.toFixed(2)} €</div>
    <button class="btn-delete" onclick="recDeleteItem('${tipo}',${idx})" aria-label="Eliminar">✕</button>
  `;
  return div;
}

function recDeleteItem(tipo, idx) {
  if (tipo === 'producto') state.productos.splice(idx, 1);
  else state.materiales.splice(idx, 1);
  _recRenderProductosList();
  _recRenderMaterialesList();
}

function addProductoRec() { _recShowItemDialog('producto'); }
function addMaterialRec() { _recShowItemDialog('material'); }

function _recShowItemDialog(tipo) {
  const listId = tipo === 'producto' ? 'rec-productos-list' : 'rec-materiales-list';
  const existing = document.getElementById(`rec-add-form-${tipo}`);
  if (existing) { existing.remove(); return; }

  const form = document.createElement('div');
  form.className = 'add-item-form';
  form.id = `rec-add-form-${tipo}`;
  form.innerHTML = `
    <div class="form-row">
      <label>Descripción</label>
      <input type="text" id="rec-inp-desc-${tipo}" placeholder="${tipo === 'producto' ? 'Servicio o trabajo realizado' : 'Material utilizado'}">
    </div>
    <div class="add-item-row">
      <div class="form-row">
        <label>Cantidad</label>
        <input type="number" id="rec-inp-cant-${tipo}" value="1" min="0.001" step="0.5">
      </div>
      <div class="form-row">
        <label>Precio unit. (€)</label>
        <input type="number" id="rec-inp-prec-${tipo}" value="0" min="0" step="0.01">
      </div>
    </div>
    <div class="row-btns">
      <button class="btn-secondary" onclick="document.getElementById('rec-add-form-${tipo}').remove()">Cancelar</button>
      <button class="btn-primary" onclick="_recConfirmAddItem('${tipo}')">Agregar</button>
    </div>
  `;

  const list = document.getElementById(listId);
  if (!list || !list.parentNode) return;
  list.parentNode.insertBefore(form, list.nextSibling);
  document.getElementById(`rec-inp-desc-${tipo}`).focus();
}

function _recConfirmAddItem(tipo) {
  const desc = document.getElementById(`rec-inp-desc-${tipo}`).value.trim();
  const cant = parseFloat(document.getElementById(`rec-inp-cant-${tipo}`).value);
  const prec = parseFloat(document.getElementById(`rec-inp-prec-${tipo}`).value);

  if (!desc)                    { showToast('La descripción es obligatoria'); return; }
  if (isNaN(cant) || cant <= 0) { showToast('Cantidad inválida');             return; }
  if (isNaN(prec) || prec < 0)  { showToast('Precio inválido');               return; }

  const item = {
    descripcion:     desc,
    cantidad:        cant,
    precio_unitario: prec,
    subtotal_linea:  Math.round(cant * prec * 100) / 100,
  };

  if (tipo === 'producto') state.productos.push(item);
  else                     state.materiales.push(item);

  document.getElementById(`rec-add-form-${tipo}`).remove();
  _recRenderProductosList();
  _recRenderMaterialesList();
  Sound.save();
}

// ── CRUD ──────────────────────────────────────────────────
function nuevaRecurrente() {
  state._recEditando = null;
  _resetFormRecurrente();
  Sound.click();
  navigate('screen-rec-nueva');
  document.getElementById('rec-form-title').textContent = 'Nueva Plantilla Recurrente';
}

function editarRecurrente(id) {
  const rec = getRecurrentes().find(r => r.id === id);
  if (!rec) return;
  state._recEditando = id;

  document.getElementById('rec-nombre').value = rec.nombre || '';
  document.getElementById('rec-frecuencia').value = rec.frecuencia || 'mensual';
  document.getElementById('rec-fecha-inicio').value = rec.fechaInicio || '';
  document.getElementById('rec-fecha-fin').value = rec.fechaFin || '';
  document.getElementById('rec-serie').value = rec.serie || '';
  document.getElementById('rec-notas').value = rec.notas || '';

  state.emisor = rec.emisor || null;
  state.cliente = rec.cliente || null;
  state.productos = JSON.parse(JSON.stringify(rec.productos || []));
  state.materiales = JSON.parse(JSON.stringify(rec.materiales || []));

  document.getElementById('rec-form-title').textContent = 'Editar Plantilla Recurrente';
  navigate('screen-rec-nueva');

  _recRenderEmisorList();
  _recRenderClienteList();
  _recRenderProductosList();
  _recRenderMaterialesList();
}

function _resetFormRecurrente() {
  document.getElementById('rec-nombre').value = '';
  document.getElementById('rec-frecuencia').value = 'mensual';
  document.getElementById('rec-fecha-inicio').value = new Date().toISOString().split('T')[0];
  document.getElementById('rec-fecha-fin').value = '';
  document.getElementById('rec-serie').value = '';
  document.getElementById('rec-notas').value = '';
  state.emisor = null;
  state.cliente = null;
  state.productos = [];
  state.materiales = [];
  _recRenderEmisorList();
  _recRenderClienteList();
  _recRenderProductosList();
  _recRenderMaterialesList();
}

function guardarRecurrente() {
  const nombre = document.getElementById('rec-nombre').value.trim();
  const frecuencia = document.getElementById('rec-frecuencia').value;
  const fechaInicio = document.getElementById('rec-fecha-inicio').value;
  const fechaFin = document.getElementById('rec-fecha-fin').value || null;
  const serie = document.getElementById('rec-serie').value.trim();
  const notas = document.getElementById('rec-notas').value.trim();

  if (!nombre) { showToast('Ponle un nombre a la plantilla'); Sound.error(); return; }
  if (!state.emisor) { showToast('Seleccioná un emisor'); Sound.error(); return; }
  if (!state.cliente) { showToast('Seleccioná un cliente'); Sound.error(); return; }
  if (state.productos.length === 0) { showToast('Agregá al menos un producto'); Sound.error(); return; }

  const id = state._recEditando || `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const rec = {
    id,
    nombre,
    frecuencia,
    fechaInicio: fechaInicio || new Date().toISOString().split('T')[0],
    fechaFin,
    serie,
    notas,
    emisor: { ...state.emisor },
    cliente: { ...state.cliente },
    productos: JSON.parse(JSON.stringify(state.productos)),
    materiales: JSON.parse(JSON.stringify(state.materiales)),
    iva: '21',
    retencion: { rate: 19, enabled: false, showInPdf: false, applyToTotal: false },
    activa: true,
    ultimaGeneracion: null,
    proximaGeneracion: fechaInicio || new Date().toISOString().split('T')[0],
    creado: new Date().toISOString(),
  };

  const recs = getRecurrentes();
  const idx = recs.findIndex(r => r.id === id);
  if (idx >= 0) recs[idx] = rec;
  else recs.push(rec);
  saveRecurrentes(recs);

  showToast(state._recEditando ? 'Plantilla actualizada' : 'Plantilla creada');
  state._recEditando = null;
  goBack();
  Sound.save();
}

function toggleRecurrenteActiva(id) {
  const recs = getRecurrentes();
  const idx = recs.findIndex(r => r.id === id);
  if (idx < 0) return;
  recs[idx].activa = !recs[idx].activa;
  saveRecurrentes(recs);
  renderRecurrentes();
  showToast(recs[idx].activa ? 'Plantilla activada' : 'Plantilla pausada');
  Sound.tap();
}

function eliminarRecurrente(id) {
  Sound.tap();
  showConfirmDialog('🗑️', 'Eliminar plantilla', '¿Eliminar esta plantilla recurrente?', () => {
    Sound.delete();
    const recs = getRecurrentes().filter(r => r.id !== id);
    saveRecurrentes(recs);
    renderRecurrentes();
    showToast('Plantilla eliminada');
  }, null);
}

async function generarRecurrenteAhora(id) {
  const rec = getRecurrentes().find(r => r.id === id);
  if (!rec) return;

  showToast('Generando factura desde plantilla…');

  state.docType = 'factura';
  state.emisor = { ...rec.emisor };
  state.cliente = { ...rec.cliente };
  state.productos = JSON.parse(JSON.stringify(rec.productos || []));
  state.materiales = JSON.parse(JSON.stringify(rec.materiales || []));
  state._editando = null;
  state._editandoPresupuesto = null;
  state._skipResetNueva = false;

  navigate('screen-nueva');

  setTimeout(() => {
    const numEl = document.getElementById('fac-num');
    const fechaEl = document.getElementById('fac-fecha');
    const ivaEl = document.getElementById('fac-iva');
    if (numEl) numEl.value = typeof sugerirNumeroFactura === 'function' ? sugerirNumeroFactura() : '';
    if (fechaEl) fechaEl.value = new Date().toISOString().split('T')[0];
    if (ivaEl) ivaEl.value = rec.iva || '21';
    if (rec.retencion?.enabled) {
      const chkRet = document.getElementById('chk-retencion');
      const facRet = document.getElementById('fac-ret');
      if (chkRet) chkRet.checked = true;
      if (facRet) facRet.value = String(rec.retencion.rate || 19);
      if (typeof toggleRetencion === 'function') toggleRetencion();
    }
    renderEmisorList();
    renderClienteList();
    renderProductosList();
    renderMaterialesList();
    goToStep(1);
  }, 200);
}

// ── Auto-generación al abrir la app ──────────────────────
function autoGenerarRecurrentes() {
  const recs = getRecurrentes();
  const hoy = new Date().toISOString().split('T')[0];
  let generadas = 0;

  recs.forEach(rec => {
    if (!rec.activa) return;
    if (!rec.proximaGeneracion) return;
    if (rec.fechaFin && rec.fechaFin < hoy) return;
    if (rec.proximaGeneracion > hoy) return;

    // Crear factura real desde la plantilla
    try {
      const facturaData = {
        emisor: { ...rec.emisor },
        cliente: { ...rec.cliente },
        productos: JSON.parse(JSON.stringify(rec.productos || [])),
        materiales: JSON.parse(JSON.stringify(rec.materiales || [])),
        iva: rec.iva || '21',
        retencion: rec.retencion || { rate: 19, enabled: false },
        notas: rec.notas || '',
        serie: rec.serie || '',
      };

      if (typeof generarFacturaAutomatica === 'function') {
        generarFacturaAutomatica(facturaData);
      }
    } catch (e) {
      console.warn('Error generando factura recurrente:', e.message);
    }

    rec.ultimaGeneracion = hoy;
    rec.proximaGeneracion = _sumaFrecuencia(hoy, rec.frecuencia);
    generadas++;
  });

  if (generadas > 0) {
    saveRecurrentes(recs);
    showToast(`📅 ${generadas} factura(s) recurrente(s) generada(s)`);
  }
}

// ── Buscar recurrente por ID (para cloud) ────────────────
function _getRecurrenteById(id) {
  return getRecurrentes().find(r => r.id === id) || null;
}
