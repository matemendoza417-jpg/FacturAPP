// ============================================================
//  backend.js — Supabase Integration Layer
//  Conexión a la nube: auth + sync de datos
// ============================================================

// CONFIGURACIÓN: Reemplaza estos valores con tus credenciales de Supabase
// O configuralos desde la pantalla de ajustes de la app
const SB_URL = localStorage.getItem('sb_url') || '';
const SB_KEY = localStorage.getItem('sb_key') || '';

let _sb = null;
let _sbUser = null;

function _getSupabase() {
  if (_sb) return _sb;
  if (!window.supabase || !window.supabase.createClient) {
    console.warn('Supabase SDK not loaded');
    return null;
  }
  const url = SB_URL || localStorage.getItem('sb_url') || '';
  const key = SB_KEY || localStorage.getItem('sb_key') || '';
  if (!url || !key) return null;
  _sb = window.supabase.createClient(url, key);
  return _sb;
}

// ══════════════════════════════════════════════════════════════
//  AUTH
// ══════════════════════════════════════════════════════════════

async function sbSignUp(email, password) {
  const sb = _getSupabase();
  if (!sb) throw new Error('Supabase no configurado');
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

async function sbSignIn(email, password) {
  const sb = _getSupabase();
  if (!sb) throw new Error('Supabase no configurado');
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  _sbUser = data.user;
  return data;
}

async function sbSignOut() {
  const sb = _getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
  _sbUser = null;
  localStorage.removeItem('sb_session');
}

async function sbResetPassword(email) {
  const sb = _getSupabase();
  if (!sb) throw new Error('Supabase no configurado');
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.href
  });
  if (error) throw error;
}

async function sbDeleteAccount() {
  const sb = _getSupabase();
  if (!sb) throw new Error('Supabase no configurado');
  const user = await sbGetUser();
  if (!user) throw new Error('No hay sesión');

  const TABLES = ['emisores','clientes','facturas','presupuestos','ordenes_trabajo','catalogo','series','rectificativas','iva_history','cobros','tg_contacts','user_settings','gastos','recurrentes'];
  for (const t of TABLES) {
    await sb.from(t).delete().eq('user_id', user.id);
  }

  const { error } = await sb.auth.admin.deleteUser(user.id);
  if (error) {
    const { error: e2 } = await sb.from('user_settings').delete().eq('user_id', user.id);
    await sbSignOut();
    if (e2) throw e2;
  }
  await sbSignOut();
}

async function sbGetUser() {
  if (_sbUser) return _sbUser;
  const sb = _getSupabase();
  if (!sb) return null;
  const { data: { user } } = await sb.auth.getUser();
  _sbUser = user;
  return user;
}

function sbIsConfigured() {
  const url = SB_URL || localStorage.getItem('sb_url') || '';
  const key = SB_KEY || localStorage.getItem('sb_key') || '';
  return !!(url && key);
}

function sbConfigure(url, key) {
  localStorage.setItem('sb_url', url);
  localStorage.setItem('sb_key', key);
  _sb = null;
}

// ══════════════════════════════════════════════════════════════
//  GENERIC CRUD
// ══════════════════════════════════════════════════════════════

async function sbGetAll(table) {
  const sb = _getSupabase();
  if (!sb) return [];
  const user = await sbGetUser();
  if (!user) return [];
  const { data, error } = await sb.from(table).select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  if (error) { console.error(`sbGetAll ${table}:`, error); return []; }
  return data || [];
}

async function sbInsert(table, row) {
  const sb = _getSupabase();
  if (!sb) return null;
  const user = await sbGetUser();
  if (!user) return null;
  row.user_id = user.id;
  const { data, error } = await sb.from(table).insert(row).select().single();
  if (error) { console.error(`sbInsert ${table}:`, error); return null; }
  return data;
}

async function sbUpdate(table, id, updates) {
  const sb = _getSupabase();
  if (!sb) return false;
  const user = await sbGetUser();
  if (!user) return false;
  const { error } = await sb.from(table).update(updates).eq('id', id).eq('user_id', user.id);
  if (error) { console.error(`sbUpdate ${table}:`, error); return false; }
  return true;
}

async function sbDelete(table, id) {
  const sb = _getSupabase();
  if (!sb) return false;
  const user = await sbGetUser();
  if (!user) return false;
  const { error } = await sb.from(table).delete().eq('id', id).eq('user_id', user.id);
  if (error) { console.error(`sbDelete ${table}:`, error); return false; }
  return true;
}

async function sbUpsert(table, row, conflictCol) {
  const sb = _getSupabase();
  if (!sb) return null;
  const user = await sbGetUser();
  if (!user) return null;
  row.user_id = user.id;
  const { data, error } = await sb.from(table).upsert(row, { onConflict: conflictCol }).select().single();
  if (error) { console.error(`sbUpsert ${table}:`, error); return null; }
  return data;
}

async function sbGetByEmail(table, emailCol, emailVal) {
  const sb = _getSupabase();
  if (!sb) return null;
  const user = await sbGetUser();
  if (!user) return null;
  const { data, error } = await sb.from(table).select('*').eq('user_id', user.id).eq(emailCol, emailVal).single();
  if (error) return null;
  return data;
}

// ══════════════════════════════════════════════════════════════
//  SYNC: localStorage → Supabase (primera vez)
// ══════════════════════════════════════════════════════════════

