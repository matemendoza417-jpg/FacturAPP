// ============================================================
//  presupuestos.js — v4 (bug fix: ghost elements on last delete)
// ============================================================

const PRESUPUESTOS_DB_KEY     = 'facturapp_presupuestos_v3';
const PRESUPUESTOS_OLD_DB_KEY = 'facturapp_presupuestos_v2';
let _presLongPressTimer    = null;
let _presLongPressTriggered = false;

// ── Persistencia ──────────────────────────────────────────────

function getPresupuestos() {
  try {
    const raw = localStorage.getItem(PRESUPUESTOS_DB_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(normalizePresupuesto);
    }
  } catch (_) {}

  // Migración desde v2
  try {
    const old = JSON.parse(localStorage.getItem(PRESUPUESTOS_OLD_DB_KEY) || '[]');
    if (Array.isArray(old) && old.length) return old.map(normalizePresupuesto);
  } catch (_) {}

  return [];
}

function savePresupuestos(lista) {
  const clean = Array.isArray(lista) ? lista.map(normalizePresupuesto) : [];
  localStorage.setItem(PRESUPUESTOS_DB_KEY, JSON.stringify(clean, null, 2));
  if (typeof _cloudSync === 'function' && typeof sbIsConfigured === 'function' && sbIsConfigured()) {
    clean.forEach(item => {
      const plain = { ...item };
      delete plain.productos;
      delete plain.materiales;
      _cloudSync('presupuestos', plain);
    });
  }
}

