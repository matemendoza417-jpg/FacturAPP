// ============================================================
//  gastos.js — Gestión de gastos deducibles
//  CRUD + categorías + exportación CSV + resumen
// ============================================================

const GASTOS_DB_KEY = 'facturapp_gastos';
const GASTOS_CATEGORIAS = [
  'Materiales', 'Transporte', 'Herramientas', 'Suministros',
  'Servicios externos', 'Alquiler', 'Internet/Teléfono', 'Formación',
  'Seguros', 'Mantenimiento', 'Oficina', 'Marketing', 'Otros'
];

let _gastosFiltroCat = null;
let _gastoEditando = null;

function getGastos() {
  try {
    const raw = localStorage.getItem(GASTOS_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (_) {}
  return [];
}

function saveGastos(lista) {
  localStorage.setItem(GASTOS_DB_KEY, JSON.stringify(Array.isArray(lista) ? lista : []));
  if (typeof _cloudSync === 'function' && typeof sbIsConfigured === 'function' && sbIsConfigured()) {
    (Array.isArray(lista) ? lista : []).forEach(item => {
      _cloudSync('gastos', { ...item });
    });
  }
}

function _gastoId() {
  return `gasto_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function _formatFechaGasto(fechaStr) {
  if (!fechaStr) return '—';
  const [y, m, d] = fechaStr.split('-');
  return `${d}/${m}/${y}`;
}

function _catEmojiGasto(cat) {
  const map = {
    'Materiales': '🧱', 'Transporte': '🚗', 'Herramientas': '🔧',
    'Suministros': '📦', 'Servicios externos': '🤝', 'Alquiler': '🏠',
    'Internet/Teléfono': '📱', 'Formación': '📚', 'Seguros': '🛡️',
    'Mantenimiento': '⚙️', 'Oficina': '📎', 'Marketing': '📢', 'Otros': '💡'
  };
  return map[cat] || '💰';
}

// ── Render listado ─────────────────────────────────────────
function renderGastos() {
  const list = document.getElementById('gastos-list');
  const empty = document.getElementById('gastos-empty');
  const stats = document.getElementById('gastos-stats');
  if (!list) return;

  const gastos = getGastos();
  list.innerHTML = '';

  const mesActual = new Date().toISOString().slice(0, 7);
  const gastosMes = gastos.filter(g => (g.fecha || '').startsWith(mesActual));
  const totalMes = gastosMes.reduce((a, g) => a + Number(g.monto || 0), 0);
  const totalGeneral = gastos.reduce((a, g) => a + Number(g.monto || 0), 0);

  if (stats) {
    stats.innerHTML = `
      <div class="hist-stat"><div class="val">${gastos.length}</div><div class="lbl">Gastos</div></div>
      <div class="hist-stat"><div class="val">${totalMes.toFixed(2)} €</div><div class="lbl">Este mes</div></div>
      <div class="hist-stat"><div class="val">${totalGeneral.toFixed(2)} €</div><div class="lbl">Total año</div></div>
    `;
  }

  let filtrados = gastos;
  if (_gastosFiltroCat) filtrados = gastos.filter(g => g.categoria === _gastosFiltroCat);

  if (!filtrados.length) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  filtrados.forEach((g, index) => {
    const card = document.createElement('div');
    card.className = 'emitida-card';
    card.style.animationDelay = `${index * 40}ms`;

    card.innerHTML = `
      <div class="emitida-card-top">
        <div class="emitida-info">
          <span class="emitida-num">${_catEmojiGasto(g.categoria)} ${escapeHtml(g.descripcion || 'Sin descripción')}</span>
          <span class="emitida-fecha">${_formatFechaGasto(g.fecha)}</span>
        </div>
        <span class="emitida-total" style="color:var(--red-800);font-weight:700">${Number(g.monto || 0).toFixed(2)} €</span>
      </div>
      <div class="emitida-card-sub">
        <span>📁 ${escapeHtml(g.categoria || 'Otros')}</span>
        ${g.metodo ? `<span>💳 ${escapeHtml(g.metodo)}</span>` : ''}
      </div>
    `;

    card.oncontextmenu = ev => { ev.preventDefault(); showGastoContextMenu(g.id); };
    card.onclick = () => showGastoContextMenu(g.id);
    list.appendChild(card);
  });
}

function showGastoContextMenu(id) {
  const gasto = getGastos().find(g => g.id === id);
  if (!gasto) return;
  const encoded = encodeURIComponent(id);
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div class="action-sheet" onclick="event.stopPropagation()">
      <div class="sheet-handle"></div>
      <div class="sheet-title">Gasto</div>
      <div class="sheet-subtitle">${escapeHtml(gasto.descripcion || 'Sin descripción')} — ${Number(gasto.monto || 0).toFixed(2)} €</div>
      <div class="sheet-actions">
        <button class="sheet-action" onclick="closeModal();editarGasto('${encoded}')">✏️ Editar</button>
        <button class="sheet-action danger" onclick="closeModal();eliminarGasto('${encoded}')">🗑️ Eliminar</button>
      </div>
      <button class="sheet-cancel" onclick="closeModal()">Cancelar</button>
    </div>
  `;
  overlay.classList.remove('hidden');
  overlay.onclick = closeModal;
}

// ── Formulario ────────────────────────────────────────────
function mostrarFormGasto(gasto) {
  _gastoEditando = gasto || null;
  const form = document.getElementById('gasto-form');
  if (!form) return;

  document.getElementById('gasto-form-title').textContent = gasto ? 'Editar Gasto' : 'Nuevo Gasto';
  document.getElementById('gasto-descripcion').value = gasto ? (gasto.descripcion || '') : '';
  document.getElementById('gasto-monto').value = gasto ? gasto.monto : '';
  document.getElementById('gasto-fecha').value = gasto ? gasto.fecha : new Date().toISOString().split('T')[0];
  document.getElementById('gasto-categoria').value = gasto ? (gasto.categoria || 'Otros') : 'Otros';
  document.getElementById('gasto-metodo').value = gasto ? (gasto.metodo || '') : '';
  document.getElementById('gasto-notas').value = gasto ? (gasto.notas || '') : '';

  form.classList.remove('hidden');
}

function cancelarFormGasto() {
  const form = document.getElementById('gasto-form');
  if (form) form.classList.add('hidden');
  _gastoEditando = null;
}

function guardarGastoForm() {
  const descripcion = document.getElementById('gasto-descripcion').value.trim();
  const monto = parseFloat(document.getElementById('gasto-monto').value) || 0;
  const fecha = document.getElementById('gasto-fecha').value;
  const categoria = document.getElementById('gasto-categoria').value;
  const metodo = document.getElementById('gasto-metodo').value.trim();
  const notas = document.getElementById('gasto-notas').value.trim();

  if (!descripcion) { showToast('Ponle una descripción al gasto'); return; }
  if (monto <= 0) { showToast('El monto debe ser mayor a 0'); return; }

  const gasto = {
    id: _gastoEditando ? _gastoEditando.id : _gastoId(),
    descripcion, monto, fecha, categoria, metodo, notas,
    creado: _gastoEditando ? _gastoEditando.creado : new Date().toISOString(),
    actualizado: new Date().toISOString(),
  };

  const gastos = getGastos();
  const idx = gastos.findIndex(g => g.id === gasto.id);
  if (idx >= 0) gastos[idx] = gasto;
  else gastos.push(gasto);
  saveGastos(gastos);

  cancelarFormGasto();
  renderGastos();
  showToast(_gastoEditando ? 'Gasto actualizado' : 'Gasto guardado');
}

function editarGasto(id) {
  const gasto = getGastos().find(g => g.id === id);
  if (gasto) mostrarFormGasto(gasto);
}

function eliminarGasto(id) {
  showConfirmDialog('🗑️', 'Eliminar gasto', '¿Eliminar este gasto?', () => {
    const gastos = getGastos().filter(g => g.id !== id);
    saveGastos(gastos);
    renderGastos();
    showToast('Gasto eliminado');
  }, null);
}

function filtrarGastos() {
  _gastosFiltroCat = null;
  renderGastos();
}

function filtrarGastosPorCategoria(cat) {
  _gastosFiltroCat = _gastosFiltroCat === cat ? null : cat;
  renderGastos();
}

// ── Exportar gastos a CSV ─────────────────────────────────
function exportarGastosCSV() {
  const gastos = getGastos();
  if (!gastos.length) { showToast('No hay gastos para exportar'); return; }

  const header = 'Fecha;Descripción;Categoría;Monto;Método de pago;Notas\n';
  const rows = gastos.map(g =>
    `${g.fecha};${(g.descripcion || '').replace(/;/g, ',')};${g.categoria};${g.monto};${(g.metodo || '').replace(/;/g, ',')};${(g.notas || '').replace(/;/g, ',')}`
  ).join('\n');

  const csv = header + rows;
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gastos_facturapp_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV de gastos descargado');
}

// ── Resumen anual para dashboard ──────────────────────────
function getResumenGastos() {
  const gastos = getGastos();
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mesActual = String(hoy.getMonth() + 1).padStart(2, '0');

  const gastosAnio = gastos.filter(g => (g.fecha || '').startsWith(String(anio)));
  const gastosMes = gastos.filter(g => (g.fecha || '').startsWith(`${anio}-${mesActual}`));

  const totalAnio = gastosAnio.reduce((a, g) => a + Number(g.monto || 0), 0);
  const totalMes = gastosMes.reduce((a, g) => a + Number(g.monto || 0), 0);

  const porCategoria = {};
  gastosAnio.forEach(g => {
    const cat = g.categoria || 'Otros';
    porCategoria[cat] = (porCategoria[cat] || 0) + Number(g.monto || 0);
  });

  return { totalAnio, totalMes, porCategoria, count: gastos.length };
}
