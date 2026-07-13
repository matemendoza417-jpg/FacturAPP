// ============================================================
//  fileService.js — Guardado de PDFs y gestión del índice
//  v2: Guarda datos completos para edición + backup/export
// ============================================================

const FILE_DIR   = 'Facturas';
const INDEX_FILE = 'Facturas/index.json';
const BACKUP_FILE = 'Facturas/backup.json';
const PDF_CACHE_KEY = 'facturapp_pdf_cache_v1';

function getFS() {
  try {
    const plugins = window.Capacitor && window.Capacitor.Plugins;
    if (plugins && plugins.Filesystem) return plugins.Filesystem;
  } catch (_) {}
  return null;
}

function getDir() {
  return { Documents: 'DOCUMENTS', Cache: 'CACHE', Data: 'DATA' };
}

async function _ensureDir() {
  const Fs  = getFS();
  const Dir = getDir();
  if (!Fs) return;
  try {
    await Fs.mkdir({ path: FILE_DIR, directory: Dir.Documents, recursive: true });
  } catch (e) {
    if (!e.message || !e.message.includes('exist')) {
      console.warn('fileService._ensureDir:', e.message);
    }
  }
}

async function leerIndice() {
  const Fs  = getFS();
  const Dir = getDir();
  if (Fs) {
    try {
      const { data } = await Fs.readFile({
        path:      INDEX_FILE,
        directory: Dir.Documents,
        encoding:  'utf8',
      });
      if (data) {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      if (!e.message || !e.message.toLowerCase().includes('exist')) {
        console.warn('fileService.leerIndice Filesystem:', e.message);
      }
    }
  }
  try {
    const raw = localStorage.getItem('facturapp_file_index');
    if (raw) {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (e) {
    console.warn('fileService.leerIndice localStorage:', e.message);
  }
  return [];
}

async function escribirIndice(lista) {
  const Fs  = getFS();
  const Dir = getDir();
  const json = JSON.stringify(lista, null, 2);
  try { localStorage.setItem('facturapp_file_index', json); } catch (_) {}
  if (Fs) {
    try {
      await _ensureDir();
      await Fs.writeFile({
        path:      INDEX_FILE,
        data:      json,
        directory: Dir.Documents,
        encoding:  'utf8',
        recursive: true,
      });
    } catch (e) {
      console.warn('fileService.escribirIndice Filesystem:', e.message);
    }
  }
}

// GUARDAR PDF + datos completos para edición
async function guardarFacturaPDF(base64Data, nombre, metadatos, datosCompletos) {
  const Fs  = getFS();
  const Dir = getDir();
  _guardarPDFLocal(nombre, base64Data);
  if (Fs) {
    await _ensureDir();
    await Fs.writeFile({
      path:      `${FILE_DIR}/${nombre}`,
      data:      base64Data,
      directory: Dir.Documents,
      recursive: true,
    });
  } else {
    _descargarFallback(base64Data, nombre);
  }
  const lista = await leerIndice();
  const sinDuplicado = lista.filter(f => f.nombre !== nombre);
  const facturaEntry = {
    nombre,
    num_factura:      metadatos.num_factura  || '',
    cliente:          metadatos.cliente      || '',
    emisor:           metadatos.emisor       || '',
    emisor_nombre:    metadatos.emisor       || '',
    cliente_nombre:   metadatos.cliente      || '',
    fecha:            metadatos.fecha        || '',
    total:            metadatos.total        || 0,
    guardado_en:      new Date().toISOString(),
    datos_completos:  datosCompletos || null,
  };
  sinDuplicado.unshift(facturaEntry);
  await escribirIndice(sinDuplicado);
  _cloudSync('facturas', facturaEntry);
  return {
    ok:   true,
    ruta: Fs ? `Documentos/Facturas/${nombre}` : 'Descarga directa',
  };
}

async function eliminarFacturaPDF(nombre) {
  const Fs  = getFS();
  const Dir = getDir();
  if (Fs) {
    try {
      await Fs.deleteFile({ path: `${FILE_DIR}/${nombre}`, directory: Dir.Documents });
    } catch (e) {
      console.warn('fileService.eliminar:', e.message);
    }
  }
  _eliminarPDFLocal(nombre);
  const lista = await leerIndice();
  await escribirIndice(lista.filter(f => f.nombre !== nombre));
  _cloudDelete('facturas', nombre);
}

async function getURIFactura(nombre) {
  const Fs  = getFS();
  const Dir = getDir();
  if (!Fs) return null;
  try {
    const { uri } = await Fs.getUri({ path: `${FILE_DIR}/${nombre}`, directory: Dir.Documents });
    return uri;
  } catch (e) {
    console.warn('fileService.getURI:', e.message);
    return null;
  }
}

async function leerPDFBase64(nombre) {
  const Fs  = getFS();
  const Dir = getDir();
  if (Fs) {
    try {
      const { data } = await Fs.readFile({ path: `${FILE_DIR}/${nombre}`, directory: Dir.Documents });
      if (data) return data;
    } catch (e) {
      console.warn('fileService.leerPDF:', e.message);
    }
  }
  return _leerPDFLocal(nombre);
}

function _leerPDFCache() {
  try {
    const raw = localStorage.getItem(PDF_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (_) {
    return {};
  }
}

function _guardarPDFLocal(nombre, base64Data) {
  try {
    const cache = _leerPDFCache();
    cache[nombre] = base64Data;
    localStorage.setItem(PDF_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {
    console.warn('fileService._guardarPDFLocal:', e.message);
  }
}

function _leerPDFLocal(nombre) {
  const cache = _leerPDFCache();
  return cache[nombre] || null;
}

function _eliminarPDFLocal(nombre) {
  try {
    const cache = _leerPDFCache();
    delete cache[nombre];
    localStorage.setItem(PDF_CACHE_KEY, JSON.stringify(cache));
  } catch (_) {}
}

// Leer datos completos para edición (con reconstrucción para facturas antiguas)
async function leerDatosFactura(nombre) {
  const lista = await leerIndice();
  const factura = lista.find(f => f.nombre === nombre);
  if (!factura) return null;

  // Si tiene datos completos, usarlos directamente
  if (factura.datos_completos) return factura.datos_completos;

  // Reconstruir datos parciales para facturas antiguas sin datos_completos
  const indexData = factura;
  const fechaRaw = _parseFechaToInput(indexData.fecha);

  return {
    emisor:            indexData.emisor_nombre ? { nombre: indexData.emisor_nombre, alias: indexData.emisor_nombre.split(' ')[0] } : null,
    cliente:           indexData.cliente_nombre ? { nombre: indexData.cliente_nombre, alias: indexData.cliente_nombre.split(' ')[0] } : null,
    productos:         [],
    materiales:        [],
    fechaRaw:          fechaRaw,
    num_factura:       indexData.num_factura || indexData.nombre || '',
    iva:               21,
    retencion:         { rate: 19, enabled: false, showInPdf: false, applyToTotal: false },
    _isPartialData:    true, // Flag para saber que faltan datos
  };
}

function _parseFechaToInput(fecha) {
  if (!fecha) return new Date().toISOString().split('T')[0];
  const parts = String(fecha).split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Si ya está en formato ISO
  if (fecha.includes('-')) return fecha;
  return new Date().toISOString().split('T')[0];
}

// Exportar backup JSON completo
async function exportarBackup() {
  const Fs  = getFS();
  const Dir = getDir();
  const backup = {
    version: '3.0',
    fecha_exportacion: new Date().toISOString(),
    emisores: getSavedEmisores(),
    clientes: getSavedClientes(),
    historial_iva: getIvaHistory(),
    facturas: await leerIndice(),
    presupuestos: typeof getPresupuestos === 'function' ? getPresupuestos() : [],
    catalogo: typeof getCatalogo === 'function' ? getCatalogo() : [],
    series: typeof getSeries === 'function' ? getSeries() : [],
    rectificativas: typeof _getRectCache === 'function' ? _getRectCache() : [],
    cobros: typeof getEstadoCobro === 'function' ? (function() { try { return JSON.parse(localStorage.getItem('facturapp_cobros') || '[]'); } catch(_) { return []; } })() : [],
    gastos: typeof getGastos === 'function' ? getGastos() : [],
    recurrentes: typeof getRecurrentes === 'function' ? getRecurrentes() : [],
  };
  const json = JSON.stringify(backup, null, 2);
  try { localStorage.setItem('facturapp_backup', json); } catch (_) {}
  if (Fs) {
    try {
      await _ensureDir();
      await Fs.writeFile({
        path:      BACKUP_FILE,
        data:      json,
        directory: Dir.Documents,
        encoding:  'utf8',
        recursive: true,
      });
      return { ok: true, ruta: `Documentos/Facturas/backup.json`, data: json };
    } catch (e) {
      console.warn('fileService.exportarBackup Filesystem:', e.message);
    }
  }
  _descargarTexto(json, `facturapp_backup_${new Date().toISOString().split('T')[0]}.json`, 'application/json');
  return { ok: true, ruta: 'Descarga directa', data: json };
}

// Exportar CSV del historial IVA
function exportarCSV() {
  const historial = getIvaHistory();
  if (historial.length === 0) return null;
  const headers = ['Num Factura', 'Fecha', 'Subtotal', 'IVA %', 'IVA Importe', 'Retencion %', 'Retencion Importe', 'Total'];
  const rows = historial.map(h => [
    h.num_factura || '',
    h.fecha || '',
    (h.subtotal || 0).toFixed(2),
    (h.iva_pct || 0).toFixed(1),
    (h.iva_importe || 0).toFixed(2),
    (h.retencion_pct || 0).toFixed(1),
    (h.retencion_importe || 0).toFixed(2),
    (h.total || 0).toFixed(2),
  ]);
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  _descargarTexto(csv, `facturapp_historial_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
  return csv;
}

function _descargarTexto(texto, nombre, mime) {
  const blob = new Blob([texto], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
}

function _descargarFallback(base64Data, nombre) {
  try {
    const byteChars = atob(base64Data);
    const bytes = new Uint8Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
  } catch (e) {
    console.error('Fallback descarga falló:', e);
  }
}