function normalizePresupuesto(p) {
  const productos = Array.isArray(p.productos) && p.productos.length
    ? p.productos
    : (p.items || []).map(it => ({
        descripcion:     it.desc || it.descripcion || '',
        cantidad:        Number(it.qty  ?? it.cantidad        ?? 0),
        precio_unitario: Number(it.precio ?? it.precio_unitario ?? 0),
        subtotal_linea:  Math.round(Number(it.qty ?? it.cantidad ?? 0) *
                         Number(it.precio ?? it.precio_unitario ?? 0) * 100) / 100,
      }));

  const materiales = Array.isArray(p.materiales) ? p.materiales : [];
  const total      = Number(p.total ??
    [...productos, ...materiales].reduce((a, it) => a + Number(it.subtotal_linea || 0), 0));

  return {
    ...p,
    id:       p.id || `pres_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    numero:   p.numero   || 'P-0001',
    fechaRaw: p.fechaRaw || parseFechaToInput(p.fecha) || new Date().toISOString().split('T')[0],
    fecha:    p.fecha    || formatFechaInput(p.fechaRaw || new Date().toISOString().split('T')[0]),
    productos,
    materiales,
    items: productos.map(it => ({ desc: it.descripcion, qty: it.cantidad, precio: it.precio_unitario })),
    total,
  };
}

function parseFechaToInput(fecha) {
  if (!fecha) return '';
  const parts = String(fecha).split('/');
  if (parts.length !== 3) return '';
  const [d, m, y] = parts;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function formatFechaInput(fechaRaw) {
  const [y, m, d] = String(fechaRaw || '').split('-');
  return y && m && d ? `${d}/${m}/${y}` : '';
}

// ── Navegación ────────────────────────────────────────────────

function presupuestoNuevo() {
  state.docType              = 'presupuesto';
  state._editando            = null;
  state._editandoPresupuesto = null;
  state._skipResetNueva      = false;
  navigate('screen-nueva');
}

function presupuestoEditar(id) {
  const item = getPresupuestos().find(p => p.id === id);
  if (!item) return showToast('Presupuesto no encontrado');

  state.docType              = 'presupuesto';
  state.emisor               = item.emisor    || null;
  state.cliente              = item.cliente   || null;
  state.productos            = item.productos || [];
  state.materiales           = item.materiales || [];
  state._editando            = null;
  state._editandoPresupuesto = id;
  state._skipResetNueva      = true;

  navigate('screen-nueva');

  document.getElementById('fac-fecha').value = item.fechaRaw || new Date().toISOString().split('T')[0];
  document.getElementById('fac-num').value   = item.numero   || sugerirNumeroPresupuesto();
  document.getElementById('fac-iva').value   = String(item.iva ?? 21);

  const ret = item.retencion || {};
  document.getElementById('chk-retencion').checked = ret.enabled || false;
  document.getElementById('fac-ret').value          = String(ret.rate || 19);
  toggleRetencion();

  renderProductosList();
  renderMaterialesList();
  renderEmisorList();
  goToStep(1);
  showToast('Editando presupuesto');
}

// ── Render lista ──────────────────────────────────────────────

function renderPresupuestos() {
  const list  = document.getElementById('presupuestos-list');
  const empty = document.getElementById('presupuestos-empty');
  const stats = document.getElementById('presupuestos-stats');
  if (!list) return;

  const presupuestos = getPresupuestos();
  list.innerHTML     = '';

  if (stats) {
    const total = presupuestos.reduce((a, p) => a + Number(p.total || 0), 0);
    stats.innerHTML = `
      <div class="hist-stat"><div class="val">${presupuestos.length}</div><div class="lbl">Presupuestos</div></div>
      <div class="hist-stat"><div class="val">${total.toFixed(2)} €</div><div class="lbl">Total estimado</div></div>
    `;
  }

  if (!presupuestos.length) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  presupuestos.forEach((p, index) => {
    const card = document.createElement('div');
    card.className = 'emitida-card presupuesto-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Opciones de presupuesto ${p.numero}`);
    card.style.animationDelay = `${index * 40}ms`;
    card.innerHTML = `
      <div class="emitida-card-top">
        <div class="emitida-info">
          <span class="emitida-num">Presupuesto ${escapeHtml(p.numero)}</span>
          <span class="emitida-fecha">${escapeHtml(p.fecha)}</span>
        </div>
        <span class="emitida-total">${Number(p.total || 0).toFixed(2)} €</span>
      </div>
      <div class="emitida-card-sub">
        <span>👤 ${escapeHtml(p.cliente?.nombre || '—')}</span>
        <span>🏢 ${escapeHtml(p.emisor?.nombre  || '—')}</span>
      </div>
      <div class="emitida-hold-hint">Mantén pulsado para ver opciones</div>
    `;
    card.onpointerdown  = ev => startPresupuestoLongPress(ev, p.id);
    card.onpointerup    = cancelPresupuestoLongPress;
    card.onpointerleave = cancelPresupuestoLongPress;
    card.onpointercancel = cancelPresupuestoLongPress;
    card.oncontextmenu  = ev => { ev.preventDefault(); showPresupuestoContextMenu(p.id); };
    card.onclick        = () => {
      if (_presLongPressTriggered) { _presLongPressTriggered = false; return; }
      showToast('Mantén pulsado para ver las opciones');
    };
    card.onkeydown = ev => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        showPresupuestoContextMenu(p.id);
      }
    };
    list.appendChild(card);
  });
}

// ── Guardar desde wizard ──────────────────────────────────────

async function presupuestoGuardarDesdeWizard() {
  if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) return;

  const t        = calcTotales();
  const fechaRaw = document.getElementById('fac-fecha').value || new Date().toISOString().split('T')[0];
  const numero   = document.getElementById('fac-num').value.trim() || sugerirNumeroPresupuesto();
  const lista    = getPresupuestos();
  const id       = state._editandoPresupuesto || `pres_${Date.now()}`;

  const data = {
    id,
    numero,
    fechaRaw,
    fecha:             formatFechaInput(fechaRaw),
    emisor:            state.emisor,
    cliente:           state.cliente,
    productos:         state.productos,
    materiales:        state.materiales,
    items:             state.productos.map(it => ({ desc: it.descripcion, qty: it.cantidad, precio: it.precio_unitario })),
    iva:               t.iva,
    subtotal:          t.base,
    iva_importe:       t.ivaImp,
    retencion:         t.retencion,
    retencion_importe: t.retImp,
    total:             t.total,
    actualizado_en:    new Date().toISOString(),
  };

  let pdf;
  try {
    pdf = await generarPresupuestoPDF(data);
  } catch (err) {
    showModal('❌', 'Error al generar PDF', `No se pudo crear el presupuesto: ${err.message}`);
    return;
  }

  data.pdf = { nombre: pdf.nombre };
  // Reemplaza el existente o lo agrega
  const next = lista.filter(p => p.id !== id);
  next.unshift(data);
  savePresupuestos(next);

  state._lastPdf             = data.pdf;
  state._editandoPresupuesto = null;

  if (state.screenHistory.length) {
    goBack();
    renderPresupuestos();
  }

  showConfirmDialog(
    '✈️', '¿Enviar a Telegram?',
    `Presupuesto guardado. ¿Querés enviar "${pdf.nombre}" por Telegram?`,
    () => showTelegramForm(data.pdf),
    () => showModal('🎉', '¡Presupuesto listo!', 'Proceso completado correctamente.')
  );
}

