// ============================================================
//  storage.js — Capa de persistencia robusta (localStorage)
//  Replica la lógica de persistencia.py pero en el navegador
//  v2: Manejo de errores, backup automático, integridad
// ============================================================

const DB = {
  EMISORES:    'facturapp_emisores',
  CLIENTES:    'facturapp_clientes',
  IVA_HIST:    'facturapp_iva_history',
  PREMIUM:     'facturapp_premium',
  BACKUP:      'facturapp_auto_backup',
  SCHEMA:      'facturapp_schema_version',
  CHECKSUM:    'facturapp_checksum',
  SERIES:      'facturapp_series',
  CATALOGO:    'facturapp_catalogo',
  GASTOS:      'facturapp_gastos',
  RECURRENTES: 'facturapp_recurrentes',
};

// ── CLOUD SYNC HELPERS ────────────────────────────────────────
const _CLOUD_TABLE_MAP = {
  'facturapp_emisores': 'emisores',
  'facturapp_clientes': 'clientes',
  'facturapp_iva_history': 'iva_history',
  'facturapp_catalogo': 'catalogo',
  'facturapp_series': 'series',
  'facturapp_rectificativas': 'rectificativas',
  'facturapp_gastos': 'gastos',
  'facturapp_recurrentes': 'recurrentes',
};

function _cloudSync(table, data) {
  if (typeof sbQueueSync === 'function' && typeof sbIsConfigured === 'function' && sbIsConfigured()) {
    sbQueueSync(table, 'upsert', data);
  }
}

function _cloudDelete(table, identifier, idField) {
  if (typeof sbQueueSync === 'function' && typeof sbIsConfigured === 'function' && sbIsConfigured()) {
    const field = idField || 'nombre';
    sbQueueSync(table, 'delete', { [field]: identifier });
  }
}

// ── PREMIUM ────────────────────────────────────────────────────

function isPremium() {
  try {
    const raw = localStorage.getItem(DB.PREMIUM);
    if (!raw) return false;
    const data = JSON.parse(raw);
    // Verifica que el pago sea válido y no haya expirado (si tiene fecha)
    return data && data.activo === true;
  } catch { return false; }
}

function activarPremium(orderID) {
  const data = {
    activo:    true,
    orderID:   orderID,
    fecha:     new Date().toISOString(),
    plan:      'premium_lifetime',
  };
  return _save(DB.PREMIUM, data);
}