async function sbMigrateLocalToCloud() {
  if (!sbIsConfigured()) return { ok: false, msg: 'Supabase no configurado' };
  const user = await sbGetUser();
  if (!user) return { ok: false, msg: 'No hay sesión' };

  const results = { migrated: 0, skipped: 0, errors: 0 };

  const TABLE_MAP = {
    'facturapp_emisores': 'emisores',
    'facturapp_clientes': 'clientes',
    'facturapp_catalogo': 'catalogo',
    'facturapp_series': 'series',
    'facturapp_rectificativas': 'rectificativas',
    'facturapp_iva_history': 'iva_history',
    'facturapp_cobros': 'cobros',
    'facturapp_gastos': 'gastos',
    'facturapp_recurrentes': 'recurrentes',
  };

  for (const [localKey, tableName] of Object.entries(TABLE_MAP)) {
    try {
      const raw = localStorage.getItem(localKey);
      if (!raw) continue;
      const items = JSON.parse(raw);
      if (!Array.isArray(items) || items.length === 0) continue;

      const existing = await sbGetAll(tableName);
      const existingNames = new Set(existing.map(e => e.nombre || e.alias || ''));

      for (const item of items) {
        const name = item.nombre || item.alias || '';
        if (existingNames.has(name)) { results.skipped++; continue; }

        const row = { ...item };
        delete row.id;
        row.user_id = user.id;
        row._predefined = item._predefined || false;

        const { error } = await sb.from(tableName).insert(row);
        if (error) { results.errors++; console.error(error); }
        else { results.migrated++; }
      }
    } catch (e) {
      results.errors++;
      console.error(`Migration error ${localKey}:`, e);
    }
  }

  return { ok: true, ...results };
}

// ══════════════════════════════════════════════════════════════
//  SYNC: Supabase → localStorage (al iniciar sesión)
// ══════════════════════════════════════════════════════════════

async function sbSyncCloudToLocal() {
  if (!sbIsConfigured()) return;
  const user = await sbGetUser();
  if (!user) return;

  const TABLE_MAP = {
    'emisores': 'facturapp_emisores',
    'clientes': 'facturapp_clientes',
    'catalogo': 'facturapp_catalogo',
    'series': 'facturapp_series',
    'rectificativas': 'facturapp_rectificativas',
    'iva_history': 'facturapp_iva_history',
    'cobros': 'facturapp_cobros',
    'gastos': 'facturapp_gastos',
    'recurrentes': 'facturapp_recurrentes',
  };

  for (const [tableName, localKey] of Object.entries(TABLE_MAP)) {
    try {
      const cloudData = await sbGetAll(tableName);
      if (cloudData.length > 0) {
        const simplified = cloudData.map(({ id, user_id, created_at, ...rest }) => rest);
        localStorage.setItem(localKey, JSON.stringify(simplified));
      }
    } catch (e) {
      console.error(`Sync error ${tableName}:`, e);
    }
  }
}

// ══════════════════════════════════════════════════════════════
//  AUTO-SYNC (guarda en cloud cada vez que se modifica local)
// ══════════════════════════════════════════════════════════════

let _sbSyncQueue = [];
let _sbSyncTimer = null;

function sbQueueSync(table, operation, data) {
  _sbSyncQueue.push({ table, operation, data, ts: Date.now() });
  if (!_sbSyncTimer) {
    _sbSyncTimer = setTimeout(_sbProcessSyncQueue, 2000);
  }
}

async function _sbProcessSyncQueue() {
  _sbSyncTimer = null;
  if (!sbIsConfigured() || !(await sbGetUser())) {
    _sbSyncQueue = [];
    return;
  }

  const batch = _sbSyncQueue.splice(0, 20);
  for (const item of batch) {
    try {
      if (item.operation === 'upsert') {
        const user = await sbGetUser();
        if (!user) continue;
        const sb = _getSupabase();
        if (!sb) continue;
        const row = { ...item.data, user_id: user.id };
        const conflictCol = (item.table === 'presupuestos' || item.table === 'ordenes_trabajo') ? 'user_id,numero' : 'user_id,nombre';
        const idCol = (item.table === 'presupuestos' || item.table === 'ordenes_trabajo') ? 'numero' : 'nombre';
        const matchVal = row[idCol];
        const { error } = await sb.from(item.table).upsert(row, { onConflict: conflictCol });
        if (error) {
          if (matchVal) {
            const { data: existing } = await sb.from(item.table).select('id').eq('user_id', user.id).eq(idCol, matchVal).maybeSingle();
            if (existing) {
              await sb.from(item.table).update(row).eq('id', existing.id);
            } else {
              await sb.from(item.table).insert(row);
            }
          } else {
            await sb.from(item.table).insert(row);
          }
        }
      } else if (item.operation === 'delete') {
        const user = await sbGetUser();
        if (!user) continue;
        const sb = _getSupabase();
        if (!sb) continue;
        const idCol = (item.table === 'presupuestos' || item.table === 'ordenes_trabajo') ? 'numero' : 'nombre';
        const matchVal = item.data?.[idCol] || item.data?.nombre || item.data?.alias || '';
        if (matchVal) {
          await sb.from(item.table).delete().eq('user_id', user.id).eq(idCol, matchVal);
        }
      }
    } catch (e) {
      console.error('Auto-sync error:', e);
    }
  }

  if (_sbSyncQueue.length > 0) {
    _sbSyncTimer = setTimeout(_sbProcessSyncQueue, 3000);
  }
}