// ── CRUD ──────────────────────────────────────────────────────

function presupuestoEliminar(id) {
  const item = getPresupuestos().find(p => p.id === id);
  if (!item) return;

  showConfirmDialog('🗑️', 'Eliminar presupuesto', `Se eliminará "${item.numero}" permanentemente.`, () => {
    // BUG FIX: filtramos sobre una lista fresca, luego forzamos escritura
    const updated = getPresupuestos().filter(p => p.id !== id);
    savePresupuestos(updated);   // escribe siempre, incluso [] vacío
    renderPresupuestos();
    showToast('Presupuesto eliminado');
  }, null);
}

async function presupuestoGetPdf(item) {
  // Si ya tiene PDF en caché, usarlo
  if (item.pdf?.base64Data) return item.pdf;
  // Si tiene nombre de PDF pero no datos, intentar regenerar
  if (item.pdf?.nombre) {
    const cached = await _leerPDFLocal(item.pdf.nombre);
    if (cached) return { nombre: item.pdf.nombre, base64Data: cached };
  }
  // Regenerar PDF
  const pdf = await generarPresupuestoPDF(item);
  // Guardar solo el nombre, NO los datos base64 completos (ahorra espacio)
  const lista = getPresupuestos();
  const idx   = lista.findIndex(p => p.id === item.id);
  if (idx >= 0) {
    lista[idx].pdf = { nombre: pdf.nombre };
    savePresupuestos(lista);
  }
  return { nombre: pdf.nombre, base64Data: pdf.base64Data };
}

async function presupuestoVista(id) {
  const item = getPresupuestos().find(p => p.id === id);
  if (!item) return;
  const pdf = await presupuestoGetPdf(item);
  showPdfPreview(pdf.base64Data, pdf.nombre);
}

async function presupuestoExportar(id) {
  const item = getPresupuestos().find(p => p.id === id);
  if (!item) return;
  const pdf = await presupuestoGetPdf(item);
  descargarBase64PDF(pdf.base64Data, pdf.nombre);
  showToast('PDF exportado');
}

async function presupuestoCompartir(id) {
  const item = getPresupuestos().find(p => p.id === id);
  if (!item) return;
  const pdf = await presupuestoGetPdf(item);
  try {
    const plugins = window.Capacitor && window.Capacitor.Plugins;
    const Share   = plugins && plugins.Share;
    const Fs      = getFS();
    const Dir     = getDir();
    if (Share && Fs) {
      const path = `Facturas/${pdf.nombre}`;
      await Fs.writeFile({ path, data: pdf.base64Data, directory: Dir.Cache, recursive: true });
      const { uri } = await Fs.getUri({ path, directory: Dir.Cache });
      await Share.share({ title: pdf.nombre, text: `Presupuesto: ${item.numero}`, url: uri, dialogTitle: 'Compartir presupuesto' });
      return;
    }
    _compartirComoBlob(pdf.base64Data, pdf.nombre);
  } catch (e) {
    console.error('presupuestoCompartir:', e);
    showToast('Error al compartir presupuesto');
  }
}

async function presupuestoTelegram(id) {
  const item = getPresupuestos().find(p => p.id === id);
  if (!item) return;
  const pdf = await presupuestoGetPdf(item);
  state._lastPdf = pdf;
  showTelegramForm(pdf);
}

// ── Long-press ────────────────────────────────────────────────

