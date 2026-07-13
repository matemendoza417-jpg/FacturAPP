// ============================================================
//  dashboard.js — Dashboard de ingresos
//  Resumen mensual/anual: facturado, cobrado, pendiente, gastos
// ============================================================

function getResumenDashboard() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mesActual = String(hoy.getMonth() + 1).padStart(2, '0');
  const anioMes = `${anio}-${mesActual}`;

  // Facturas del año
  let facturas = [];
  try {
    const raw = localStorage.getItem('facturapp_file_index');
    if (raw) {
      const parsed = JSON.parse(raw);
      facturas = Array.isArray(parsed) ? parsed : [];
    }
  } catch (_) {}

  // Filtrar por año/mes
  const facAnio = facturas.filter(f => {
    const fecha = f.fecha || '';
    return fecha.includes('/') ? fecha.endsWith(`/${anio}`) : (f.fecha || '').startsWith(anioMes);
  });
  const facMes = facturas.filter(f => {
    const fecha = f.fecha || '';
    return fecha.includes('/') ? fecha.endsWith(`/${mesActual}/${anio}`) : (f.fecha || '').startsWith(anioMes);
  });

  // Intentar parsear fechas en formato dd/mm/yyyy
  function _parseFechaFactura(fecha) {
    if (!fecha) return null;
    const parts = fecha.split('/');
    if (parts.length === 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
    return new Date(fecha);
  }

  const facAnioReal = facturas.filter(f => {
    const d = _parseFechaFactura(f.fecha);
    return d && d.getFullYear() === anio;
  });
  const facMesReal = facturas.filter(f => {
    const d = _parseFechaFactura(f.fecha);
    return d && d.getFullYear() === anio && (d.getMonth() + 1) === parseInt(mesActual);
  });

  const usarReal = facAnioReal.length >= facAnio.length;
  const _facA = usarReal ? facAnioReal : facAnio;
  const _facM = usarReal ? facMesReal : facMes;

  const totalFacturadoAnio = _facA.reduce((a, f) => a + Number(f.total || 0), 0);
  const totalFacturadoMes = _facM.reduce((a, f) => a + Number(f.total || 0), 0);

  // Restar rectificativas (notas de crédito) del total facturado
  let rects = [];
  try {
    const rawRect = localStorage.getItem('facturapp_rectificativas');
    if (rawRect) rects = JSON.parse(rawRect);
  } catch (_) {}
  const rectAnio = rects.filter(r => {
    const d = _parseFechaFactura(r.fecha);
    return d && d.getFullYear() === anio;
  });
  const rectMes = rects.filter(r => {
    const d = _parseFechaFactura(r.fecha);
    return d && d.getFullYear() === anio && (d.getMonth() + 1) === parseInt(mesActual);
  });
  const totalRectAnio = rectAnio.reduce((a, r) => a + Math.abs(Number(r.total || 0)), 0);
  const totalRectMes = rectMes.reduce((a, r) => a + Math.abs(Number(r.total || 0)), 0);

  const netoFacturadoAnio = totalFacturadoAnio - totalRectAnio;
  const netoFacturadoMes = totalFacturadoMes - totalRectMes;

  // Cobros
  let cobros = [];
  try {
    const raw = localStorage.getItem('facturapp_cobros');
    if (raw) cobros = JSON.parse(raw);
  } catch (_) {}

  const cobradosMes = cobros.filter(c => c.estado === 'cobrado' && (c.fecha || '').startsWith(anioMes));
  const pendientesMes = _facM.filter(f => {
    const cobro = cobros.find(c => c.nombre === f.nombre);
    return !cobro || cobro.estado !== 'cobrado';
  });
  const totalPendienteMes = pendientesMes.reduce((a, f) => a + Number(f.total || 0), 0);

  // Gastos
  const gastos = getGastos();
  const gastosAnio = gastos.filter(g => (g.fecha || '').startsWith(String(anio)));
  const gastosMes = gastos.filter(g => (g.fecha || '').startsWith(anioMes));
  const totalGastosAnio = gastosAnio.reduce((a, g) => a + Number(g.monto || 0), 0);
  const totalGastosMes = gastosMes.reduce((a, g) => a + Number(g.monto || 0), 0);

  // IVA
  let ivaHist = [];
  try {
    ivaHist = getIvaHistory();
  } catch (_) {}
  const ivaMes = ivaHist.filter(e => {
    const d = _parseFechaFactura(e.fecha);
    return d && d.getFullYear() === anio && (d.getMonth() + 1) === parseInt(mesActual);
  });
  const ivaTotalMes = ivaMes.reduce((a, e) => a + Number(e.iva_importe || 0), 0);
  const retTotalMes = ivaMes.reduce((a, e) => a + Number(e.retencion_importe || 0), 0);

  return {
    facturadoMes: netoFacturadoMes,
    facturadoAnio: netoFacturadoAnio,
    pendienteMes: totalPendienteMes,
    gastosMes: totalGastosMes,
    gastosAnio: totalGastosAnio,
    ivaMes: ivaTotalMes,
    retMes: retTotalMes,
    totalFacturasMes: _facM.length,
    totalFacturasAnio: _facA.length,
    pendientesCount: pendientesMes.length,
    rectificativasMes: totalRectMes,
    rectificativasAnio: totalRectAnio,
  };
}

function renderDashboardMini() {
  const el = document.getElementById('dashboard-mini');
  if (!el) return;

  const r = getResumenDashboard();
  const beneficioMes = r.facturadoMes - r.gastosMes;

  el.innerHTML = `
    <div class="dash-grid">
      <div class="dash-card dash-blue">
        <div class="dash-val">${r.facturadoMes.toFixed(0)} €</div>
        <div class="dash-lbl">Facturado (mes)</div>
      </div>
      <div class="dash-card dash-green">
        <div class="dash-val">${(r.facturadoMes - r.pendienteMes).toFixed(0)} €</div>
        <div class="dash-lbl">Cobrado (mes)</div>
      </div>
      <div class="dash-card dash-yellow">
        <div class="dash-val">${r.pendienteMes.toFixed(0)} €</div>
        <div class="dash-lbl">Pendiente (${r.pendientesCount})</div>
      </div>
      <div class="dash-card dash-red">
        <div class="dash-val">-${r.gastosMes.toFixed(0)} €</div>
        <div class="dash-lbl">Gastos (mes)</div>
      </div>
    </div>
    <div class="dash-beneficio">
      <span>Beneficio neto (mes)</span>
      <span class="${beneficioMes >= 0 ? 'dash-pos' : 'dash-neg'}">${beneficioMes >= 0 ? '+' : ''}${beneficioMes.toFixed(2)} €</span>
    </div>
  `;
}