function getPremiumInfo() {
  try {
    const raw = localStorage.getItem(DB.PREMIUM);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// Emisores de ejemplo (reemplaza con tus datos)
const EMISOR_EJEMPLO_1 = {
  alias:           'Emisor1',
  nombre:          'Tu Nombre o Empresa',
  direccion:       'Tu dirección',
  cp_ciudad:       '03001 Alicante',
  doi:             'Z0000000X',
  cuenta_bancaria: 'ES00 0000 0000 0000 0000 0000',
  _predefined:     true,
};

const EMISOR_EJEMPLO_2 = {
  alias:           'Emisor2',
  nombre:          'Segundo Emisor',
  direccion:       'Otra dirección',
  cp_ciudad:       '03002 Alicante',
  doi:             'Z0000000Y',
  cuenta_bancaria: 'ES00 0000 0000 0000 0000 0000',
  _predefined:     true,
};

// Cliente de ejemplo (reemplaza con tus datos)
const CLIENTE_EJEMPLO = {
  alias:     'Cliente1',
  nombre:    'Nombre del Cliente',
  direccion: 'Dirección del cliente',
  cp_ciudad: '03001 Alicante',
  nif:       'B00000000',
  _predefined: true,
};

// ── Helpers genéricos ──────────────────────────────────────────

function _load(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function _save(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    // Detectar QuotaExceededError
    if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
      console.error('FacturAPP: localStorage lleno. Intentando liberar espacio...');
      _liberarEspacio();
      try {
        localStorage.setItem(key, JSON.stringify(data));
        return true;
      } catch (e2) {
        console.error('FacturAPP: No se pudo guardar tras liberar espacio:', e2.message);
        _mostrarErrorPersistencia();
        return false;
      }
    }
    console.error('FacturAPP: Error guardando datos:', e.message);
    return false;
  }
}

function _liberarEspacio() {
  try {
    // Intentar limpiar cache de PDFs viejos
    const pdfCache = localStorage.getItem('facturapp_pdf_cache_v1');
    if (pdfCache) {
      const cache = JSON.parse(pdfCache);
      const keys = Object.keys(cache);
      // Eliminar el 30% más viejo (por orden de inserción)
      const toRemove = Math.ceil(keys.length * 0.3);
      for (let i = 0; i < toRemove; i++) {
        delete cache[keys[i]];
      }
      localStorage.setItem('facturapp_pdf_cache_v1', JSON.stringify(cache));
      console.log(`FacturAPP: Limpiados ${toRemove} PDFs del cache`);
    }
  } catch (e) {
    console.warn('FacturAPP: Error limpiando cache:', e.message);
  }
}

function _mostrarErrorPersistencia() {
  if (typeof showToast === 'function') {
    showToast('⚠️ Almacenamiento lleno. Exporta un backup y libera espacio.');
  }
}

// ── EMISORES ───────────────────────────────────────────────────

function getEmisores() {
  const saved = _load(DB.EMISORES);
  return [EMISOR_EJEMPLO_1, EMISOR_EJEMPLO_2, ...saved];
}

function saveEmisor(emisor) {
  const list = _load(DB.EMISORES);
  const idx = list.findIndex(e => e.alias?.toLowerCase() === emisor.alias?.toLowerCase());
  if (idx >= 0) list[idx] = emisor;
  else list.push(emisor);
  _save(DB.EMISORES, list);
  _cloudSync('emisores', emisor);
  return true;
}

function deleteEmisor(alias) {
  const emisores = _load(DB.EMISORES);
  const target = emisores.find(e => e.alias === alias);
  const list = emisores.filter(e => e.alias !== alias);
  _save(DB.EMISORES, list);
  if (target) _cloudDelete('emisores', target.nombre);
  return true;
}

function getSavedEmisores() {
  return _load(DB.EMISORES);
}

// ── CLIENTES ───────────────────────────────────────────────────

function getClientes() {
  const saved = _load(DB.CLIENTES);
  return [CLIENTE_EJEMPLO, ...saved];
}

function saveCliente(cliente) {
  const list = _load(DB.CLIENTES);
  const idx = list.findIndex(c => c.alias?.toLowerCase() === cliente.alias?.toLowerCase());
  if (idx >= 0) list[idx] = cliente;
  else list.push(cliente);
  _save(DB.CLIENTES, list);
  _cloudSync('clientes', cliente);
  return true;
}

function deleteCliente(alias) {
  const clientes = _load(DB.CLIENTES);
  const target = clientes.find(c => c.alias === alias);
  const list = clientes.filter(c => c.alias !== alias);
  _save(DB.CLIENTES, list);
  if (target) _cloudDelete('clientes', target.nombre);
  return true;
}

function getSavedClientes() {
  return _load(DB.CLIENTES);
}

// ── IVA HISTORIAL ──────────────────────────────────────────────

function saveIvaHistory(registro) {
  const list = _load(DB.IVA_HIST);
  const entry = { ...registro, timestamp: new Date().toLocaleString('es-ES') };
  list.push(entry);
  _save(DB.IVA_HIST, list);
  _cloudSync('iva_history', entry);
  return true;
}

function getIvaHistory() {
  return _load(DB.IVA_HIST);
}

function clearIvaHistory() {
  localStorage.removeItem(DB.IVA_HIST);
}

// Totales acumulados del historial
function getIvaTotales() {
  const h = getIvaHistory();
  const safe = (v) => {
    const n = Number(v);
    return isFinite(n) ? n : 0;
  };
  return {
    totalFacturas:  h.length,
    totalSubtotal:  h.reduce((a, r) => a + safe(r.subtotal), 0),
    totalIva:       h.reduce((a, r) => a + safe(r.iva_importe), 0),
    totalRetencion: h.reduce((a, r) => a + safe(r.retencion_importe), 0),
    totalNeto:      h.reduce((a, r) => a + safe(r.total), 0),
  };
}

// ══════════════════════════════════════════════════════════════
//  BACKUP AUTOMÁTICO
// ══════════════════════════════════════════════════════════════

let _autoBackupTimer = null;

function iniciarAutoBackup() {
  if (_autoBackupTimer) return;
  const interval = (typeof FacturAPPConfig !== 'undefined')
    ? FacturAPPConfig.AUTO_BACKUP_INTERVAL_MS
    : 300000; // 5 min por defecto
  _autoBackupTimer = setInterval(_autoBackupTick, interval);
  // Primer backup rápido después de 30s
  setTimeout(_autoBackupTick, 30000);
  console.log('FacturAPP: Backup automático iniciado (cada ' + (interval / 1000) + 's)');
}

function detenerAutoBackup() {
  if (_autoBackupTimer) { clearInterval(_autoBackupTimer); _autoBackupTimer = null; }
}

function _autoBackupTick() {
  try {
    const backup = _generarBackupData();
    const json = JSON.stringify(backup);
    const sizeKB = Math.ceil(json.length / 1024);
    const maxSize = (typeof FacturAPPConfig !== 'undefined')
      ? FacturAPPConfig.AUTO_BACKUP_MAX_SIZE_KB
      : 4096;

    if (sizeKB > maxSize) {
      console.warn(`FacturAPP: Backup demasiado grande (${sizeKB}KB). Omitiendo.`);
      return;
    }

    // Calcular checksum del backup
    const checksum = _simpleChecksum(json);

    const backupWrapped = {
      version: (typeof FacturAPPConfig !== 'undefined') ? FacturAPPConfig.SCHEMA_VERSION : 1,
      timestamp: new Date().toISOString(),
      checksum: checksum,
      data: backup
    };

    _save(DB.BACKUP, backupWrapped);
    _save(DB.CHECKSUM, checksum);

    console.log(`FacturAPP: Backup automático guardado (${sizeKB}KB)`);
  } catch (e) {
    console.warn('FacturAPP: Error en backup automático:', e.message);
  }
}

function _generarBackupData() {
  return {
    emisores:      _load(DB.EMISORES),
    clientes:      _load(DB.CLIENTES),
    historial_iva: _load(DB.IVA_HIST),
    premium:       _load(DB.PREMIUM),
    catalogo:      _load(DB.CATALOGO),
    cobros:        _load('facturapp_cobros'),
    series:        _load(DB.SERIES),
    gastos:        _load(DB.GASTOS),
    recurrentes:   _load(DB.RECURRENTES),
    rectificativas: (function() { try { return JSON.parse(localStorage.getItem('facturapp_rectificativas') || '[]'); } catch(_) { return []; } })(),
    reminders:     (function() { try { return JSON.parse(localStorage.getItem('facturapp_reminders') || '[]'); } catch(_) { return []; } })(),
  };
}

function _simpleChecksum(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

function verificarIntegridad() {
  try {
    const savedChecksum = localStorage.getItem(DB.CHECKSUM);
    if (!savedChecksum) return true; // Sin checksum previo, asumir OK

    const backup = JSON.parse(localStorage.getItem(DB.BACKUP) || 'null');
    if (!backup) return true;

    const currentData = JSON.stringify(_generarBackupData());
    const currentChecksum = _simpleChecksum(currentData);

    return currentChecksum === savedChecksum;
  } catch (e) {
    console.warn('FacturAPP: Error verificando integridad:', e.message);
    return true; // No bloquear la app por errores de verificación
  }
}

function restaurarDesdeBackup() {
  try {
    const backup = JSON.parse(localStorage.getItem(DB.BACKUP) || 'null');
    if (!backup || !backup.data) return false;

    // Verificar checksum
    const dataStr = JSON.stringify(backup.data);
    if (backup.checksum && _simpleChecksum(dataStr) !== backup.checksum) {
      console.warn('FacturAPP: Checksum del backup no coincide. Datos posiblemente corruptos.');
      if (typeof showModal === 'function') {
        showModal('⚠️', 'Backup corrupto', 'El backup tiene integridad comprometida. Se usarán los datos actuales.');
      }
      return false;
    }

    // Restaurar cada sección solo si está vacía actualmente
    if (_load(DB.EMISORES).length === 0 && backup.data.emisores?.length > 0) {
      _save(DB.EMISORES, backup.data.emisores);
    }
    if (_load(DB.CLIENTES).length === 0 && backup.data.clientes?.length > 0) {
      _save(DB.CLIENTES, backup.data.clientes);
    }
    if (_load(DB.IVA_HIST).length === 0 && backup.data.historial_iva?.length > 0) {
      _save(DB.IVA_HIST, backup.data.historial_iva);
    }
    if (_load(DB.CATALOGO).length === 0 && backup.data.catalogo?.length > 0) {
      _save(DB.CATALOGO, backup.data.catalogo);
    }
    if (_load('facturapp_cobros').length === 0 && backup.data.cobros?.length > 0) {
      _save('facturapp_cobros', backup.data.cobros);
    }
    if (_load(DB.SERIES).length === 0 && backup.data.series?.length > 0) {
      _save(DB.SERIES, backup.data.series);
    }

    console.log('FacturAPP: Datos restaurados desde backup automático');
    return true;
  } catch (e) {
    console.error('FacturAPP: Error restaurando backup:', e.message);
    return false;
  }
}

// ══════════════════════════════════════════════════════════════
//  MIGRACIÓN DE ESQUEMA
// ══════════════════════════════════════════════════════════════

function getSchemaVersion() {
  try {
    return parseInt(localStorage.getItem(DB.SCHEMA) || '0', 10);
  } catch { return 0; }
}

function setSchemaVersion(v) {
  try { localStorage.setItem(DB.SCHEMA, String(v)); } catch (_) {}
}

function migrarDatosSiEsNecesario() {
  const currentVersion = getSchemaVersion();
  const targetVersion = (typeof FacturAPPConfig !== 'undefined')
    ? FacturAPPConfig.SCHEMA_VERSION
    : 2;

  if (currentVersion >= targetVersion) return;

  console.log(`FacturAPP: Migrando esquema v${currentVersion} → v${targetVersion}`);

  // Migración v0 → v1: Asegurar que todos los arrays existan
  if (currentVersion < 1) {
    if (!localStorage.getItem(DB.EMISORES)) _save(DB.EMISORES, []);
    if (!localStorage.getItem(DB.CLIENTES)) _save(DB.CLIENTES, []);
    if (!localStorage.getItem(DB.IVA_HIST)) _save(DB.IVA_HIST, []);
  }

  // Migración v1 → v2: Intentar restaurar desde backup si datos vacíos
  if (currentVersion < 2) {
    const emisores = _load(DB.EMISORES);
    const clientes = _load(DB.CLIENTES);
    if (emisores.length === 0 && clientes.length === 0) {
      restaurarDesdeBackup();
    }
  }

  setSchemaVersion(targetVersion);
  console.log('FacturAPP: Migración completada');
}

// ══════════════════════════════════════════════════════════════
//  SERIES DE NUMERACIÓN
// ══════════════════════════════════════════════════════════════

// Estructura: { id, nombre, prefijo, ultimoNumero, activa }
// Ejemplo: { id: 's1', nombre: 'General', prefijo: 'FACT', ultimoNumero: 0, activa: true }

function getSeries() {
  const series = _load(DB.SERIES);
  if (series.length === 0) {
    // Crear serie por defecto si no existe
    const defaultSerie = {
      id: 'default',
      nombre: 'General',
      prefijo: 'FACT',
      ultimoNumero: 0,
      activa: true
    };
    _save(DB.SERIES, [defaultSerie]);
    return [defaultSerie];
  }
  return series;
}

function getSerieActiva() {
  const series = getSeries();
  return series.find(s => s.activa) || series[0];
}

function saveSerie(serie) {
  const series = getSeries();
  const idx = series.findIndex(s => s.id === serie.id);
  if (idx >= 0) series[idx] = serie;
  else series.push(serie);
  _save(DB.SERIES, series);
  _cloudSync('series', serie);
}

function deleteSerie(id) {
  const series = getSeries();
  const target = series.find(s => s.id === id);
  const filtered = series.filter(s => s.id !== id);
  if (filtered.length > 0 && !filtered.some(s => s.activa)) {
    filtered[0].activa = true;
  }
  _save(DB.SERIES, filtered);
  if (target) _cloudDelete('series', target.nombre);
}

function setSerieActiva(id) {
  const series = getSeries().map(s => ({ ...s, activa: s.id === id }));
  _save(DB.SERIES, series);
}

function sugerirNumeroSerie(serieId) {
  const series = getSeries();
  const serie = series.find(s => s.id === serieId) || getSerieActiva();
  const siguiente = (serie.ultimoNumero || 0) + 1;
  const digits = String(siguiente).padStart(4, '0');
  return `${serie.prefijo}-${digits}`;
}

function incrementarNumeroSerie(serieId, numeroFactura) {
  const series = getSeries();
  const serie = series.find(s => s.id === serieId);
  if (!serie) return;

  // Extraer el número del formato "FACT-0001"
  const match = String(numeroFactura).match(/(\d+)$/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num > (serie.ultimoNumero || 0)) {
      serie.ultimoNumero = num;
      _save(DB.SERIES, series);
    }
  }
}

// ══════════════════════════════════════════════════════════════
//  CATÁLOGO DE PRODUCTOS / SERVICIOS
// ══════════════════════════════════════════════════════════════

function getCatalogo() {
  return _load(DB.CATALOGO);
}

function guardarCatalogo(item) {
  const catalogo = getCatalogo();
  if (item.id) {
    const idx = catalogo.findIndex(c => c.id === item.id);
    if (idx >= 0) catalogo[idx] = item;
    else catalogo.push(item);
  } else {
    item.id = 'cat_' + Date.now();
    catalogo.push(item);
  }
  _save(DB.CATALOGO, catalogo);
  _cloudSync('catalogo', item);
  return item;
}

function eliminarCatalogo(id) {
  const catalogo = getCatalogo();
  const target = catalogo.find(c => c.id === id);
  const filtered = catalogo.filter(c => c.id !== id);
  _save(DB.CATALOGO, filtered);
  if (target) _cloudDelete('catalogo', target.nombre);
}

function buscarCatalogo(query) {
  if (!query) return getCatalogo();
  const q = query.toLowerCase();
  return getCatalogo().filter(c =>
    (c.nombre && c.nombre.toLowerCase().includes(q)) ||
    (c.descripcion && c.descripcion.toLowerCase().includes(q)) ||
    (c.categoria && c.categoria.toLowerCase().includes(q))
  );
}

// ══════════════════════════════════════════════════════════════
//  ESTADO DE COBRO
// ══════════════════════════════════════════════════════════════

function setEstadoCobro(nombreFactura, estado) {
  const key = 'facturapp_cobros';
  const cobros = _load(key);
  const idx = cobros.findIndex(c => c.nombre === nombreFactura);
  const entry = { nombre: nombreFactura, estado: estado, fecha: new Date().toISOString() };
  if (idx >= 0) cobros[idx] = entry;
  else cobros.push(entry);
  _save(key, cobros);
  _cloudSync('cobros', entry);
}

function getEstadoCobro(nombreFactura) {
  const cobros = _load('facturapp_cobros');
  const cobro = cobros.find(c => c.nombre === nombreFactura);
  return cobro ? cobro.estado : 'pendiente';
}

function getTodosCobros() {
  return _load('facturapp_cobros');
}

// ══════════════════════════════════════════════════════════════
//  EXPORTAR TODO (Backup completo)
// ══════════════════════════════════════════════════════════════

function exportarTodo() {
  const backup = {
    version: '3.1.0',
    formato: 'facturapp_full_backup',
    fecha_exportacion: new Date().toISOString(),
    datos: {
      emisores:      _load(DB.EMISORES),
      clientes:      _load(DB.CLIENTES),
      historial_iva: _load(DB.IVA_HIST),
      catalogo:      _load(DB.CATALOGO),
      series:        _load(DB.SERIES),
      cobros:        _load('facturapp_cobros'),
      gastos:        _load(DB.GASTOS),
      recurrentes:   _load(DB.RECURRENTES),
      rectificativas: (function() { try { return JSON.parse(localStorage.getItem('facturapp_rectificativas') || '[]'); } catch(_) { return []; } })(),
      facturas_index: (function() { try { return JSON.parse(localStorage.getItem('facturapp_file_index') || '[]'); } catch(_) { return []; } })(),
      presupuestos:  (function() { try { return JSON.parse(localStorage.getItem('facturapp_presupuestos_v3') || '[]'); } catch(_) { return []; } })(),
      ordenes_trabajo: (function() { try { return JSON.parse(localStorage.getItem('ordenes_trabajo_v2') || '[]'); } catch(_) { return []; } })(),
      premium:       _load(DB.PREMIUM),
      reminders:     (function() { try { return JSON.parse(localStorage.getItem('facturapp_reminders') || '[]'); } catch(_) { return []; } })(),
      tg_contacts:   (function() { try { return JSON.parse(localStorage.getItem('tg_contacts') || '[]'); } catch(_) { return []; } })(),
      tg_bot_token:  localStorage.getItem('tg_bot_token') || '',
      tg_bot_username: localStorage.getItem('tg_bot_username') || '',
      sb_url:        localStorage.getItem('sb_url') || '',
      sb_key:        localStorage.getItem('sb_key') || '',
      license:       (function() { try { return JSON.parse(localStorage.getItem('facturapp_license') || 'null'); } catch(_) { return null; } })(),
      schema_version: getSchemaVersion(),
    }
  };
  return backup;
}

function descargarBackupCompleto() {
  const backup = exportarTodo();
  const json = JSON.stringify(backup, null, 2);
  const fecha = new Date().toISOString().split('T')[0];
  const nombre = `facturapp_backup_completo_${fecha}.json`;

  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);

  return { ok: true, nombre, size: json.length };
}