function startPresupuestoLongPress(ev, id) {
  cancelPresupuestoLongPress();
  _presLongPressTriggered = false;
  ev.currentTarget.classList.add('long-pressing');
  _presLongPressTimer = setTimeout(() => {
    _presLongPressTriggered = true;
    ev.currentTarget.classList.remove('long-pressing');
    showPresupuestoContextMenu(id);
  }, 520);
}

function cancelPresupuestoLongPress(ev) {
  if (_presLongPressTimer) clearTimeout(_presLongPressTimer);
  _presLongPressTimer = null;
  if (ev?.currentTarget) ev.currentTarget.classList.remove('long-pressing');
}

// ── Context Menu ──────────────────────────────────────────────

function showPresupuestoContextMenu(id) {
  const item = getPresupuestos().find(p => p.id === id);
  if (!item) return;
  const encoded = encodeURIComponent(id);
  const overlay = document.getElementById('modal-overlay');
  overlay.innerHTML = `
    <div class="action-sheet" onclick="event.stopPropagation()">
      <div class="sheet-handle"></div>
      <div class="sheet-title">Presupuesto</div>
      <div class="sheet-subtitle">${escapeHtml(item.numero)}</div>
      <div class="sheet-actions">
        <button class="sheet-action" onclick="closeModal(); presupuestoVista(decodeURIComponent('${encoded}'))">📄 Abrir vista previa</button>
        <button class="sheet-action" onclick="closeModal(); presupuestoEditar(decodeURIComponent('${encoded}'))">✏️ Editar</button>
        <button class="sheet-action highlight" onclick="closeModal(); convertirPresupuestoAFactura('${escapeAttr(item.numero)}')">🔄 Convertir a Factura</button>
        <button class="sheet-action" onclick="closeModal(); presupuestoExportar(decodeURIComponent('${encoded}'))">⬇️ Exportar PDF</button>
        <button class="sheet-action" onclick="closeModal(); presupuestoCompartir(decodeURIComponent('${encoded}'))">🔗 Compartir</button>
        <button class="sheet-action" onclick="closeModal(); presupuestoTelegram(decodeURIComponent('${encoded}'))">✈️ Enviar a Telegram</button>
        <button class="sheet-action danger" onclick="closeModal(); presupuestoEliminar(decodeURIComponent('${encoded}'))">🗑️ Eliminar</button>
      </div>
      <button class="sheet-cancel" onclick="closeModal()">Cancelar</button>
    </div>
  `;
  overlay.classList.remove('hidden');
  overlay.onclick = closeModal;
}

// ── PDF ───────────────────────────────────────────────────────

async function generarPresupuestoPDF(p) {
  const datos = {
    emisor:            p.emisor,
    cliente:           p.cliente,
    fecha:             p.fecha || formatFechaInput(p.fechaRaw),
    fechaRaw:          p.fechaRaw,
    num_factura:       p.numero,
    documento_titulo:  'PRESUPUESTO',
    numero_label:      'N° PRESUPUESTO:',
    nombre_cliente:    p.cliente?.nombre       || '',
    dir_cliente:       p.cliente?.direccion    || '',
    cp_ciudad_cliente: p.cliente?.cp_ciudad    || '',
    nif_cliente:       p.cliente?.nif          || '',
    cuenta_bancaria:   p.emisor?.cuenta_bancaria || '',
    productos:         p.productos  || [],
    materiales:        p.materiales || [],
    iva:               Number(p.iva ?? 21),
    subtotal:          Number(p.subtotal      ?? 0),
    iva_importe:       Number(p.iva_importe   ?? 0),
    retencion:         p.retencion || { rate: 0, enabled: false, showInPdf: false, applyToTotal: false },
    retencion_importe: Number(p.retencion_importe ?? 0),
    total:             Number(p.total ?? 0),
  };
  return generarPDFBlob(datos, `Presupuesto_${p.numero}`);
}

function sugerirNumeroPresupuesto() {
  const presupuestos = getPresupuestos();
  const max = presupuestos.reduce((acc, p) => {
    const match = String(p.numero || '').match(/P-(\d+)/i);
    return match ? Math.max(acc, Number(match[1])) : acc;
  }, 0);
  return `P-${String(max + 1).padStart(4, '0')}`;
}