// ══════════════════════════════════════════════════════════════
//  IMPORTAR TODO (Restaurar backup)
// ══════════════════════════════════════════════════════════════

function importarTodo(jsonString) {
  let backup;
  try {
    backup = JSON.parse(jsonString);
  } catch (e) {
    return { ok: false, msg: 'Archivo JSON inválido' };
  }

  if (!backup || backup.formato !== 'facturapp_full_backup') {
    return { ok: false, msg: 'No es un backup válido de FacturAPP' };
  }

  const d = backup.datos;
  if (!d) return { ok: false, msg: 'El backup no contiene datos' };

  let importados = 0;
  let omitidos = 0;

  function _importar(key, data) {
    if (Array.isArray(data) && data.length > 0) {
      const existing = _load(key);
      if (existing.length === 0) {
        _save(key, data);
        importados += data.length;
      } else {
        omitidos += data.length;
      }
    } else if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (key === DB.PREMIUM || key === 'facturapp_license') {
        const existing = _load(key);
        if (!existing || (typeof existing === 'object' && Object.keys(existing).length === 0)) {
          _save(key, data);
          importados++;
        } else {
          omitidos++;
        }
      }
    }
  }

  _importar(DB.EMISORES, d.emisores);
  _importar(DB.CLIENTES, d.clientes);
  _importar(DB.IVA_HIST, d.historial_iva);
  _importar(DB.CATALOGO, d.catalogo);
  _importar(DB.SERIES, d.series);
  _importar('facturapp_cobros', d.cobros);
  _importar(DB.GASTOS, d.gastos);
  _importar(DB.RECURRENTES, d.recurrentes);
  _importar('facturapp_rectificativas', d.rectificativas);
  _importar('facturapp_file_index', d.facturas_index);
  _importar('facturapp_presupuestos_v3', d.presupuestos);
  _importar('ordenes_trabajo_v2', d.ordenes_trabajo);
  _importar(DB.PREMIUM, d.premium);
  _importar('facturapp_reminders', d.reminders);
  _importar('facturapp_license', d.license);

  if (d.tg_contacts && Array.isArray(d.tg_contacts) && d.tg_contacts.length > 0) {
    const existing = (function() { try { return JSON.parse(localStorage.getItem('tg_contacts') || '[]'); } catch(_) { return []; } })();
    if (existing.length === 0) {
      localStorage.setItem('tg_contacts', JSON.stringify(d.tg_contacts));
      importados += d.tg_contacts.length;
    } else { omitidos += d.tg_contacts.length; }
  }

  if (d.tg_bot_token && !localStorage.getItem('tg_bot_token')) {
    localStorage.setItem('tg_bot_token', d.tg_bot_token);
    importados++;
  }
  if (d.tg_bot_username && !localStorage.getItem('tg_bot_username')) {
    localStorage.setItem('tg_bot_username', d.tg_bot_username);
    importados++;
  }

  return {
    ok: true,
    msg: `Importados: ${importados} items. Omitidos (ya existían): ${omitidos}`,
    importados,
    omitidos,
    fecha_backup: backup.fecha_exportacion || 'desconocida',
    version_backup: backup.version || 'desconocida'
  };
}
