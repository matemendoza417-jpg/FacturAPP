// ============================================================
//  app.js — FacturAPP v3 (Refactored)
//  · Telegram: bot central + deep-link de vinculación
//  · Órdenes de Trabajo: listado estilo facturas/presupuestos
//  · Animaciones premium en toda la UI
//  · Bug fix presupuestos heredado de presupuestos.js v4
// ============================================================

// ── BOT CENTRAL ───────────────────────────────────────────────
// Token cargado desde config.js (ofuscado). Ver js/config.js
function _getTgBotToken() {
  return typeof FacturAPPConfig !== 'undefined' ? FacturAPPConfig.TG_BOT_TOKEN : '';
}

// ── STORAGE KEYS ──────────────────────────────────────────────
const KEY = {
  OT:    'ordenes_trabajo_v2',
  PRES:  'facturapp_presupuestos_v3',
  FACT:  'facturapp_file_index',
};

function app_isOT(nombre) {
  return nombre && nombre.startsWith('Orden_Trabajo');
}

// ── ESTADO GLOBAL ─────────────────────────────────────────────
const state = {
  currentScreen: 'screen-home',
  screenHistory: [],
  step: 1,
  maxStep: 5,
  emisor:     null,
  cliente:    null,
  productos:  [],
  materiales: [],
  _editando:             null,
  _editandoPresupuesto:  null,
  _lastPdf:              null,
  docType:          'factura',
  _skipResetNueva:  false,
};

// ══════════════════════════════════════════════════════════════
//  AUTH — Login / Register / Skip
// ══════════════════════════════════════════════════════════════

function _showAuthScreen() {
  const el = document.getElementById('auth-screen');
  if (el) el.classList.remove('hidden');
}

function _hideAuthScreen() {
  const el = document.getElementById('auth-screen');
  if (el) el.classList.add('hidden');
}

function toggleAuthForm() {
  const login = document.getElementById('auth-form-login');
  const reg   = document.getElementById('auth-form-register');
  if (login) login.classList.toggle('hidden');
  if (reg)   reg.classList.toggle('hidden');
  _clearAuthError();
  Sound.tap();
}

function _showAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function _clearAuthError() {
  const el = document.getElementById('auth-error');
  if (el) el.classList.add('hidden');
}

async function handleAuthLogin() {
  const email = (document.getElementById('auth-email')?.value || '').trim();
  const pass  = document.getElementById('auth-password')?.value || '';
  if (!email || !pass) { _showAuthError('Completá email y contraseña'); Sound.error(); return; }

  const btn = document.getElementById('auth-login-btn');
  if (btn) btn.textContent = 'Ingresando…';

  try {
    await sbSignIn(email, pass);
    _hideAuthScreen();
    showToast('Sesión iniciada ✓');
    Sound.success();
    await sbSyncCloudToLocal();
    _refreshCurrentScreen();
  } catch (e) {
    _showAuthError(e.message || 'Error al iniciar sesión');
    Sound.error();
  } finally {
    if (btn) btn.textContent = 'Iniciar sesión';
  }
}

async function handleAuthRegister() {
  const email = (document.getElementById('auth-email-reg')?.value || '').trim();
  const pass  = document.getElementById('auth-password-reg')?.value || '';
  if (!email || !pass) { _showAuthError('Completá email y contraseña'); return; }
  if (pass.length < 6) { _showAuthError('La contraseña debe tener 6+ caracteres'); return; }

  const btn = document.getElementById('auth-register-btn');
  if (btn) btn.textContent = 'Creando…';

  try {
    await sbSignUp(email, pass);
    _showAuthError('✅ Revisa tu email para confirmar la cuenta');
    Sound.success();
    setTimeout(() => toggleAuthForm(), 2000);
  } catch (e) {
    _showAuthError(e.message || 'Error al registrar');
    Sound.error();
  } finally {
    if (btn) btn.textContent = 'Crear cuenta';
  }
}

function skipAuth() {
  _hideAuthScreen();
  localStorage.setItem('sb_skip_auth', '1');
  Sound.tap();
}

function showAuthLogin() {
  document.getElementById('auth-form-login')?.classList.remove('hidden');
  document.getElementById('auth-form-register')?.classList.add('hidden');
  document.getElementById('auth-form-recovery')?.classList.add('hidden');
  _clearAuthError();
  Sound.tap();
}

function showAuthRecovery() {
  document.getElementById('auth-form-login')?.classList.add('hidden');
  document.getElementById('auth-form-register')?.classList.add('hidden');
  document.getElementById('auth-form-recovery')?.classList.remove('hidden');
  _clearAuthError();
  Sound.tap();
}

async function handleAuthRecovery() {
  const email = (document.getElementById('auth-email-recovery')?.value || '').trim();
  if (!email) { _showAuthError('Ingresá tu email'); return; }

  const btn = document.getElementById('auth-recovery-btn');
  if (btn) btn.textContent = 'Enviando…';

  try {
    await sbResetPassword(email);
    _showAuthError('✅ Revisa tu email para restablecer la contraseña');
    setTimeout(() => showAuthLogin(), 3000);
  } catch (e) {
    _showAuthError(e.message || 'Error al enviar');
  } finally {
    if (btn) btn.textContent = 'Enviar link de recuperación';
  }
}

async function handleLogout() {
  Sound.tap();
  showConfirmDialog('🚪', 'Cerrar sesión', '¿Seguro que querés cerrar sesión?', async () => {
    await sbSignOut();
    localStorage.setItem('sb_skip_auth', '1');
    showToast('Sesión cerrada');
    _showAuthScreen();
    showAuthLogin();
  }, null);
}

async function handleDeleteAccount() {
  Sound.tap();
  showConfirmDialog('⚠️', 'Eliminar cuenta', 'Esto eliminará TODOS tus datos permanentemente. ¿Estás seguro?', async () => {
    showConfirmDialog('💀', 'Última confirmación', 'Esta acción no se puede deshacer. ¿Eliminar todo?', async () => {
      try {
        showToast('Eliminando cuenta…');
        await sbDeleteAccount();
        localStorage.clear();
        showToast('Cuenta eliminada');
        _showAuthScreen();
        showAuthLogin();
      } catch (e) {
        showToast('Error: ' + (e.message || 'No se pudo eliminar'));
      }
    }, null);
  }, null);
}

function toggleSound() {
  const enabled = Sound.toggle();
  const icon = document.getElementById('soundIcon');
  if (icon) {
    if (enabled) {
      icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>';
    } else {
      icon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>';
    }
  }
  showToast(enabled ? '🔊 Sonido activado' : '🔇 Sonido desactivado');
}

function _refreshCurrentScreen() {
  try {
    if (state.currentScreen === 'screen-home') renderHome();
    else if (state.currentScreen === 'screen-facturas') renderFacturas();
    else if (state.currentScreen === 'screen-emisores') renderEmisorList();
    else if (state.currentScreen === 'screen-clientes') renderClienteList();
    else if (state.currentScreen === 'screen-catalogo') renderCatalogoList();
    else if (state.currentScreen === 'screen-series') renderSeriesList();
    else if (state.currentScreen === 'screen-rectificativas') renderRectificativasList();
    else if (state.currentScreen === 'screen-historial') renderHistorial();
    else if (state.currentScreen === 'screen-presupuestos') renderPresupuestos();
    else if (state.currentScreen === 'screen-orden-trabajo') renderOrdenesTrabajo();
  } catch (_) {}
}

// ── ÓRDENES DE TRABAJO — persistencia ────────────────────────
const OT_DB_KEY = 'ordenes_trabajo_v2';

function getOrdenes() {
  try {
    const raw = localStorage.getItem(OT_DB_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  // Migrar desde clave antigua
  try {
    const old = JSON.parse(localStorage.getItem('ordenes_trabajo') || '[]');
    if (Array.isArray(old) && old.length) return old;
  } catch (_) {}
  return [];
}

function saveOrdenes(lista) {
  localStorage.setItem(OT_DB_KEY, JSON.stringify(Array.isArray(lista) ? lista : []));
  if (typeof _cloudSync === 'function' && typeof sbIsConfigured === 'function' && sbIsConfigured()) {
    (Array.isArray(lista) ? lista : []).forEach(item => {
      const plain = { ...item };
      delete plain.productos;
      delete plain.materiales;
      _cloudSync('ordenes_trabajo', plain);
    });
  }
}

// ── SPLASH → APP ──────────────────────────────────────────────
window.addEventListener('load', () => {
  const today = new Date().toISOString().split('T')[0];
  const fechaEl = document.getElementById('fac-fecha');
  if (fechaEl) fechaEl.value = today;

  // Verificar licencia — BLOQUEO TOTAL si no está activada
  const sinLicencia = typeof isAppLicensed === 'function' && !isAppLicensed();

  // Verificar actualizaciones
  try {
    if (typeof initUpdateChecker === 'function') initUpdateChecker();
  } catch(_) {}

  // Migración de esquema + restauración si datos vacíos
  try { migrarDatosSiEsNecesario(); } catch (e) { console.warn('Migración:', e.message); }

  // BUG FIX: reducir splash a 900ms, la barra CSS se sincroniza
  setTimeout(() => {
    var splash = document.getElementById('splash');
    var app = document.getElementById('app');
    if (splash) splash.classList.add('fade-out');
    if (sinLicencia) {
      // Sin licencia: ocultar app, mostrar modal de licencia
      if (app) app.classList.add('hidden');
      setTimeout(() => showLicenseScreen(), 800);
    } else {
      // Con licencia: cargar app normal
      if (app) app.classList.remove('hidden');
      requestAnimationFrame(() => {
        renderEmisorList();
      });
      if (sbIsConfigured() && !localStorage.getItem('sb_skip_auth')) {
        sbGetUser().then(user => {
          if (!user) _showAuthScreen();
        }).catch(() => {});
      }
    }
  }, 900);

  // Iniciar backup automático
  try { iniciarAutoBackup(); } catch (e) { console.warn('Backup auto:', e.message); }

  // Auto-generar facturas recurrentes vencidas
  try { autoGenerarRecurrentes(); } catch (e) { console.warn('Recurrentes:', e.message); }

  // Enviar recordatorios de cobro pendientes por Telegram
  setTimeout(() => {
    try { enviarRecordatoriosPendientes(); } catch (e) { console.warn('Recordatorios:', e.message); }
  }, 3000);

  // Renderizar dashboard mini en home
  requestAnimationFrame(() => {
    if (state.currentScreen === 'screen-home') renderDashboardMini();
  });

  document.addEventListener('deviceready', _registrarBackButton, false);
  setTimeout(_registrarBackButton, 500);
});

const _HOME_GREETINGS = [
  { title: '¿Qué hacemos hoy?',                sub: 'Todo listo para facturar.' },
  { title: 'Buenos días, jefe.',               sub: 'Tu siguiente factura te espera.' },
  { title: '¡A generar ingresos!',             sub: 'Crea una factura en menos de un minuto.' },
  { title: 'Hora de ponerse al día.',          sub: 'Revisa tus facturas y órdenes pendientes.' },
  { title: '¿Nuevo cliente hoy?',              sub: 'Crea el presupuesto antes de que pase el día.' },
  { title: 'Todo bajo control.',               sub: 'Gestiona, factura y cobra sin complicaciones.' },
  { title: 'Un día productivo empieza aquí.',  sub: 'Elige una acción para arrancar.' },
  { title: 'Bienvenido de nuevo.',             sub: 'Tus facturas están donde las dejaste.' },
  { title: '¿Qué trabajo cerramos hoy?',      sub: 'Convierte tu trabajo en una factura.' },
  { title: 'Simple, rápido, profesional.',     sub: 'Facturas que cobran solas.' },
  { title: 'El dinero no llega solo.',         sub: 'Envía esa factura que llevas días posponiendo.' },
  { title: 'Cada orden, un ingreso.',          sub: 'Cierra el trabajo y genera el PDF ahora.' },
  { title: 'Menos papel, más cobros.',         sub: 'FacturAPP lo hace por ti.' },
  { title: '¿Tienes facturas pendientes?',     sub: 'Este es el momento de ponerse al día.' },
  { title: 'Hoy también vas a cobrar.',        sub: 'Crea tu factura en segundos.' },
  { title: 'Profesional desde el primer clic.',sub: 'Facturas con tu imagen de marca.' },
  { title: 'Tu negocio, organizado.',          sub: 'Presupuestos, órdenes y facturas en un solo lugar.' },
  { title: '¿Ya enviaste la factura?',         sub: 'Si no la envías, no cobras. Hazlo ahora.' },
  { title: 'Trabaja duro, factura más.',       sub: 'Todo queda registrado aquí.' },
  { title: 'Otra jornada, otro ingreso.',      sub: 'Registra tus trabajos y emite la factura.' },
  { title: '¿Cuánto has facturado hoy?',      sub: 'Comprueba tu historial de IVA para saberlo.' },
  { title: 'Sin facturas no hay negocio.',     sub: 'Empieza por crear la primera del día.' },
  { title: 'Rápido como siempre.',             sub: 'Tu factura lista en menos de un minuto.' },
  { title: 'Hola de nuevo.',                  sub: 'Listo para crear, gestionar y cobrar.' },
  { title: 'Tu tiempo vale oro.',              sub: 'FacturAPP te ahorra el papeleo.' },
  { title: '¿Nuevo presupuesto?',              sub: 'Ciérralo antes de que el cliente cambie de opinión.' },
  { title: 'Orden, claridad y cobro.',         sub: 'Así de sencillo es trabajar con FacturAPP.' },
  { title: '¿Listo para cerrar la semana?',    sub: 'Revisa y envía tus facturas pendientes.' },
  { title: 'Cada día cuenta.',                sub: 'No dejes para mañana la factura de hoy.' },
  { title: 'Profesionales facturan así.',     sub: 'Sin complicaciones, directo al grano.' },
  { title: 'Vamos con todo.',                 sub: 'Empieza facturando y el resto va solo.' },
  { title: 'Tus clientes esperan.',            sub: 'Envía la factura y cobra más rápido.' },
  { title: 'Facturar nunca fue tan fácil.',   sub: 'Toca, completa y envía. Así de simple.' },
  { title: '¿Empezamos?',                      sub: 'Elige una opción y arrancamos.' },
  { title: 'Un buen día empieza cobrando.',   sub: 'No hay mejor motivación que ver el cobro.' },
  { title: 'Tu trabajo tiene valor.',          sub: 'Cobra lo que mereces con una factura.' },
  { title: 'Sin excusas hoy.',                sub: 'Factura en un toque y a cobrar.' },
  { title: 'Más facturas, más cobros.',        sub: 'Cada factura es dinero en tu bolsillo.' },
  { title: 'Organizado es más rentable.',      sub: 'Lleva el control de todo desde aquí.' },
  { title: 'Hora de facturar.',                sub: 'Tus ingresos dependen de esto.' },
  { title: 'Aquí manda el jefe.',              sub: 'Tú pones las reglas, FacturAPP ejecuta.' },
  { title: '¿Ya revisaste tus pendientes?',   sub: 'Hay facturas por enviar y cobrar.' },
  { title: 'Simple y directo.',                sub: 'Sin vueltas, solo factura.' },
  { title: '¡A darle!',                        sub: 'Tu facturación no se detiene.' },
  { title: 'Dinero entrando.',                 sub: 'Cada factura generada es un cobro más cerca.' },
  { title: 'Cobra hoy, duerme tranquilo.',    sub: 'Envía la factura antes del cierre.' },
];

function startHomeExperience() {
  const welcome   = document.getElementById('home-welcome');
  const dashboard = document.getElementById('home-dashboard');
  if (!welcome || !dashboard) return;
  if (welcome.classList.contains('launching') || welcome.classList.contains('hidden')) return;
  Sound.welcome();

  welcome.classList.add('launching');
  setTimeout(() => {
    welcome.classList.add('hidden');
    dashboard.classList.remove('hidden');
    dashboard.classList.add('home-dashboard-enter');
    if (typeof calcShow === 'function') calcShow();

    // Saludo aleatorio
    const g = _HOME_GREETINGS[Math.floor(Math.random() * _HOME_GREETINGS.length)];
    const titleEl = document.getElementById('hero-greeting');
    const subEl   = document.getElementById('hero-sub');
    if (titleEl) titleEl.textContent = g.title;
    if (subEl)   subEl.textContent   = g.sub;

    // Dashboard mini
    try { renderDashboardMini(); } catch (e) {}
  }, 620);
}

// ── BOTÓN ATRÁS ANDROID ───────────────────────────────────────
let _lastBackPressTime    = 0;
let _backButtonRegistered = false;

function _registrarBackButton() {
  if (_backButtonRegistered) return;
  try {
    const AppPlugin = window.Capacitor?.Plugins?.App;
    if (AppPlugin && typeof AppPlugin.addListener === 'function') {
      AppPlugin.addListener('backButton', function(ev) {
        if (ev && ev.canGoBack === false) ev.preventDefault && ev.preventDefault();
        _handleAndroidBack();
      });
      _backButtonRegistered = true;
      return;
    }
  } catch (e) {
    console.warn('Capacitor App plugin no disponible:', e);
  }
  // Fallback Cordova-style (only if Capacitor not available)
  document.addEventListener('backbutton', function(e) {
    e.preventDefault();
    _handleAndroidBack();
  }, false);
  _backButtonRegistered = true;
}

function _handleAndroidBack() {
  var overlay = document.getElementById('modal-overlay');
  if (overlay && !overlay.classList.contains('hidden')) { closeModal(); return; }
  var editForm = document.getElementById('edit-item-form');
  if (editForm) { editForm.remove(); return; }
  // Si estamos en un paso > 1 de facturación/presupuesto/orden, retroceder un paso
  if (state.currentScreen === 'screen-nueva' && state.step > 1) { prevStep(); return; }
  if (state.currentScreen === 'screen-orden-nueva' && (window._otStep || 1) > 1) { otPrevStep(); return; }
  if (state.screenHistory.length > 0) { goBack(); return; }
  // Estamos en home: doble toque para salir
  var now = Date.now();
  if (now - _lastBackPressTime < 2000) {
    try {
      var AppPlugin = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
      if (AppPlugin && typeof AppPlugin.exitApp === 'function') {
        AppPlugin.exitApp();
      } else if (navigator.app && navigator.app.exitApp) {
        navigator.app.exitApp();
      }
    } catch (e) {}
  } else {
    _lastBackPressTime = now;
    showToast('Pulsa otra vez para salir');
  }
}

// ── NAVEGACIÓN ────────────────────────────────────────────────
function navigate(screenId) {
  var curr = document.getElementById(state.currentScreen);
  var next = document.getElementById(screenId);
  if (!next) return;
  Sound.navigate();

  if (curr) { curr.classList.add('zoom-exit'); setTimeout(function(){ curr.classList.remove('active', 'zoom-exit'); }, 360); }
  next.classList.remove('zoom-enter');
  void next.offsetWidth;
  next.classList.add('active', 'zoom-enter');
  setTimeout(() => next.classList.remove('zoom-enter'), 520);

  state.screenHistory.push(state.currentScreen);
  state.currentScreen = screenId;

  const btnBack    = document.getElementById('btnBack');
  const logo       = document.getElementById('topbarLogo');
  const titleSpan  = document.getElementById('topbarTitleText');

  if (screenId === 'screen-home') {
    if (btnBack) btnBack.classList.add('hidden');
    if (logo)      logo.style.display  = 'flex';
    if (titleSpan) titleSpan.style.display = 'none';
  } else {
    if (btnBack) btnBack.classList.remove('hidden');
    if (logo)      logo.style.display  = 'none';
    if (titleSpan) {
      titleSpan.textContent    = _tituloPantalla(screenId);
      titleSpan.style.display  = 'block';
    }
  }

  if (screenId === 'screen-nueva') {
    updateWizardLabels();
    if (!state._skipResetNueva) resetFactura();
    state._skipResetNueva = false;
    goToStep(1);
  } else if (screenId === 'screen-emisores')         { _clearSearchEmisores(); renderMgmtEmisores(); }
  else if (screenId === 'screen-clientes')           { _clearSearchClientes(); renderMgmtClientes(); }
  else if (screenId === 'screen-historial')          renderHistorial();
  else if (screenId === 'screen-facturas')           { _clearSearchFacturas(); renderFacturas(); }
  else if (screenId === 'screen-presupuestos')       renderPresupuestos();
  else if (screenId === 'screen-exportar')           renderExportar();
  else if (screenId === 'screen-orden-trabajo')      renderOrdenesListado();
  else if (screenId === 'screen-orden-nueva')        initOrdenTrabajo();
  else if (screenId === 'screen-telegram-config')    renderTelegramConfig();
  else if (screenId === 'screen-series')             renderSeriesList();
  else if (screenId === 'screen-catalogo')          renderCatalogoList();
  else if (screenId === 'screen-rectificativas')    renderRectificativas();
  else if (screenId === 'screen-recurrentes')       renderRecurrentes();
  else if (screenId === 'screen-rec-nueva')         { updateWizardLabels(); renderEmisorList(); renderClienteList(); renderProductosList(); renderMaterialesList(); }
  else if (screenId === 'screen-gastos')            renderGastos();
}

function _tituloPantalla(id) {
  if (id === 'screen-nueva') {
    return state.docType === 'presupuesto' ? 'Nuevo Presupuesto' : 'Nueva Factura';
  }
  const titles = {
    'screen-home':             'FacturAPP',
    'screen-nueva':            'Nueva Factura',
    'screen-emisores':         'Emisores',
    'screen-nuevo-emisor':     'Nuevo Emisor',
    'screen-clientes':         'Clientes',
    'screen-nuevo-cliente':    'Nuevo Cliente',
    'screen-historial':        'Historial IVA',
    'screen-facturas':         'Facturas',
    'screen-presupuestos':     'Presupuestos',
    'screen-exportar':         'Exportar Datos',
    'screen-series':           'Series de Numeración',
    'screen-catalogo':         'Catálogo de Productos',
    'screen-rectificativas':   'Notas de Crédito',
    'screen-orden-trabajo':    'Órdenes de Trabajo',
    'screen-orden-nueva':      'Nueva Orden',
    'screen-telegram-config':  'Vincular Telegram',
    'screen-recurrentes':      'Facturas Recurrentes',
    'screen-rec-nueva':        'Nueva Recurrente',
    'screen-gastos':           'Gastos Deducibles',
  };
  return titles[id] || 'FacturAPP';
}

function goBack() {
  if (state.screenHistory.length === 0) return;
  const prev = state.screenHistory.pop();
  Sound.back();
  var curr = document.getElementById(state.currentScreen);
  var next = document.getElementById(prev);
  if (!next) return;

  if (curr) { curr.classList.add('zoom-exit'); setTimeout(function(){ curr.classList.remove('active', 'zoom-exit'); }, 360); }
  next.classList.remove('zoom-enter');
  void next.offsetWidth;
  next.classList.add('active', 'zoom-enter');
  setTimeout(() => next.classList.remove('zoom-enter'), 520);
  state.currentScreen = prev;

  const logo      = document.getElementById('topbarLogo');
  const titleSpan = document.getElementById('topbarTitleText');
  if (prev === 'screen-home') {
    var bb = document.getElementById('btnBack');
    if (bb) bb.classList.add('hidden');
    if (logo)      logo.style.display  = 'flex';
    if (titleSpan) titleSpan.style.display = 'none';
  } else {
    if (logo)      logo.style.display  = 'none';
    if (titleSpan) {
      titleSpan.textContent    = _tituloPantalla(prev);
      titleSpan.style.display  = 'block';
    }
  }

  if (prev === 'screen-emisores') renderMgmtEmisores();
  else if (prev === 'screen-clientes') renderMgmtClientes();
  else if (prev === 'screen-facturas') { _clearSearchFacturas(); renderFacturas(); }
  else if (prev === 'screen-presupuestos') renderPresupuestos();
  else if (prev === 'screen-orden-trabajo') renderOrdenesListado();
  else if (prev === 'screen-historial') renderHistorial();
  else if (prev === 'screen-series') renderSeriesList();
  else if (prev === 'screen-catalogo') renderCatalogoList();
  else if (prev === 'screen-rectificativas') renderRectificativas();
  else if (prev === 'screen-recurrentes') renderRecurrentes();
  else if (prev === 'screen-gastos') renderGastos();
}

// ── RESET WIZARD ──────────────────────────────────────────────
function resetFactura() {
  state.emisor     = null;
  state.cliente    = null;
  state.productos  = [];
  state.materiales = [];
  state._editando            = null;
  state._editandoPresupuesto = null;

  const numEl   = document.getElementById('fac-num');
  const fechaEl = document.getElementById('fac-fecha');
  const ivaEl   = document.getElementById('fac-iva');
  const chkRet  = document.getElementById('chk-retencion');
  const retField = document.getElementById('retencion-field');
  const retEl   = document.getElementById('fac-ret');

  if (numEl)   numEl.value   = state.docType === 'presupuesto' ? sugerirNumeroPresupuesto() : sugerirNumeroFactura();
  if (fechaEl) fechaEl.value = new Date().toISOString().split('T')[0];
  if (ivaEl)   ivaEl.value   = '21';
  if (chkRet)  chkRet.checked = false;
  if (retField) retField.classList.add('hidden');
  if (retEl)   retEl.value   = '19';

  renderProductosList();
  renderMaterialesList();
}

function openFacturaWizard() {
  state.docType         = 'factura';
  state._skipResetNueva = false;
  Sound.click();
  if (!state.screenHistory.includes('screen-facturas') && state.currentScreen !== 'screen-facturas') {
    state.screenHistory.push(state.currentScreen);
  }
  navigate('screen-nueva');
}

function updateWizardLabels() {
  const isPres   = state.docType === 'presupuesto';
  const noun     = isPres ? 'Presupuesto' : 'Factura';
  const step2    = document.querySelector('.step[data-step="2"] small');
  const title2   = document.querySelector('#step-2 .section-header h3');
  const labelNum = document.getElementById('fac-num')?.closest('.form-row')?.querySelector('label');
  const genBtn   = document.querySelector('#step-5 .btn-generate');
  const summaryTitle = document.querySelector('#step-5 .section-header h3');
  const titleSpan    = document.getElementById('topbarTitleText');

  if (step2)      step2.textContent = noun;
  if (title2)     title2.textContent = `Datos del ${noun}`;
  if (labelNum)   labelNum.textContent = `Número de ${noun.toLowerCase()}`;
  if (summaryTitle) summaryTitle.textContent = isPres ? 'Resumen y Guardar PDF' : 'Resumen y Generar PDF';
  if (genBtn)     genBtn.innerHTML = `<span>📄</span> ${isPres ? 'Guardar Presupuesto PDF' : 'Generar y Descargar PDF'}`;
  if (titleSpan && state.currentScreen === 'screen-nueva') titleSpan.textContent = `Nuevo ${noun}`;
}

function sugerirNumeroFactura() {
  const serie = getSerieActiva();
  if (serie) {
    return sugerirNumeroSerie(serie.id);
  }
  // Fallback al sistema antiguo
  const primero  = localStorage.getItem('fac_primer_num')     || '001';
  const ultimo   = parseInt(localStorage.getItem('fac_ultimo_segundo') || '0');
  return `${primero} - ${String(ultimo + 1).padStart(2, '0')}`;
}

function guardarUltimoNumeroFactura(numFactura) {
  // Intentar guardar en el nuevo sistema de series
  const serie = getSerieActiva();
  if (serie) {
    incrementarNumeroSerie(serie.id, numFactura);
    return;
  }
  // Fallback al sistema antiguo
  const m = String(numFactura).match(/^(.+?)\s*-\s*(\d+)$/);
  if (m) {
    localStorage.setItem('fac_primer_num',     m[1].trim());
    localStorage.setItem('fac_ultimo_segundo', String(parseInt(m[2])));
  }
}

// ── STEPS ────────────────────────────────────────────────────
function goToStep(n) {
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  var stepEl = document.getElementById('step-' + n);
  Sound.step();
  if (stepEl) stepEl.classList.add('active');
  state.step = n;

  document.querySelectorAll('.step').forEach(el => {
    const s = +el.dataset.step;
    el.classList.remove('active', 'done');
    if (s === n) el.classList.add('active');
    if (s < n)  el.classList.add('done');
  });

  var btnBack = document.getElementById('btnStepBack');
  var btnNext = document.getElementById('btnStepNext');
  if (btnBack) btnBack.style.visibility = n === 1 ? 'hidden' : 'visible';
  if (btnNext) btnNext.textContent = n === 5
    ? (state.docType === 'presupuesto' ? '✓ Guardar' : '✓ Generar')
    : 'Siguiente →';

  if (n === 1) renderEmisorList();
  if (n === 3) renderClienteList();
  if (n === 5) renderResumen();
}

function nextStep() {
  if (!validateStep(state.step)) return;
  if (state.step === 5) { generarPDF(); return; }
  goToStep(state.step + 1);
}

function prevStep() {
  if (state.step > 1) { Sound.stepBack(); goToStep(state.step - 1); }
}

function validateStep(step) {
  if (step === 1 && !state.emisor)   { showToast('Seleccioná un emisor');   return false; }
  if (step === 2) {
    const num = document.getElementById('fac-num').value.trim();
    if (!num) { showToast(state.docType === 'presupuesto' ? 'Ingresá el número de presupuesto' : 'Ingresá el número de factura'); return false; }
  }
  if (step === 3 && !state.cliente)  { showToast('Seleccioná un cliente');  return false; }
  if (step === 4 && state.productos.length === 0) { showToast('Agregá al menos un producto'); return false; }
  return true;
}

// ── STEP 1: EMISORES ─────────────────────────────────────────
function renderEmisorList() {
  const container = document.getElementById('emisores-list');
  if (!container) return;
  const emisores  = getEmisores();
  container.innerHTML = '';

  emisores.forEach(em => {
    const div = document.createElement('div');
    div.className = 'select-card' + (state.emisor?.nombre === em.nombre ? ' selected' : '');
    div.setAttribute('role', 'button');
    div.setAttribute('aria-label', `Seleccionar emisor ${em.nombre}`);
    div.innerHTML = `
      <div class="select-card-body">
        <strong>${escapeHtml(em.nombre)}</strong>
        <small>${escapeHtml(em.cp_ciudad)} · ${escapeHtml(em.doi)}</small>
      </div>
      ${em._predefined ? '<span class="select-card-badge">Predefinido</span>' : ''}
      <div class="select-check" aria-hidden="true"></div>
    `;
    div.onclick = () => selectEmisor(em);
    container.appendChild(div);
  });
}

function selectEmisor(em) {
  state.emisor = em;
  renderEmisorList();
  document.getElementById('new-emisor-form')?.classList.add('hidden');
  showToast(`Emisor: ${em.alias || em.nombre}`);
  Sound.select();
}

function showNewEmisorForm() {
  document.getElementById('new-emisor-form')?.classList.toggle('hidden');
  Sound.tap();
}

function getEmisorFormData() {
  return {
    nombre:          document.getElementById('em-nombre').value.trim(),
    direccion:       document.getElementById('em-dir').value.trim(),
    cp_ciudad:       document.getElementById('em-cp').value.trim(),
    doi:             document.getElementById('em-doi').value.trim(),
    cuenta_bancaria: document.getElementById('em-iban').value.trim(),
    alias:           document.getElementById('em-alias').value.trim(),
    logo:            state._emisorLogo || null,
  };
}

function previewEmisorLogo(input) {
  const preview = document.getElementById('em-logo-preview');
  if (!preview) return;
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      state._emisorLogo = e.target.result;
      preview.innerHTML = '<img src="' + e.target.result + '" style="max-height:48px;border-radius:6px;border:1px solid #ddd">';
    };
    reader.readAsDataURL(input.files[0]);
  } else {
    state._emisorLogo = null;
    preview.innerHTML = '';
  }
}

function validateEmisorForm(em) {
  if (!em.nombre) { showToast('El nombre es obligatorio'); return false; }
  if (!em.doi)    { showToast('El DOI es obligatorio');    return false; }
  return true;
}

function useEmisorForm() {
  const em = getEmisorFormData();
  if (!validateEmisorForm(em)) return;
  state.emisor = em;
  document.getElementById('new-emisor-form')?.classList.add('hidden');
  showToast('Emisor seleccionado');
  Sound.select();
}

function saveAndUseEmisor() {
  const em = getEmisorFormData();
  if (!validateEmisorForm(em)) return;
  if (!em.alias) em.alias = em.nombre.split(' ')[0];
  saveEmisor(em);
  state.emisor = em;
  renderEmisorList();
  document.getElementById('new-emisor-form')?.classList.add('hidden');
  showModal('✅', 'Emisor guardado', `"${em.alias}" guardado correctamente.`);
  Sound.save();
}

// ── STEP 3: CLIENTES ─────────────────────────────────────────
function renderClienteList() {
  const container = document.getElementById('clientes-list');
  if (!container) return;
  const clientes  = getClientes();
  container.innerHTML = '';

  clientes.forEach(cl => {
    const div = document.createElement('div');
    div.className = 'select-card' + (state.cliente?.nombre === cl.nombre ? ' selected' : '');
    div.setAttribute('role', 'button');
    div.setAttribute('aria-label', `Seleccionar cliente ${cl.nombre}`);
    div.innerHTML = `
      <div class="select-card-body">
        <strong>${escapeHtml(cl.nombre)}</strong>
        <small>${escapeHtml(cl.cp_ciudad)} · ${escapeHtml(cl.nif)}</small>
      </div>
      ${cl._predefined ? '<span class="select-card-badge">Predefinido</span>' : ''}
      <div class="select-check" aria-hidden="true"></div>
    `;
    div.onclick = () => selectCliente(cl);
    container.appendChild(div);
  });
}

function selectCliente(cl) {
  state.cliente = cl;
  renderClienteList();
  document.getElementById('new-cliente-form')?.classList.add('hidden');
  showToast(`Cliente: ${cl.alias || cl.nombre}`);
  Sound.select();
}

function showNewClienteForm() {
  document.getElementById('new-cliente-form')?.classList.toggle('hidden');
  Sound.tap();
}

function getClienteFormData() {
  return {
    nombre:    document.getElementById('cl-nombre').value.trim(),
    direccion: document.getElementById('cl-dir').value.trim(),
    cp_ciudad: document.getElementById('cl-cp').value.trim(),
    nif:       document.getElementById('cl-nif').value.trim(),
    alias:     document.getElementById('cl-alias').value.trim(),
  };
}

function validateClienteForm(cl) {
  if (!cl.nombre) { showToast('El nombre es obligatorio'); return false; }
  if (!cl.nif)    { showToast('El NIF es obligatorio');    return false; }
  return true;
}

function useClienteForm() {
  const cl = getClienteFormData();
  if (!validateClienteForm(cl)) return;
  state.cliente = cl;
  document.getElementById('new-cliente-form')?.classList.add('hidden');
  showToast('Cliente seleccionado');
  Sound.select();
}

function saveAndUseCliente() {
  const cl = getClienteFormData();
  if (!validateClienteForm(cl)) return;
  if (!cl.alias) cl.alias = cl.nombre.split(' ')[0];
  saveCliente(cl);
  state.cliente = cl;
  renderClienteList();
  document.getElementById('new-cliente-form')?.classList.add('hidden');
  showModal('✅', 'Cliente guardado', `"${cl.alias}" guardado correctamente.`);
}

// ── STEP 4: PRODUCTOS ────────────────────────────────────────
function addProducto()  { showItemDialog('producto'); }
function addMaterial()  { showItemDialog('material'); }

function showItemDialog(tipo) {
  const listId   = tipo === 'producto' ? 'productos-list' : 'materiales-list';
  const existing = document.getElementById(`add-form-${tipo}`);
  if (existing) { existing.remove(); return; }

  const form = document.createElement('div');
  form.className = 'add-item-form';
  form.id        = `add-form-${tipo}`;
  form.innerHTML = `
    <div class="form-row">
      <label>Descripción</label>
      <input type="text" id="inp-desc-${tipo}" placeholder="${tipo === 'producto' ? 'Servicio o trabajo realizado' : 'Material utilizado'}">
    </div>
    <div class="add-item-row">
      <div class="form-row">
        <label>Cantidad</label>
        <input type="number" id="inp-cant-${tipo}" value="1" min="0.001" step="0.5">
      </div>
      <div class="form-row">
        <label>Precio unit. (€)</label>
        <input type="number" id="inp-prec-${tipo}" value="0" min="0" step="0.01">
      </div>
    </div>
    <div class="row-btns">
      <button class="btn-secondary" onclick="document.getElementById('add-form-${tipo}').remove()">Cancelar</button>
      <button class="btn-primary" onclick="confirmAddItem('${tipo}')">Agregar</button>
    </div>
  `;

  const list = document.getElementById(listId);
  if (!list || !list.parentNode) return;
  list.parentNode.insertBefore(form, list.nextSibling);
  document.getElementById(`inp-desc-${tipo}`).focus();
}

function confirmAddItem(tipo) {
  const desc = document.getElementById(`inp-desc-${tipo}`).value.trim();
  const cant = parseFloat(document.getElementById(`inp-cant-${tipo}`).value);
  const prec = parseFloat(document.getElementById(`inp-prec-${tipo}`).value);

  if (!desc)                { showToast('La descripción es obligatoria'); return; }
  if (isNaN(cant) || cant <= 0) { showToast('Cantidad inválida');         return; }
  if (isNaN(prec) || prec < 0)  { showToast('Precio inválido');           return; }

  const item = {
    descripcion:     desc,
    cantidad:        cant,
    precio_unitario: prec,
    subtotal_linea:  Math.round(cant * prec * 100) / 100,
  };

  if (tipo === 'producto') state.productos.push(item);
  else                     state.materiales.push(item);

  document.getElementById(`add-form-${tipo}`).remove();
  renderProductosList();
  renderMaterialesList();
}

function renderProductosList() {
  const container = document.getElementById('productos-list');
  if (!container) return;
  container.innerHTML = '';
  state.productos.forEach((p, i) => container.appendChild(makeItemCard(p, i, 'producto')));
}

function renderMaterialesList() {
  const container = document.getElementById('materiales-list');
  if (!container) return;
  container.innerHTML = '';
  state.materiales.forEach((m, i) => container.appendChild(makeItemCard(m, i, 'material')));
}

function makeItemCard(item, idx, tipo) {
  const div  = document.createElement('div');
  div.className = 'item-card';
  const cant = Number.isInteger(item.cantidad) ? item.cantidad : item.cantidad.toFixed(2);
  div.innerHTML = `
    <div class="item-card-body">
      <div class="item-desc">${escapeHtml(item.descripcion)}</div>
      <div class="item-meta">${cant} × ${item.precio_unitario.toFixed(2)} €</div>
    </div>
    <div class="item-card-total">${item.subtotal_linea.toFixed(2)} €</div>
    <button class="btn-edit-item" onclick="editItem('${tipo}',${idx})" aria-label="Editar ${escapeHtml(item.descripcion)}">✏️</button>
    <button class="btn-delete"    onclick="deleteItem('${tipo}',${idx})" aria-label="Eliminar ${escapeHtml(item.descripcion)}">✕</button>
  `;
  return div;
}

function deleteItem(tipo, idx) {
  if (tipo === 'producto') state.productos.splice(idx, 1);
  else                     state.materiales.splice(idx, 1);
  renderProductosList();
  renderMaterialesList();
}

function editItem(tipo, idx) {
  const arr  = tipo === 'producto' ? state.productos : state.materiales;
  const item = arr[idx];
  if (!item) return;

  const prev = document.getElementById('edit-item-form');
  if (prev) prev.remove();

  const label = tipo === 'producto' ? 'producto' : 'material';
  const form  = document.createElement('div');
  form.className = 'add-item-form edit-item-form';
  form.id        = 'edit-item-form';
  form.innerHTML = `
    <div style="font-size:12px;font-weight:700;color:var(--red-700);text-transform:uppercase;letter-spacing:.6px;margin-bottom:10px;">
      ✏️ Editando ${label}
    </div>
    <div class="form-row">
      <label>Descripción</label>
      <input type="text" id="edit-inp-desc" value="${escapeHtml(item.descripcion)}" placeholder="Descripción">
    </div>
    <div class="add-item-row">
      <div class="form-row">
        <label>Cantidad</label>
        <input type="number" id="edit-inp-cant" value="${item.cantidad}" min="0.001" step="0.5">
      </div>
      <div class="form-row">
        <label>Precio unit. (€)</label>
        <input type="number" id="edit-inp-prec" value="${item.precio_unitario}" min="0" step="0.01">
      </div>
    </div>
    <div class="row-btns">
      <button class="btn-secondary" onclick="document.getElementById('edit-item-form').remove()">Cancelar</button>
      <button class="btn-primary" onclick="confirmEditItem('${tipo}',${idx})">Guardar</button>
    </div>
  `;

  const listId    = tipo === 'producto' ? 'productos-list' : 'materiales-list';
  const container = document.getElementById(listId);
  if (!container) return;
  const cards     = container.querySelectorAll('.item-card');
  if (cards[idx]) cards[idx].after(form);
  else            container.appendChild(form);
  document.getElementById('edit-inp-desc').focus();
}

function confirmEditItem(tipo, idx) {
  const desc = document.getElementById('edit-inp-desc').value.trim();
  const cant = parseFloat(document.getElementById('edit-inp-cant').value);
  const prec = parseFloat(document.getElementById('edit-inp-prec').value);

  if (!desc)                { showToast('La descripción es obligatoria'); return; }
  if (isNaN(cant) || cant <= 0) { showToast('Cantidad inválida');         return; }
  if (isNaN(prec) || prec < 0)  { showToast('Precio inválido');           return; }

  const item = {
    descripcion:     desc,
    cantidad:        cant,
    precio_unitario: prec,
    subtotal_linea:  Math.round(cant * prec * 100) / 100,
  };

  if (tipo === 'producto') state.productos[idx] = item;
  else                     state.materiales[idx] = item;

  document.getElementById('edit-item-form').remove();
  renderProductosList();
  renderMaterialesList();
  showToast('Ítem actualizado');
}

function toggleRetencion() {
  const chk = document.getElementById('chk-retencion');
  const field = document.getElementById('retencion-field');
  if (chk && field) field.classList.toggle('hidden', !chk.checked);
  Sound.switchClick();
}

// ── STEP 5: RESUMEN ──────────────────────────────────────────
function calcTotales() {
  const ivaEl  = document.getElementById('fac-iva');
  const chkRet = document.getElementById('chk-retencion');
  const retEl  = document.getElementById('fac-ret');
  const iva     = parseFloat(ivaEl ? ivaEl.value : 0) || 0;
  const checked = chkRet ? chkRet.checked : false;
  const retRate = parseFloat(retEl ? retEl.value : RETENCION_DEFAULT_PCT) || RETENCION_DEFAULT_PCT;

  const retencion = calcularModeloRetencion(state.emisor, chkRet, retRate);

  const subtotalProd = state.productos.reduce((a, p) => a + p.subtotal_linea, 0);
  const subtotalMat  = state.materiales.reduce((a, m) => a + m.subtotal_linea, 0);
  const base         = Math.round((subtotalProd + subtotalMat) * 100) / 100;
  const ivaImp       = Math.round(base * iva / 100 * 100) / 100;
  const retImp       = calcularImporteRetencion(retencion, base);
  const total        = Math.round((base + ivaImp - retImp) * 100) / 100;

  return { subtotalProd, subtotalMat, base, iva, ivaImp, retencion, retImp, total };
}

function renderResumen() {
  const t      = calcTotales();
  const em     = state.emisor;
  const cl     = state.cliente;
  const fechaEl = document.getElementById('fac-fecha');
  const numEl   = document.getElementById('fac-num');
  const fecha  = fechaEl ? fechaEl.value : '';
  const numFac = numEl ? numEl.value : '';
  const docLabel = state.docType === 'presupuesto' ? 'Presupuesto' : 'Factura';
  const isRectificativa = !!state._rectificativaRef;

  const formatDate = d => {
    if (!d) return '';
    const [y, m, dd] = d.split('-');
    return `${dd}/${m}/${y}`;
  };

  let retencionHtml = '';
  if (t.retencion.showInPdf === true) {
    const valRet = t.retencion.applyToTotal === true ? `-${t.retImp.toFixed(2)} €` : '';
    retencionHtml = `<div class="total-row"><span>${textoRetencionPDF(t.retencion)}</span><span>${valRet}</span></div>`;
  }

  document.getElementById('resumen-card').innerHTML = `
    <div class="summary-section">
      <h4>📄 ${docLabel}</h4>
      <div class="summary-field"><span>Número:</span><span>${escapeHtml(numFac)}</span></div>
      <div class="summary-field"><span>Fecha:</span><span>${formatDate(fecha)}</span></div>
    </div>
    <div class="summary-section">
      <h4>🏢 Emisor</h4>
      <div class="summary-field"><span>${escapeHtml(em?.nombre)}</span></div>
      <div class="summary-field"><span>${escapeHtml(em?.cp_ciudad)}</span></div>
    </div>
    <div class="summary-section">
      <h4>👤 Cliente</h4>
      <div class="summary-field"><span>${escapeHtml(cl?.nombre)}</span></div>
      <div class="summary-field"><span>${escapeHtml(cl?.cp_ciudad)}</span></div>
    </div>
    <div class="summary-section">
      <h4>📦 Productos (${state.productos.length})</h4>
      ${state.productos.map(p => `<div class="summary-field"><span>${escapeHtml(p.descripcion)}</span><span>${p.subtotal_linea.toFixed(2)} €</span></div>`).join('')}
      ${state.materiales.length > 0 ? `<h4 style="margin-top:10px">🔧 Materiales (${state.materiales.length})</h4>${state.materiales.map(m => `<div class="summary-field"><span>${escapeHtml(m.descripcion)}</span><span>${m.subtotal_linea.toFixed(2)} €</span></div>`).join('')}` : ''}
    </div>
    <div class="summary-totals">
      <div class="total-row"><span>Subtotal</span><span>${t.base.toFixed(2)} €</span></div>
      <div class="total-row"><span>IVA (${t.iva}%)</span><span>${t.ivaImp.toFixed(2)} €</span></div>
      ${retencionHtml}
      <div class="total-row main"><span>TOTAL</span><span>${t.total.toFixed(2)} €</span></div>
    </div>
    ${!isRectificativa && state.docType === 'factura' ? `
    <div class="summary-section" style="border-bottom:none">
      <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
        <input type="checkbox" id="chk-recordatorio" style="width:18px;height:18px;accent-color:var(--red-700)" />
        <span style="font-size:13px;color:var(--grey-700)">📅 Enviar recordatorio de cobro por Telegram en 30 días</span>
      </label>
    </div>` : ''}
  `;
}

// ── GENERAR PDF ───────────────────────────────────────────────
async function generarPDF() {
  if (state.docType === 'presupuesto') { presupuestoGuardarDesdeWizard(); return; }
  if (state._editando) {
    showConfirmDialog(
      '✏️', '¿Sobrescribir factura?',
      `Ya existe "${state._editando}". ¿Deseas sobrescribirla o crear una nueva?`,
      () => _doGenerarPDF(state._editando),
      () => { state._editando = null; _doGenerarPDF(); }
    );
    return;
  }
  await _doGenerarPDF();
}

async function _doGenerarPDF(sobrescribirNombre = null) {
  const t        = calcTotales();
  Sound.generate();
  const fechaRaw = document.getElementById('fac-fecha').value;
  const [y, m, d] = fechaRaw.split('-');
  const fechaFmt  = `${d}/${m}/${y}`;
  const numFac    = document.getElementById('fac-num').value.trim();

  const isRectificativa = !!state._rectificativaRef;

  const datos = {
    emisor:            state.emisor,
    cliente:           state.cliente,
    fecha:             fechaFmt,
    fechaRaw,
    num_factura:       numFac,
    documento_titulo:  isRectificativa ? 'NOTA DE CRÉDITO' : 'FACTURA',
    rectificativa_ref: state._rectificativaRef || '',
    nombre_cliente:    state.cliente.nombre,
    dir_cliente:       state.cliente.direccion,
    cp_ciudad_cliente: state.cliente.cp_ciudad,
    nif_cliente:       state.cliente.nif,
    cuenta_bancaria:   state.emisor.cuenta_bancaria || '',
    productos:         state.productos,
    materiales:        state.materiales,
    iva:               t.iva,
    subtotal:          t.base,
    iva_importe:       t.ivaImp,
    retencion:         t.retencion,
    retencion_importe: t.retImp,
    total:             t.total,
  };

  guardarUltimoNumeroFactura(numFac);
  saveIvaHistory({
    num_factura:       numFac,
    fecha:             fechaFmt,
    subtotal:          t.base,
    iva_pct:           t.iva,
    iva_importe:       t.ivaImp,
    retencion_pct:     t.retencion.rate,
    retencion_importe: t.retImp,
    retencion_show:    t.retencion.showInPdf,
    retencion_apply:   t.retencion.applyToTotal,
    total:             t.total,
  });

  let pdfData;
  try {
    pdfData = await generarPDFBlob(datos, isRectificativa ? `Rectificativa_${numFac}` : `Factura_${numFac}`);
  } catch (err) {
    showModal('❌', 'Error al generar PDF', `No se pudo crear el PDF: ${err.message}`);
    return;
  }
  state._lastPdf = pdfData;
  state._rectificativaRef = null;

  if (sobrescribirNombre) {
    try { await eliminarFacturaPDF(sobrescribirNombre); } catch (e) {}
  }

  showToast('Guardando PDF…');
  try {
    const res = await guardarFacturaPDF(pdfData.base64Data, pdfData.nombre, {
      num_factura: numFac,
      cliente:     state.cliente.nombre,
      emisor:      state.emisor.nombre,
      fecha:       fechaFmt,
      total:       t.total,
    }, datos);
    if (res.ok) showToast(`✅ Guardado en ${res.ruta}`);

    // Si es rectificativa, guardar en su propia lista
    if (isRectificativa) {
      const rects = _getRectCache();
      rects.unshift({
        nombre:          pdfData.nombre,
        num_factura:     numFac,
        cliente:         state.cliente.nombre,
        emisor:          state.emisor.nombre,
        fecha:           fechaFmt,
        total:           t.total,
        factura_original: state._rectificativaRef || '',
      });
      _saveRectCache(rects);
    }
  } catch (e) {
    console.error('Error guardando PDF:', e);
    showToast('⚠️ PDF generado pero no guardado en disco');
  }

  state._editando = null;
  // Volver al listado correcto
  if (isRectificativa) {
    navigate('screen-rectificativas');
  } else if (state.screenHistory.includes('screen-facturas')) {
    navigate('screen-facturas');
  }
  Sound.save();
  setTimeout(() => preguntarTelegram(pdfData), 600);

  // Recordatorio de cobro: si el usuario activó el checkbox
  const chkReminder = document.getElementById('chk-recordatorio');
  if (chkReminder && chkReminder.checked) {
    crearRecordatorioCobro(numFac, state.cliente.nombre, t.total, fechaFmt);
    showToast('📅 Recordatorio de cobro programado (30 días)');
  }
  Sound.success();
}

// ══════════════════════════════════════════════════════════════
//  RECORDATORIOS DE COBRO POR TELEGRAM
// ══════════════════════════════════════════════════════════════
const REMINDERS_DB_KEY = 'facturapp_reminders';

function getReminders() {
  try {
    const raw = localStorage.getItem(REMINDERS_DB_KEY);
    if (raw) { const p = JSON.parse(raw); return Array.isArray(p) ? p : []; }
  } catch (_) {}
  return [];
}

function saveReminders(lista) {
  localStorage.setItem(REMINDERS_DB_KEY, JSON.stringify(Array.isArray(lista) ? lista : []));
}

function crearRecordatorioCobro(numFactura, clienteNombre, total, fechaFactura) {
  const reminders = getReminders();
  const yaExiste = reminders.find(r => r.numFactura === numFactura);
  if (yaExiste) return;

  const fechaVencimiento = new Date();
  fechaVencimiento.setDate(fechaVencimiento.getDate() + 30);

  reminders.push({
    id: `rem_${Date.now()}`,
    numFactura,
    clienteNombre,
    total,
    fechaFactura,
    fechaVencimiento: fechaVencimiento.toISOString().split('T')[0],
    enviado: false,
    creado: new Date().toISOString(),
  });
  saveReminders(reminders);
}

async function _enviarRecordatorioCobro(reminder) {
  const contacts = _getTgContacts();
  if (!contacts.length) return false;

  const chatId = contacts[0].chatId;
  const msg = `Hola ${reminder.clienteNombre}, te recuerdo que tu factura ${reminder.numFactura} por ${Number(reminder.total).toFixed(2)} € está pendiente de pago.\n\nFecha de emisión: ${reminder.fechaFactura}\nVencimiento: ${reminder.fechaVencimiento}\n\nSi ya realizaste el pago, podis ignorar este mensaje.\n\n— FacturAPP`;

  try {
    const resp = await fetch(`https://api.telegram.org/bot${_getTgBotToken()}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: msg }),
    });
    const json = await resp.json();
    return json.ok;
  } catch (e) {
    console.warn('Error enviando recordatorio:', e);
    return false;
  }
}

function verificarRecordatoriosPendientes() {
  const reminders = getReminders();
  const hoy = new Date().toISOString().split('T')[0];
  return reminders.filter(r => !r.enviado && r.fechaVencimiento <= hoy);
}

async function enviarRecordatoriosPendientes() {
  const pendientes = verificarRecordatoriosPendientes();
  if (!pendientes.length) return;

  let enviados = 0;
  for (const r of pendientes) {
    const ok = await _enviarRecordatorioCobro(r);
    if (ok) { r.enviado = true; enviados++; }
  }

  if (enviados > 0) {
    const all = getReminders().map(r => {
      const up = pendientes.find(p => p.id === r.id);
      return up ? up : r;
    });
    saveReminders(all);
    showToast(`📬 ${enviados} recordatorio(s) de cobro enviado(s)`);
  }
}

// ═══════════════════════════════════════════════════════════════
//  TELEGRAM — VINCULACIÓN AUTOMÁTICA CON POLLING
// ═══════════════════════════════════════════════════════════════
//
// FLUJO:
// 1. Usuario ingresa teléfono + nombre y presiona "Vincular"
// 2. Se genera código aleatorio de 4 caracteres (tg_pending_code)
// 3. Se abre deep link: https://t.me/TU_BOT?start=CODIGO
// 4. Modal con barra de progreso mientras espera
// 5. Polling cada 2s a getUpdates, busca /start CODIGO
// 6. Match → agrega contacto a tg_contacts[], muestra checkmark
// 7. Timeout 60s → error
// ═══════════════════════════════════════════════════════════════

// ── Helpers para array de contactos ─────────────────────────
function _getTgContacts() {
  try {
    var raw = localStorage.getItem('tg_contacts');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  // Migrar formato viejo (single contact)
  var oldId = localStorage.getItem('tg_chat_id');
  var oldPhone = localStorage.getItem('tg_phone');
  if (oldId) {
    var contacts = [{ chatId: oldId, phone: oldPhone || '', name: oldPhone || 'Contacto' }];
    localStorage.setItem('tg_contacts', JSON.stringify(contacts));
    localStorage.removeItem('tg_chat_id');
    localStorage.removeItem('tg_phone');
    return contacts;
  }
  return [];
}

function _saveTgContacts(arr) {
  localStorage.setItem('tg_contacts', JSON.stringify(arr));
  if (typeof _cloudSync === 'function' && typeof sbIsConfigured === 'function' && sbIsConfigured()) {
    (Array.isArray(arr) ? arr : []).forEach(c => {
      _cloudSync('tg_contacts', { name: c.name, phone: c.phone, chat_id: c.chatId });
    });
  }
}

function _addTgContact(chatId, phone, name) {
  var contacts = _getTgContacts();
  // No duplicar por chatId
  for (var i = 0; i < contacts.length; i++) {
    if (contacts[i].chatId === String(chatId)) {
      contacts[i].phone = phone || contacts[i].phone;
      contacts[i].name = name || contacts[i].name;
      _saveTgContacts(contacts);
      return;
    }
  }
  contacts.push({ chatId: String(chatId), phone: phone || '', name: name || phone || 'Contacto' });
  _saveTgContacts(contacts);
}

function _removeTgContact(index) {
  var contacts = _getTgContacts();
  if (index >= 0 && index < contacts.length) {
    contacts.splice(index, 1);
    _saveTgContacts(contacts);
  }
}

function _hasTgContacts() {
  return _getTgContacts().length > 0;
}

var _tgPollingTimeout = null;

function generarCodigoAleatorio() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── PREGUNTAR / ENVIAR ─────────────────────────────────────

function preguntarTelegram(pdfData) {
  showConfirmDialog(
    '✈️', '¿Enviar a Telegram?',
    `¿Deseas enviar "${pdfData.nombre}" por Telegram?`,
    () => { state._lastPdf = pdfData; showTelegramForm(pdfData); },
    () => {
      closeModal();
      setTimeout(() => showModal('🎉', '¡Factura lista!', 'Proceso completado correctamente.'), 100);
    }
  );
}

function showTelegramForm(pdfData) {
  state._lastPdf = pdfData;
  const contacts = _getTgContacts();
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');
  overlay.onclick = null;

  if (contacts.length === 0) {
    overlay.innerHTML = `
      <div class="modal tg-modal" onclick="event.stopPropagation()">
        <div class="modal-icon">✈️</div>
        <h3>Enviar por Telegram</h3>
        <p class="tg-hint" style="margin-bottom:14px">
          No tienes ningún contacto vinculado. Hazlo desde Configuración.
        </p>
        <div class="row-btns">
          <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
          <button class="btn-primary" onclick="closeModal();showTelegramConfig()">Ir a vincular</button>
        </div>
      </div>
    `;
    return;
  }

  if (contacts.length === 1) {
    state._selectedTgContact = contacts[0];
    overlay.innerHTML = `
      <div class="modal tg-modal" onclick="event.stopPropagation()">
        <div class="modal-icon"><img src="img/tg_home_icon.jpg" alt="Telegram" style="width:50px;height:auto;border-radius:6px" /></div>
        <h3>Enviar por Telegram</h3>
        <div class="tg-linked-badge">
          <span class="tg-linked-dot"></span>
          ${escapeHtml(contacts[0].name)} — ${escapeHtml(contacts[0].phone || 'Sin teléfono')}
        </div>
        <p class="tg-hint" style="margin-bottom:4px">Se enviará a este contacto.</p>
        <div class="row-btns" style="margin-top:14px">
          <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
          <button class="btn-primary" onclick="confirmarEnvioTelegram()">Enviar</button>
        </div>
        <button class="tg-relink-btn" onclick="showTelegramConfig()">Gestionar contactos</button>
      </div>
    `;
    return;
  }

  // Multiple contacts → show checkboxes
  overlay.innerHTML = `
    <div class="modal tg-modal" onclick="event.stopPropagation()">
      <div class="modal-icon"><img src="img/tg_s_icon.jpg" alt="Telegram" style="width:50px;height:auto;border-radius:6px" /></div>
      <h3>Enviar por Telegram</h3>
      <p class="tg-hint" style="margin-bottom:12px">Selecciona los contactos:</p>
      <div class="tg-contact-picker">
        ${contacts.map((c, i) => `
          <label class="tg-pick-option">
            <input type="checkbox" name="tgPick" value="${i}" checked>
            <div class="tg-pick-info">
              <span class="tg-pick-name">${escapeHtml(c.name)}</span>
              <span class="tg-pick-phone">${escapeHtml(c.phone || 'Sin teléfono')}</span>
            </div>
          </label>
        `).join('')}
      </div>
      <div class="row-btns" style="margin-top:14px">
        <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary" onclick="confirmarEnvioTelegram()">Enviar a todos</button>
      </div>
      <button class="tg-relink-btn" onclick="showTelegramConfig()">Gestionar contactos</button>
    </div>
  `;
}

async function confirmarEnvioTelegram() {
  var selectedContact = state._selectedTgContact;
  var selectedContacts = [];

  if (selectedContact) {
    selectedContacts = [selectedContact];
  } else {
    var contacts = _getTgContacts();
    var checkboxes = document.querySelectorAll('input[name="tgPick"]:checked');
    checkboxes.forEach(function(cb) {
      var idx = parseInt(cb.value);
      if (contacts[idx]) selectedContacts.push(contacts[idx]);
    });
  }

  if (selectedContacts.length === 0) {
    showToast('Selecciona al menos un contacto');
    return;
  }

  var chatIds = selectedContacts.filter(function(c) { return c.chatId; }).map(function(c) { return c.chatId; });
  if (chatIds.length === 0) {
    showToast('Ningún contacto seleccionado está vinculado');
    return;
  }

  const pdfData = state._lastPdf;
  if (!pdfData?.base64Data) {
    showToast('Error: PDF no encontrado en memoria');
    return;
  }

  const overlay = document.getElementById('modal-overlay');
  overlay.classList.remove('hidden');
  overlay.onclick = null;
  overlay.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()" style="min-height:160px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px">
      <div style="font-size:40px;animation:spin 1s linear infinite">⏳</div>
      <h3 style="font-size:16px;font-weight:700">Enviando…</h3>
      <p style="font-size:13px;color:var(--grey-500)">Enviando a ${chatIds.length} contacto(s)…</p>
    </div>
  `;

  let okCount = 0;
  let errCount = 0;
  let lastErr = '';

  for (var i = 0; i < chatIds.length; i++) {
    try {
      await enviarPDFTelegram(pdfData.base64Data, pdfData.nombre, _getTgBotToken(), chatIds[i]);
      okCount++;
    } catch (err) {
      errCount++;
      lastErr = err.message || 'Error desconocido';
    }
  }

  if (okCount > 0 && errCount === 0) {
    showModal('🎉', '¡Enviado!', `"${pdfData.nombre}" se envió correctamente a ${okCount} contacto(s).`);
    Sound.send();
  } else if (okCount > 0 && errCount > 0) {
    showModal('⚠️', 'Envío parcial', `Enviado a ${okCount}, falló en ${errCount}.\n${lastErr}`);
    Sound.notification();
  } else {
    showModal('❌', 'Error al enviar', `${lastErr}\n\nRevisa la vinculación en Configuración.`);
    Sound.error();
  }
}

// ── PANTALLA DE CONFIGURACIÓN TELEGRAM ───────────────────────

function showTelegramConfig() {
  closeModal();
  navigate('screen-telegram-config');
}

function renderTelegramConfig() {
  const container = document.getElementById('telegram-config-content');
  if (!container) return;

  const contacts = _getTgContacts();

  container.innerHTML = `
    <div class="tg-config-hero tg-hero-new">
      <div class="tg-hero-graphic">
        <img src="img/tg_home_icon.jpg" alt="Telegram" class="tg-hero-img" />
      </div>
      <h2 class="tg-config-title tg-title-new">Vincular Telegram</h2>
      <p class="tg-config-sub tg-sub-new">
        Vincula uno o varios números para enviar facturas por Telegram.
      </p>
      <p class="tg-config-sub tg-sub-new" style="margin-top:4px;font-weight:600;color:#7C4DFF">
        @${FacturAPPConfig.TG_BOT_USERNAME || 'tu_bot_username'}
      </p>
    </div>

    ${contacts.length > 0 ? `
      <div class="tg-contacts-list">
        <div class="tg-contacts-header">Contactos vinculados (${contacts.length})</div>
        ${contacts.map((c, i) => `
          <div class="tg-contact-card">
            <div class="tg-contact-info">
              <div class="tg-contact-name">${escapeHtml(c.name)}</div>
              <div class="tg-contact-phone">${escapeHtml(c.phone || 'Sin teléfono')}</div>
            </div>
            <button class="tg-contact-del" onclick="eliminarContactoTelegram(${i})">✕</button>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <div class="form-card tg-link-card">
      <div class="form-row">
        <label>Nombre del contacto</label>
        <input
          type="text"
          id="tg-name-input"
          placeholder="Ej: Juan, Casa, Empresa"
          style="font-size:18px;letter-spacing:0.5px"
        />
      </div>
      <div class="form-row">
        <label>Número de teléfono</label>
        <input
          type="tel"
          id="tg-phone-input"
          placeholder="Ej: +34 612 345 678"
          style="font-size:18px;letter-spacing:0.5px"
          autocomplete="tel"
        />
        <p class="tg-phone-hint">Solo se usa para identificar la vinculación.</p>
      </div>
      <button class="btn-primary full-width tg-link-btn" onclick="iniciarVinculacion()">
        <span>Vincular${contacts.length > 0 ? ' otro' : ''} Telegram</span>
      </button>
    </div>

    <div class="tg-how-works">
      <div class="tg-how-title">¿Cómo funciona?</div>
      <div class="tg-how-step">
        <span class="tg-step-num">1</span>
        <span>Pon nombre + teléfono y toca <strong>Vincular</strong></span>
      </div>
      <div class="tg-how-step">
        <span class="tg-step-num">2</span>
        <span>Se abrirá Telegram con nuestro bot</span>
      </div>
      <div class="tg-how-step">
        <span class="tg-step-num">3</span>
        <span>Toca <strong>Iniciar</strong> en el chat del bot</span>
      </div>
      <div class="tg-how-step">
        <span class="tg-step-num">4</span>
        <span>¡Listo! Se completa automáticamente</span>
      </div>
    </div>

    <div class="form-card" style="margin-top:12px;background:#EBF5FF;border-color:#C5DEFF">
      <div style="font-size:13px;color:#1a5276;line-height:1.6">
        <strong>🔒 Privacidad:</strong> Los datos se guardan localmente en tu dispositivo.
      </div>
    </div>
  `;
}

// ── VINCULACIÓN AUTOMÁTICA ──────────────────────────────────

function iniciarVinculacion() {
  var nameInput = document.getElementById('tg-name-input');
  var phoneInput = document.getElementById('tg-phone-input');
  var name = nameInput ? nameInput.value.trim() : '';
  var phone = phoneInput ? phoneInput.value.trim() : '';
  if (!name) { showToast('Pon un nombre para el contacto'); Sound.error(); return; }
  if (!phone) { showToast('Ingresa tu número de teléfono'); Sound.error(); return; }
  Sound.tap();

  var code = generarCodigoAleatorio();
  localStorage.setItem('tg_pending_code', code);
  localStorage.setItem('tg_pending_phone', phone);
  localStorage.setItem('tg_pending_name', name);

  var tgUrl = 'https://t.me/' + (FacturAPPConfig.TG_BOT_USERNAME || 'tu_bot_username') + '?start=' + code;

  _mostrarModalVinculacion(code, phone, name, tgUrl);
}

function _mostrarModalVinculacion(code, phone, name, tgUrl) {
  var overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.onclick = null;

  var msgText = '/start ' + code;

  overlay.innerHTML =
    '<div class="modal tg-vinc-modal" onclick="event.stopPropagation()">' +
    '<div class="tg-vinc-icon"><img src="img/tg_home_icon.jpg" alt="Telegram" style="width:60px;height:auto;border-radius:8px" /></div>' +
    '<h3 class="tg-vinc-title">Vinculación en curso</h3>' +
    '<p class="tg-vinc-sub">Copia el mensaje de abajo y envíalo al bot de Telegram.</p>' +
    '<div class="tg-vinc-copy-box" id="tgCopyBox">' +
    '<span class="tg-vinc-copy-msg" id="tgCopyMsg">' + msgText + '</span>' +
    '<button class="tg-vinc-copy-btn" id="tgCopyBtn" onclick="copiarCodigoVinculacion(\'' + code + '\')">📋 Copiar</button>' +
    '</div>' +
    '<button class="btn-primary full-width" style="margin-bottom:8px" onclick="abrirTelegramVinculacion(\'' + tgUrl + '\')"><img src="img/tg_home_icon.jpg" alt="" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;border-radius:3px"> Abrir Telegram</button>' +
    '<div class="tg-vinc-progress"><div class="tg-vinc-bar" id="tgVincBar"></div></div>' +
    '<p class="tg-vinc-status" id="tgVincStatus">Esperando…</p>' +
    '<div class="tg-vinc-time" id="tgVincTime">60</div>' +
    '<button class="btn-secondary full-width" style="margin-top:8px" onclick="_cancelarVinculacion()">Cancelar</button>' +
    '</div>';

  _iniciarPolling(code, phone, name);
}

function abrirTelegramVinculacion(tgUrl) {
  try { window.open(tgUrl, '_system'); } catch(e) { try { window.open(tgUrl, '_blank'); } catch(e2) {} }
}

function copiarCodigoVinculacion(code) {
  var text = '/start ' + code;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function() {
      _marcarCopiado();
    }).catch(function() {
      _fallbackCopy(text);
    });
  } else {
    _fallbackCopy(text);
  }
}

function _fallbackCopy(text) {
  var ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); _marcarCopiado(); } catch(e) { showToast('No se pudo copiar'); }
  document.body.removeChild(ta);
}

function _marcarCopiado() {
  var btn = document.getElementById('tgCopyBtn');
  if (btn) {
    btn.textContent = '✅ Copiado';
    btn.classList.add('copied');
    setTimeout(function() {
      btn.textContent = '📋 Copiar';
      btn.classList.remove('copied');
    }, 2000);
  }
  showToast('Mensaje copiado. Pegalo en Telegram.');
}

function _iniciarPolling(code, phone, name) {
  _cancelarVinculacion(true);

  var intentos = 0;
  var maxIntentos = 30;
  var stopped = false;
  var abortCtrl = null;

  function _setStatus(s) {
    var el = document.getElementById('tgVincStatus');
    if (el) el.textContent = s;
  }

  function poll() {
    if (stopped) return;
    intentos++;
    var rest = maxIntentos - intentos;

    var barEl = document.getElementById('tgVincBar');
    var timeEl = document.getElementById('tgVincTime');
    if (barEl) barEl.style.width = (intentos / maxIntentos * 100) + '%';
    if (timeEl) timeEl.textContent = String(rest);

    if (intentos >= maxIntentos) {
      stopped = true;
      _mostrarErrorVinculacion('Tiempo agotado', 'No se detectó la vinculación en 60 segundos.');
      return;
    }

    _setStatus('Buscando… (' + intentos + '/' + maxIntentos + ')');

    if (abortCtrl) { try { abortCtrl.abort(); } catch(e) {} }
    abortCtrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var fetchOpts = { signal: abortCtrl ? abortCtrl.signal : undefined };

    var url = 'https://api.telegram.org/bot' + _getTgBotToken() +
              '/getUpdates?offset=1&timeout=0&_=' + Date.now();

    fetch(url, fetchOpts)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (stopped) return;

        if (!data.ok) {
          _setStatus('Error API ' + (data.error_code || '') + ': ' + (data.description || ''));
          _tgPollingTimeout = setTimeout(poll, 2000);
          return;
        }

        var updates = data.result || [];

        for (var i = 0; i < updates.length; i++) {
          var u = updates[i];
          var msg = u.message || u.my_chat_member;
          if (!msg) continue;
          var txt = '';
          if (msg.text) txt = msg.text;
          var fromId = 0;
          if (msg.from) fromId = msg.from.id;
          else if (msg.chat) fromId = msg.chat.id;
          if (!txt || !fromId) continue;

          var t = txt.trim();
          if (t === '/start ' + code || t === '/start@' + (FacturAPPConfig.TG_BOT_USERNAME || 'tu_bot_username') + ' ' + code ||
              (t.indexOf('/start') === 0 && t.indexOf(code) > 0)) {
            _addTgContact(fromId, phone, name);
            localStorage.removeItem('tg_pending_code');
            localStorage.removeItem('tg_pending_phone');
            localStorage.removeItem('tg_pending_name');
            stopped = true;
            if (abortCtrl) try { abortCtrl.abort(); } catch(e) {}
            _mostrarExitoVinculacion();
            return;
          }
        }

        var hint = updates.length > 0 ? ' (' + updates.length + ' msgs sin match)' : '';
        _setStatus('Esperando /start ' + code + '… (' + intentos + '/' + maxIntentos + ')' + hint);
        _tgPollingTimeout = setTimeout(poll, 2000);
      })
      .catch(function (err) {
        if (stopped) return;
        _setStatus('Error: ' + err.message + ' — reintentando…');
        _tgPollingTimeout = setTimeout(poll, 2000);
      });
  }

  poll();
}

function _mostrarExitoVinculacion() {
  const overlay = document.getElementById('modal-overlay');
  Sound.success();
  if (!overlay) return;
  const barEl = document.getElementById('tgVincBar');
  const statusEl = document.getElementById('tgVincStatus');

  if (barEl) { barEl.style.width = '100%'; barEl.style.background = '#4CAF50'; }
  if (statusEl) statusEl.textContent = '✅ ¡Vinculado!';

  // Mostrar checkmark animado después de un pequeño delay
  setTimeout(() => {
    overlay.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-icon">
          <svg class="tg-checkmark" width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="30" fill="none" stroke="#4CAF50" stroke-width="4"/>
            <polyline points="20,32 28,40 44,24" fill="none" stroke="#4CAF50" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" class="tg-checkmark-path"/>
          </svg>
        </div>
        <h3>🎉 ¡Vinculado!</h3>
        <p>Tu Telegram se vinculó correctamente.<br>Ya podés enviar facturas y órdenes.</p>
        <button class="btn-primary" onclick="closeModal();renderTelegramConfig()">Aceptar</button>
      </div>
    `;
  }, 400);
}

function _mostrarErrorVinculacion(titulo, msg) {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-icon">❌</div>
      <h3>${titulo}</h3>
      <p>${msg}</p>
      <button class="btn-primary" onclick="closeModal()">Cerrar</button>
    </div>
  `;
}

function _cancelarVinculacion(silent) {
  if (_tgPollingTimeout) { clearTimeout(_tgPollingTimeout); _tgPollingTimeout = null; }
  localStorage.removeItem('tg_pending_code');
  localStorage.removeItem('tg_pending_phone');
  localStorage.removeItem('tg_pending_name');
  if (!silent) { closeModal(); showToast('Vinculación cancelada'); }
}

function eliminarContactoTelegram(index) {
  var contacts = _getTgContacts();
  var c = contacts[index];
  if (!c) return;
  Sound.tap();
  showConfirmDialog(
    '⚠️', 'Eliminar contacto',
    '¿Deseas desvincular a "' + escapeHtml(c.name) + '"?',
    () => {
      _removeTgContact(index);
      renderTelegramConfig();
      showToast('Contacto eliminado');
    },
    null
  );
}

function desvincularTelegram() {
  localStorage.removeItem('tg_contacts');
  localStorage.removeItem('tg_chat_id');
  localStorage.removeItem('tg_phone');
  renderTelegramConfig();
  showToast('Todos los contactos desvinculados');
  Sound.tap();
}

// ── EDITAR FACTURA ────────────────────────────────────────────
async function editarFactura(nombre) {
  const datos = await leerDatosFactura(nombre);
  if (!datos) {
    showToast('No se encontraron datos para esta factura');
    Sound.error();
    return;
  }
  Sound.tap();

  state.docType              = 'factura';
  state.emisor               = datos.emisor    || null;
  state.cliente              = datos.cliente   || null;
  state.productos            = datos.productos || [];
  state.materiales           = datos.materiales || [];
  state._editando            = nombre;
  state._editandoPresupuesto = null;
  state._skipResetNueva      = true;

  navigate('screen-nueva');

  document.getElementById('fac-fecha').value = datos.fechaRaw || new Date().toISOString().split('T')[0];
  document.getElementById('fac-num').value   = datos.num_factura || '';
  document.getElementById('fac-iva').value   = String(datos.iva || 21);

  const ret = datos.retencion || {};
  document.getElementById('chk-retencion').checked = ret.enabled || false;
  document.getElementById('fac-ret').value          = String(ret.rate || 19);
  toggleRetencion();

  renderProductosList();
  renderMaterialesList();
  renderEmisorList();
  goToStep(1);

  if (datos._isPartialData) {
    showToast('⚠️ Factura antigua: productos no disponibles. Agregalos manualmente.');
  } else {
    showToast('Editando factura');
  }
}

// ══════════════════════════════════════════════════════════════
//  ÓRDENES DE TRABAJO — LISTADO (idéntico a Facturas/Presupuestos)
// ══════════════════════════════════════════════════════════════

let _otLongPressTimer     = null;
let _otLongPressTriggered = false;

function renderOrdenesListado() {
  const list  = document.getElementById('ordenes-list');
  const empty = document.getElementById('ordenes-empty');
  const stats = document.getElementById('ordenes-stats');
  if (!list) return;

  const ordenes = getOrdenes();
  list.innerHTML = '';

  if (stats) {
    stats.innerHTML = `
      <div class="hist-stat"><div class="val">${ordenes.length}</div><div class="lbl">Órdenes</div></div>
      <div class="hist-stat"><div class="val">${ordenes.filter(o => o.estado === 'completada').length}</div><div class="lbl">Completadas</div></div>
    `;
  }

  if (!ordenes.length) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  ordenes.forEach((o, index) => {
    const card = document.createElement('div');
    card.className = 'emitida-card orden-card';
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `Opciones de orden ${o.numero}`);
    card.style.animationDelay = `${index * 40}ms`;

    const estadoBadge = o.estado === 'completada'
      ? '<span class="orden-estado completada">✓ Completada</span>'
      : '<span class="orden-estado pendiente">⏳ Pendiente</span>';

    card.innerHTML = `
      <div class="emitida-card-top">
        <div class="emitida-info">
          <span class="emitida-num">Orden ${escapeHtml(o.numero || o.referencia || '—')}</span>
          <span class="emitida-fecha">${escapeHtml(o.fecha || '—')}</span>
        </div>
        ${estadoBadge}
      </div>
      <div class="emitida-card-sub">
        <span>👤 ${escapeHtml(o.cliente?.nombre || '—')}</span>
        <span>🏢 ${escapeHtml(o.emisor?.nombre  || '—')}</span>
      </div>
      <div class="emitida-hold-hint">Mantén pulsado para ver opciones</div>
    `;

    card.onpointerdown  = ev => _startOTLongPress(ev, o.id);
    card.onpointerup    = _cancelOTLongPress;
    card.onpointerleave = _cancelOTLongPress;
    card.onpointercancel = _cancelOTLongPress;
    card.oncontextmenu  = ev => { ev.preventDefault(); showOrdenContextMenu(o.id); };
    card.onclick        = () => {
      if (_otLongPressTriggered) { _otLongPressTriggered = false; return; }
      showToast('Mantén pulsado para ver las opciones');
    };
    card.onkeydown = ev => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); showOrdenContextMenu(o.id); }
    };
    list.appendChild(card);
  });
}

function _startOTLongPress(ev, id) {
  _cancelOTLongPress();
  _otLongPressTriggered = false;
  ev.currentTarget.classList.add('long-pressing');
  _otLongPressTimer = setTimeout(() => {
    _otLongPressTriggered = true;
    ev.currentTarget.classList.remove('long-pressing');
    showOrdenContextMenu(id);
  }, 520);
}

function _cancelOTLongPress(ev) {
  if (_otLongPressTimer) clearTimeout(_otLongPressTimer);
  _otLongPressTimer = null;
  if (ev?.currentTarget) ev.currentTarget.classList.remove('long-pressing');
}

function showOrdenContextMenu(id) {
  const orden   = getOrdenes().find(o => o.id === id);
  if (!orden) return;
  const encoded = encodeURIComponent(id);
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div class="action-sheet" onclick="event.stopPropagation()">
      <div class="sheet-handle"></div>
      <div class="sheet-title">Orden de Trabajo</div>
      <div class="sheet-subtitle">${escapeHtml(orden.numero || orden.referencia)}</div>
      <div class="sheet-actions">
        <button class="sheet-action" onclick="closeModal(); ordenVista(decodeURIComponent('${encoded}'))">📄 Abrir vista previa</button>
        <button class="sheet-action" onclick="closeModal(); ordenExportar(decodeURIComponent('${encoded}'))">⬇️ Exportar PDF</button>
        <button class="sheet-action" onclick="closeModal(); ordenCompartir(decodeURIComponent('${encoded}'))">🔗 Compartir</button>
        <button class="sheet-action" onclick="closeModal(); ordenTelegram(decodeURIComponent('${encoded}'))">✈️ Enviar a Telegram</button>
        <button class="sheet-action" onclick="closeModal(); ordenMarcarEstado(decodeURIComponent('${encoded}'))">
          ${orden.estado === 'completada' ? '⏳ Marcar como Pendiente' : '✓ Marcar como Completada'}
        </button>
        <button class="sheet-action danger" onclick="closeModal(); ordenEliminar(decodeURIComponent('${encoded}'))">🗑️ Eliminar</button>
      </div>
      <button class="sheet-cancel" onclick="closeModal()">Cancelar</button>
    </div>
  `;
  overlay.classList.remove('hidden');
  overlay.onclick = closeModal;
}

async function ordenVista(id) {
  const orden = getOrdenes().find(o => o.id === id);
  if (!orden) return;
  // Intentar leer PDF del cache local
  if (orden.pdf?.nombre) {
    const cached = await _leerPDFLocal(orden.pdf.nombre);
    if (cached) { showPdfPreview(cached, orden.pdf.nombre); return; }
  }
  showToast('Regenerando PDF…');
  try {
    const pdf = await generarOrdenTrabajoPDF(orden);
    showPdfPreview(pdf.base64Data, pdf.nombre);
  } catch (e) { showToast('Error al generar PDF'); }
}

async function ordenExportar(id) {
  const orden = getOrdenes().find(o => o.id === id);
  if (!orden) return;
  showToast('Generando PDF…');
  try {
    let pdf = null;
    if (orden.pdf?.nombre) {
      const cached = await _leerPDFLocal(orden.pdf.nombre);
      if (cached) pdf = { base64Data: cached, nombre: orden.pdf.nombre };
    }
    if (!pdf) pdf = await generarOrdenTrabajoPDF(orden);
    descargarBase64PDF(pdf.base64Data, pdf.nombre);
    showToast('PDF exportado');
  } catch (e) { showToast('Error al exportar'); }
}

async function ordenCompartir(id) {
  const orden = getOrdenes().find(o => o.id === id);
  if (!orden) return;
  try {
    let pdf = null;
    if (orden.pdf?.nombre) {
      const cached = await _leerPDFLocal(orden.pdf.nombre);
      if (cached) pdf = { base64Data: cached, nombre: orden.pdf.nombre };
    }
    if (!pdf) pdf = await generarOrdenTrabajoPDF(orden);
    const plugins = window.Capacitor?.Plugins;
    const Share   = plugins?.Share;
    const Fs      = getFS();
    const Dir     = getDir();
    if (Share && Fs) {
      const path = `Facturas/${pdf.nombre}`;
      await Fs.writeFile({ path, data: pdf.base64Data, directory: Dir.Cache, recursive: true });
      const { uri } = await Fs.getUri({ path, directory: Dir.Cache });
      await Share.share({ title: pdf.nombre, text: `Orden: ${orden.numero}`, url: uri, dialogTitle: 'Compartir orden' });
      return;
    }
    _compartirComoBlob(pdf.base64Data, pdf.nombre);
  } catch (e) { showToast('Error al compartir'); }
}

async function ordenTelegram(id) {
  const orden = getOrdenes().find(o => o.id === id);
  if (!orden) return;
  showToast('Generando PDF…');
  try {
    let pdf = null;
    if (orden.pdf?.nombre) {
      const cached = await _leerPDFLocal(orden.pdf.nombre);
      if (cached) pdf = { base64Data: cached, nombre: orden.pdf.nombre };
    }
    if (!pdf) pdf = await generarOrdenTrabajoPDF(orden);
    state._lastPdf = pdf;
    showTelegramForm(pdf);
  } catch (e) { showToast('Error al generar PDF'); }
}

function ordenMarcarEstado(id) {
  const ordenes = getOrdenes();
  const idx     = ordenes.findIndex(o => o.id === id);
  if (idx < 0) return;
  ordenes[idx].estado = ordenes[idx].estado === 'completada' ? 'pendiente' : 'completada';
  saveOrdenes(ordenes);
  renderOrdenesListado();
  showToast(`Orden marcada como ${ordenes[idx].estado}`);
}

function ordenEliminar(id) {
  const orden = getOrdenes().find(o => o.id === id);
  if (!orden) return;
  showConfirmDialog(
    '🗑️', 'Eliminar orden',
    `Se eliminará la orden "${orden.numero || orden.referencia}" permanentemente.`,
    () => {
      saveOrdenes(getOrdenes().filter(o => o.id !== id));
      renderOrdenesListado();
      showToast('Orden eliminada');
    },
    null
  );
}

// ══════════════════════════════════════════════════════════════
//  ÓRDENES DE TRABAJO — CREAR NUEVA
// ══════════════════════════════════════════════════════════════

window._ordenPuntos  = [];
window._ordenEmisor  = null;
window._ordenCliente = null;

function nuevaOrdenTrabajo() {
  navigate('screen-orden-nueva');
}

// ── WIZARD OT — estado del step ──────────────────────────────
window._otStep = 1;

function otGoToStep(n) {
  // Ocultar todos los steps
  document.querySelectorAll('#screen-orden-nueva .step-content').forEach(el => el.classList.remove('active'));
  const target = document.getElementById(`ot-step-${n}`);
  if (target) target.classList.add('active');
  window._otStep = n;
  Sound.step();

  // Actualizar dots
  for (let i = 1; i <= 5; i++) {
    const dot = document.getElementById(`ot-step-dot-${i}`);
    if (!dot) continue;
    dot.classList.remove('active', 'done');
    if (i === n) dot.classList.add('active');
    if (i < n)  dot.classList.add('done');
  }

  // Botones nav
  const btnBack = document.getElementById('btnOtStepBack');
  const btnNext = document.getElementById('btnOtStepNext');
  if (btnBack) btnBack.style.visibility = n === 1 ? 'hidden' : 'visible';
  if (btnNext) btnNext.textContent = n === 5 ? '✓ Guardar' : 'Siguiente →';

  // Render del resumen en step 5
  if (n === 5) renderOrdenResumen();

  // Scroll top del wizard body
  const wb = document.getElementById('otWizardBody');
  if (wb) wb.scrollTop = 0;
}

function otNextStep() {
  const n = window._otStep || 1;
  if (n === 1 && !window._ordenEmisor)  { showToast('Seleccioná un emisor'); return; }
  if (n === 3 && !window._ordenCliente) { showToast('Seleccioná un cliente'); return; }
  if (n === 5) { guardarOrdenTrabajo(); return; }
  otGoToStep(n + 1);
}

function otPrevStep() {
  const n = window._otStep || 1;
  if (n > 1) { Sound.stepBack(); otGoToStep(n - 1); }
}

function renderOrdenResumen() {
  const card = document.getElementById('orden-resumen-card');
  if (!card) return;
  const em     = window._ordenEmisor;
  const cl     = window._ordenCliente;
  const fechaRaw = document.getElementById('orden-meta-fecha')?.value || '';
  const numero   = document.getElementById('orden-meta-ref')?.value || '—';
  const [y, m, d] = fechaRaw.split('-');
  const fechaFmt  = y && m && d ? `${d}/${m}/${y}` : '—';
  const puntos    = (window._ordenPuntos || []).filter(p => p.descripcion.trim());

  card.innerHTML = `
    <div class="summary-section">
      <h4>📋 Orden de Trabajo</h4>
      <div class="summary-field"><span>Número:</span><span>${escapeHtml(numero)}</span></div>
      <div class="summary-field"><span>Fecha:</span><span>${fechaFmt}</span></div>
    </div>
    <div class="summary-section">
      <h4>🏢 Emisor</h4>
      <div class="summary-field"><span>${escapeHtml(em?.nombre || '—')}</span></div>
    </div>
    <div class="summary-section">
      <h4>👤 Cliente</h4>
      <div class="summary-field"><span>${escapeHtml(cl?.nombre || '—')}</span></div>
    </div>
    ${puntos.length ? `
    <div class="summary-section">
      <h4>✅ Trabajos (${puntos.length} puntos)</h4>
      ${puntos.map(p => `<div class="summary-field"><span>${escapeHtml(p.descripcion.substring(0, 60))}${p.descripcion.length > 60 ? '…' : ''}</span></div>`).join('')}
    </div>` : ''}
  `;
}

function initOrdenTrabajo() {
  ['orden-trabajo-realizar','orden-recomendaciones','orden-obs-prev',
   'orden-otros-prev','orden-notas-seg','orden-obs-post','orden-otros-post']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

  window._ordenEmisor  = null;
  window._ordenCliente = null;

  const elFecha = document.getElementById('orden-meta-fecha');
  const elRef   = document.getElementById('orden-meta-ref');
  if (elFecha) elFecha.value = new Date().toISOString().split('T')[0];
  if (elRef)   elRef.value   = sugerirNumeroOrdenTrabajo();

  window._ordenPuntos = [{ numero: 1, descripcion: '' }];
  window._otStep = 1;
  otGoToStep(1);
  renderOrdenEmisorList();
  renderOrdenClienteList();
  renderOrdenPuntos();
}

function sugerirNumeroOrdenTrabajo() {
  const lista = getOrdenes();
  const max   = lista.reduce((acc, item) => {
    const match = String(item.numero || item.referencia || '').match(/OT-(\d+)/i);
    return match ? Math.max(acc, Number(match[1])) : acc;
  }, 0);
  return `OT-${String(max + 1).padStart(4, '0')}`;
}

function renderOrdenEmisorList() {
  const container = document.getElementById('orden-emisores-list');
  if (!container) return;
  container.innerHTML = '';

  getEmisores().forEach(em => {
    const div = document.createElement('div');
    div.className = 'select-card' + (window._ordenEmisor?.nombre === em.nombre ? ' selected' : '');
    div.innerHTML = `
      <div class="select-card-body">
        <strong>${escapeHtml(em.nombre)}</strong>
        <small>${escapeHtml(em.cp_ciudad)} · ${escapeHtml(em.doi)}</small>
      </div>
      ${em._predefined ? '<span class="select-card-badge">Predefinido</span>' : ''}
      <div class="select-check"></div>
    `;
    div.onclick = () => selectOrdenEmisor(em);
    container.appendChild(div);
  });
}

function selectOrdenEmisor(emisor) {
  window._ordenEmisor = emisor;
  showToast(`Emisor: ${emisor.alias || emisor.nombre}`);
  renderOrdenEmisorList();
  Sound.select();
}

function renderOrdenClienteList() {
  const container = document.getElementById('orden-clientes-list');
  if (!container) return;
  container.innerHTML = '';

  getClientes().forEach(cl => {
    const div = document.createElement('div');
    div.className = 'select-card' + (window._ordenCliente?.nombre === cl.nombre ? ' selected' : '');
    div.innerHTML = `
      <div class="select-card-body">
        <strong>${escapeHtml(cl.nombre)}</strong>
        <small>${escapeHtml(cl.cp_ciudad)} · ${escapeHtml(cl.nif)}</small>
      </div>
      ${cl._predefined ? '<span class="select-card-badge">Predefinido</span>' : ''}
      <div class="select-check"></div>
    `;
    div.onclick = () => selectOrdenCliente(cl);
    container.appendChild(div);
  });
}

function selectOrdenCliente(cliente) {
  window._ordenCliente = cliente;
  showToast(`Cliente: ${cliente.alias || cliente.nombre}`);
  renderOrdenClienteList();
  Sound.select();
}

function renderOrdenPuntos() {
  const cont = document.getElementById('orden-puntos-lista');
  if (!cont) return;
  cont.innerHTML = '';
  window._ordenPuntos.forEach((p, idx) => {
    const fila = document.createElement('div');
    fila.className = 'orden-punto-row';
    fila.innerHTML = `
      <div class="orden-punto-num">${idx + 1}</div>
      <textarea
        class="orden-punto-desc"
        oninput="window._ordenPuntos[${idx}].descripcion=this.value"
        placeholder="Descripción del trabajo realizado…"
        rows="2"
      >${escapeHtml(p.descripcion)}</textarea>
      <button class="orden-punto-del" onclick="ordenRemovePunto(${idx})">×</button>
    `;
    cont.appendChild(fila);
  });
}

function ordenAddPunto() {
  window._ordenPuntos.push({ numero: window._ordenPuntos.length + 1, descripcion: '' });
  renderOrdenPuntos();
  const cont = document.getElementById('orden-puntos-lista');
  if (cont) cont.lastChild?.querySelector('textarea')?.focus();
  Sound.click();
}

function ordenRemovePunto(idx) {
  if (window._ordenPuntos.length <= 1) return;
  window._ordenPuntos.splice(idx, 1);
  window._ordenPuntos.forEach((p, i) => { p.numero = i + 1; });
  renderOrdenPuntos();
  Sound.delete();
}

function _formatOrdenDate(fechaRaw) {
  const [y, m, d] = String(fechaRaw || '').split('-');
  return y && m && d ? `${d}/${m}/${y}` : new Date().toLocaleDateString('es-ES');
}

function _getOrdenMetaValues() {
  const fechaRaw = document.getElementById('orden-meta-fecha')?.value || new Date().toISOString().split('T')[0];
  const numero   = document.getElementById('orden-meta-ref')?.value?.trim() || sugerirNumeroOrdenTrabajo();
  return {
    fechaRaw,
    fecha:      _formatOrdenDate(fechaRaw),
    numero,
    referencia: numero,
    emisor:     window._ordenEmisor,
    cliente:    window._ordenCliente,
  };
}

async function guardarOrdenTrabajo() {
  const meta = _getOrdenMetaValues();
  if (!meta.emisor)   { showToast('Seleccioná un emisor');   Sound.error(); return; }
  if (!meta.cliente)  { showToast('Seleccioná un cliente');  Sound.error(); return; }
  if (!meta.numero)   { showToast('Ingresá el número de orden'); Sound.error(); return; }
  if (!meta.fechaRaw) { showToast('Seleccioná la fecha');    Sound.error(); return; }
  Sound.generate();

  const id = `ot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const orden = {
    id,
    numero:            meta.numero,
    fecha:             meta.fecha,
    fechaRaw:          meta.fechaRaw,
    emisor:            meta.emisor,
    cliente:           meta.cliente,
    referencia:        meta.referencia,
    estado:            'pendiente',
    trabajoRealizar:   document.getElementById('orden-trabajo-realizar')?.value || '',
    recomendaciones:   document.getElementById('orden-recomendaciones')?.value  || '',
    observacionesPrev: document.getElementById('orden-obs-prev')?.value         || '',
    otrosPrev:         document.getElementById('orden-otros-prev')?.value       || '',
    puntos:            window._ordenPuntos.filter(p => p.descripcion.trim()),
    notasSeg:          document.getElementById('orden-notas-seg')?.value        || '',
    observacionesPost: document.getElementById('orden-obs-post')?.value         || '',
    otrosPost:         document.getElementById('orden-otros-post')?.value       || '',
    guardado_en:       new Date().toISOString(),
  };

  // Guardar en localStorage con clave nueva (con ID)
  const lista = getOrdenes();
  lista.unshift(orden);
  saveOrdenes(lista);

  showToast('Generando PDF…');
  let pdfData = null;
  try {
    pdfData = await generarOrdenTrabajoPDF(orden);
  } catch (err) {
    console.error('Error PDF orden:', err);
    showToast('⚠️ Orden guardada pero no se pudo generar PDF');
    goBack();
    renderOrdenesListado();
    return;
  }

  // Guardar referencia al PDF en la orden (solo nombre, no base64 completo)
  const updatedLista = getOrdenes();
  const idx = updatedLista.findIndex(o => o.id === id);
  if (idx >= 0) {
    updatedLista[idx].pdf = { nombre: pdfData.nombre };
    saveOrdenes(updatedLista);
  }

  try {
    await guardarFacturaPDF(pdfData.base64Data, pdfData.nombre, {
      num_factura: orden.numero,
      cliente:     orden.cliente.nombre,
      emisor:      orden.emisor.nombre,
      fecha:       orden.fecha,
      total:       0,
    }, orden);
  } catch (e) { console.error('Error guardando PDF:', e); }

  window._lastOrdenPdf = { ...pdfData };
  state._lastPdf       = window._lastOrdenPdf;

  // Volver a la lista de órdenes (no al historial previo)
  state.screenHistory = state.screenHistory.filter(s => s !== 'screen-orden-nueva');
  navigate('screen-orden-trabajo');

  showConfirmDialog(
    '✅', '¿Enviar a Telegram?',
    'Orden guardada correctamente. ¿Deseas enviarla por Telegram?',
    () => showTelegramForm(window._lastOrdenPdf),
    () => {
      closeModal();
      setTimeout(() => showModal('✅', 'Orden guardada', 'La orden se guardó como PDF correctamente.'), 100);
    }
  );
}

// ══════════════════════════════════════════════════════════════
//  GESTIÓN — EMISORES
// ══════════════════════════════════════════════════════════════

function renderMgmtEmisores() {
  const list  = document.getElementById('emisores-mgmt-list');
  const empty = document.getElementById('emisores-empty');
  if (!list) return;
  const saved = getSavedEmisores();
  list.innerHTML = '';

  saved.forEach(em => {
    const div = document.createElement('div');
    div.className = 'mgmt-card';
    div.innerHTML = `
      <div class="mgmt-card-body">
        <strong>${escapeHtml(em.nombre)}</strong>
        <small>${escapeHtml(em.cp_ciudad)} · ${escapeHtml(em.doi)}</small>
      </div>
      ${em.alias ? `<span class="mgmt-alias">${escapeHtml(em.alias)}</span>` : ''}
      <button class="btn-delete" onclick="confirmDeleteEmisor(this.dataset.alias)" data-alias="${escapeAttr(em.alias)}">✕</button>
    `;
    list.appendChild(div);
  });

  if (empty) empty.classList.add('hidden');
}

function confirmDeleteEmisor(alias) {
  Sound.tap();
  showConfirmDialog('🗑️', 'Eliminar emisor', `¿Eliminar emisor "${alias}"?`, () => {
    deleteEmisor(alias);
    renderMgmtEmisores();
    showToast('Emisor eliminado');
    Sound.delete();
  }, () => {});
}

function saveMgmtEmisor() {
  const em = {
    nombre:          document.getElementById('mgmt-em-nombre').value.trim(),
    direccion:       document.getElementById('mgmt-em-dir').value.trim(),
    cp_ciudad:       document.getElementById('mgmt-em-cp').value.trim(),
    doi:             document.getElementById('mgmt-em-doi').value.trim(),
    cuenta_bancaria: document.getElementById('mgmt-em-iban').value.trim(),
    alias:           document.getElementById('mgmt-em-alias').value.trim(),
    logo:            state._mgmtEmisorLogo || null,
  };
  if (!em.nombre || !em.doi) { showToast('Nombre y DOI son obligatorios'); Sound.error(); return; }
  if (!em.alias) em.alias = em.nombre.split(' ')[0];
  saveEmisor(em);
  goBack();
  showModal('✅', 'Emisor guardado', `"${em.alias}" guardado correctamente.`);
  Sound.save();
}

function previewMgmtEmisorLogo(input) {
  const preview = document.getElementById('mgmt-em-logo-preview');
  if (!preview) return;
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      state._mgmtEmisorLogo = e.target.result;
      preview.innerHTML = '<img src="' + e.target.result + '" style="max-height:48px;border-radius:6px;border:1px solid #ddd">';
    };
    reader.readAsDataURL(input.files[0]);
  } else {
    state._mgmtEmisorLogo = null;
    preview.innerHTML = '';
  }
}

// ── GESTIÓN CLIENTES ─────────────────────────────────────────
function renderMgmtClientes() {
  const list  = document.getElementById('clientes-mgmt-list');
  const empty = document.getElementById('clientes-empty');
  if (!list) return;
  const saved = getSavedClientes();
  list.innerHTML = '';

  saved.forEach(cl => {
    const div = document.createElement('div');
    div.className = 'mgmt-card';
    div.innerHTML = `
      <div class="mgmt-card-body">
        <strong>${escapeHtml(cl.nombre)}</strong>
        <small>${escapeHtml(cl.cp_ciudad)} · ${escapeHtml(cl.nif)}</small>
      </div>
      ${cl.alias ? `<span class="mgmt-alias">${escapeHtml(cl.alias)}</span>` : ''}
      <button class="btn-delete" onclick="confirmDeleteCliente(this.dataset.alias)" data-alias="${escapeAttr(cl.alias)}">✕</button>
    `;
    list.appendChild(div);
  });

  if (empty) empty.classList.add('hidden');
}

function confirmDeleteCliente(alias) {
  Sound.tap();
  showConfirmDialog('🗑️', 'Eliminar cliente', `¿Eliminar cliente "${alias}"?`, () => {
    deleteCliente(alias);
    renderMgmtClientes();
    showToast('Cliente eliminado');
    Sound.delete();
  }, () => {});
}

function saveMgmtCliente() {
  const cl = {
    nombre:    document.getElementById('mgmt-cl-nombre').value.trim(),
    direccion: document.getElementById('mgmt-cl-dir').value.trim(),
    cp_ciudad: document.getElementById('mgmt-cl-cp').value.trim(),
    nif:       document.getElementById('mgmt-cl-nif').value.trim(),
    alias:     document.getElementById('mgmt-cl-alias').value.trim(),
  };
  if (!cl.nombre || !cl.nif) { showToast('Nombre y NIF son obligatorios'); Sound.error(); return; }
  if (!cl.alias) cl.alias = cl.nombre.split(' ')[0];
  saveCliente(cl);
  goBack();
  showModal('✅', 'Cliente guardado', `"${cl.alias}" guardado correctamente.`);
  Sound.save();
}

// ── HISTORIAL IVA ─────────────────────────────────────────────
function renderHistorial() {
  const listEl  = document.getElementById('historial-list');
  const emptyEl = document.getElementById('historial-empty');
  const statsEl = document.getElementById('historial-totales');
  if (!listEl || !statsEl) return;

  let hist = [];
  try { hist = getIvaHistory(); } catch (e) { hist = []; }
  hist = hist.slice().reverse();

  let tots = { totalFacturas: 0, totalSubtotal: 0, totalIva: 0, totalRetencion: 0, totalNeto: 0 };
  try { tots = getIvaTotales(); } catch (e) {}

  const fmt2 = n => (isFinite(Number(n)) ? Number(n) : 0).toFixed(2) + ' €';

  statsEl.innerHTML = `
    <div class="hist-stat"><div class="val">${tots.totalFacturas}</div><div class="lbl">Facturas</div></div>
    <div class="hist-stat"><div class="val">${fmt2(tots.totalNeto)}</div><div class="lbl">Total cobrado</div></div>
    <div class="hist-stat"><div class="val">${fmt2(tots.totalIva)}</div><div class="lbl">IVA acumulado</div></div>
    <div class="hist-stat"><div class="val">${fmt2(tots.totalRetencion)}</div><div class="lbl">Retenciones</div></div>
  `;

  listEl.innerHTML = '';

  if (hist.length === 0) { emptyEl.classList.remove('hidden'); return; }
  emptyEl.classList.add('hidden');

  hist.forEach(r => {
    const num    = r.num_factura || '—';
    const fecha  = r.fecha || r.timestamp || '—';
    const ivaPct = isFinite(Number(r.iva_pct)) ? Number(r.iva_pct) : 0;
    const retPct = isFinite(Number(r.retencion_pct)) ? Number(r.retencion_pct) : 0;

    const div = document.createElement('div');
    div.className = 'hist-card';
    div.innerHTML = `
      <div class="hist-card-header">
        <span class="hist-num">Factura ${escapeHtml(num)}</span>
        <span class="hist-fecha">${escapeHtml(fecha)}</span>
      </div>
      <div class="hist-rows">
        <div class="hist-row"><span>Subtotal</span><span>${fmt2(r.subtotal)}</span></div>
        <div class="hist-row"><span>IVA (${ivaPct}%)</span><span>${fmt2(r.iva_importe)}</span></div>
        ${retPct > 0 ? `<div class="hist-row hist-row-ret"><span>Retención (${retPct}%)</span><span>−${fmt2(r.retencion_importe)}</span></div>` : ''}
        <div class="hist-row total"><span>TOTAL</span><span>${fmt2(r.total)}</span></div>
      </div>
    `;
    listEl.appendChild(div);
  });
}

function clearHistorial() {
  Sound.tap();
  showConfirmDialog('🗑️', 'Borrar historial', '¿Borrar todo el historial de IVA? Esta acción no se puede deshacer.',
    () => { clearIvaHistory(); renderHistorial(); showToast('Historial borrado'); Sound.delete(); }, null);
}

// ── FACTURAS ─────────────────────────────────────────────────
// Lee del índice en localStorage (sync/fast) y del filesystem en segundo plano
function _getFacturasCache() {
  try {
    const raw = localStorage.getItem('facturapp_file_index');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  return [];
}

function renderFacturas() {
  const list  = document.getElementById('facturas-list');
  const empty = document.getElementById('facturas-empty');
  const stats = document.getElementById('facturas-stats');
  if (!list) return;

  // Si hay búsqueda activa, usar filtrado
  const searchInput = document.getElementById('facturas-search');
  if (searchInput && searchInput.value.trim()) {
    filtrarFacturas();
    return;
  }

  const facturas = _getFacturasCache();
  list.innerHTML = '';

  if (stats) {
    const totalEuros = facturas.reduce((a, f) => a + Number(f.total || 0), 0);
    const cobrados = facturas.filter(f => getEstadoCobro(f.nombre) === 'cobrado').length;
    stats.innerHTML = `
      <div class="hist-stat"><div class="val">${facturas.length}</div><div class="lbl">Facturas</div></div>
      <div class="hist-stat"><div class="val">${totalEuros.toFixed(2)} €</div><div class="lbl">Total emitido</div></div>
      <div class="hist-stat"><div class="val">${cobrados}</div><div class="lbl">Cobradas</div></div>
    `;
  }

  if (!facturas.length) {
    if (empty) { empty.classList.remove('hidden'); empty.querySelector('p').innerHTML = 'No hay facturas guardadas aún.<br>Crea tu primera factura.'; }
    return;
  }
  if (empty) empty.classList.add('hidden');

  facturas.forEach((f, index) => {
    const div = document.createElement('div');
    div.className = 'emitida-card';
    div.style.animationDelay = `${index * 40}ms`;
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');

    div.innerHTML = `
      <div class="emitida-card-top">
        <div class="emitida-info">
          <span class="emitida-num">Factura ${escapeHtml(f.num_factura || f.nombre)}</span>
          <span class="emitida-fecha">${escapeHtml(f.fecha || '—')}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${getBadgeCobro(f.nombre)}
          <span class="emitida-total">${Number(f.total || 0).toFixed(2)} €</span>
        </div>
      </div>
      <div class="emitida-card-sub">
        <span>👤 ${escapeHtml(f.cliente || '—')}</span>
        <span>🏢 ${escapeHtml(f.emisor  || '—')}</span>
        <button class="btn-small" onclick="event.stopPropagation();toggleCobro('${escapeAttr(f.nombre)}')" style="margin-left:auto">
          ${getEstadoCobro(f.nombre) === 'cobrado' ? '🔄 Pendiente' : '✓ Cobrado'}
        </button>
      </div>
      <div class="emitida-hold-hint">Mantén pulsado para ver opciones</div>
    `;

    const editable = !!f.datos_completos;
    div.onpointerdown   = ev => _startFactLongPress(ev, f.nombre, editable);
    div.onpointerup     = _cancelFactLongPress;
    div.onpointerleave  = _cancelFactLongPress;
    div.onpointercancel = _cancelFactLongPress;
    div.oncontextmenu   = ev => { ev.preventDefault(); _showFactMenu(f.nombre, editable); };
    div.onclick = () => {
      if (window._factLPFired) { window._factLPFired = false; return; }
      showToast('Mantén pulsado para ver opciones');
    };
    div.onkeydown = ev => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); _showFactMenu(f.nombre, editable); }
    };
    list.appendChild(div);
  });

  // Sync en segundo plano desde filesystem (sin bloquear UI)
  leerIndice().then(fs => {
    if (fs.length !== facturas.length) {
      // Actualizar caché y re-render silencioso
      try { localStorage.setItem('facturapp_file_index', JSON.stringify(fs)); } catch (_) {}
      if (state.currentScreen === 'screen-facturas') renderFacturas();
    }
  }).catch(() => {});
}

let _factLPTimer = null;
window._factLPFired = false;

function _startFactLongPress(ev, nombre, editable) {
  _cancelFactLongPress();
  window._factLPFired = false;
  ev.currentTarget.classList.add('long-pressing');
  _factLPTimer = setTimeout(() => {
    window._factLPFired = true;
    ev.currentTarget.classList.remove('long-pressing');
    _showFactMenu(nombre, editable);
  }, 520);
}

function _cancelFactLongPress(ev) {
  if (_factLPTimer) clearTimeout(_factLPTimer);
  _factLPTimer = null;
  if (ev?.currentTarget) ev.currentTarget.classList.remove('long-pressing');
}

function _showFactMenu(nombre, editable) {
  const encoded = encodeURIComponent(nombre);
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div class="action-sheet" onclick="event.stopPropagation()">
      <div class="sheet-handle"></div>
      <div class="sheet-title">Factura</div>
      <div class="sheet-subtitle">${escapeHtml(nombre)}</div>
      <div class="sheet-actions">
        <button class="sheet-action" onclick="closeModal();accionAbrir(decodeURIComponent('${encoded}'))">📄 Abrir vista previa</button>
        ${editable ? `<button class="sheet-action" onclick="closeModal();editarFactura(decodeURIComponent('${encoded}'))">✏️ Editar</button>` : ''}
        <button class="sheet-action" onclick="closeModal();accionExportarFactura(decodeURIComponent('${encoded}'))">⬇️ Exportar PDF</button>
        <button class="sheet-action" onclick="closeModal();accionEmail(decodeURIComponent('${encoded}'))">📧 Enviar por email</button>
        <button class="sheet-action" onclick="closeModal();accionCompartir(decodeURIComponent('${encoded}'))">🔗 Compartir</button>
        <button class="sheet-action" onclick="closeModal();accionTelegramDesdeListado(decodeURIComponent('${encoded}'))">✈️ Enviar a Telegram</button>
        <button class="sheet-action highlight" onclick="closeModal();crearRectificativaDesdeFactura(decodeURIComponent('${encoded}'))">🔄 Crear rectificativa</button>
        <button class="sheet-action danger" onclick="closeModal();_eliminarFactura(decodeURIComponent('${encoded}'))">🗑️ Eliminar</button>
      </div>
      <button class="sheet-cancel" onclick="closeModal()">Cancelar</button>
    </div>
  `;
  overlay.classList.remove('hidden');
  overlay.onclick = closeModal;
}

async function _eliminarFactura(nombre) {
  showConfirmDialog('🗑️', 'Eliminar factura', `Se eliminará "${nombre}" permanentemente.`,
    async () => {
      try {
        await eliminarFacturaPDF(nombre);
        renderFacturas();
        showToast('Factura eliminada');
      } catch (e) { showToast('Error al eliminar'); }
    }, null);
}

// ── EXPORTAR / BACKUP ────────────────────────────────────────
function renderExportar() {
  const container = document.getElementById('exportar-content');
  if (!container) return;
  const historial = getIvaHistory();
  container.innerHTML = `
    <div class="form-card">
      <div class="section-header">
        <div class="section-icon">📦</div>
        <h3>Exportar TODO</h3>
      </div>
      <p style="font-size:13px;color:var(--grey-500);margin-bottom:14px">
        Exporta TODOS tus datos en un solo archivo: emisores, clientes, facturas, presupuestos, órdenes, series, catálogo, gastos, recurrentes, rectificativas, contactos Telegram y más.
      </p>
      <button class="btn-primary full-width" onclick="accionExportarTodo()">
        📦 Exportar Backup Completo
      </button>
    </div>
    <div class="form-card" style="margin-top:12px">
      <div class="section-header">
        <div class="section-icon">📥</div>
        <h3>Importar TODO</h3>
      </div>
      <p style="font-size:13px;color:var(--grey-500);margin-bottom:14px">
        Restaura todos tus datos desde un archivo de backup. Solo se importan datos que no existan actualmente.
      </p>
      <button class="btn-primary full-width" onclick="accionImportarTodo()">
        📥 Importar Backup
      </button>
      <input type="file" id="import-file-input" accept=".json" style="display:none" onchange="handleImportFile(event)">
    </div>
    <div class="form-card" style="margin-top:12px">
      <div class="section-header">
        <div class="section-icon">💾</div>
        <h3>Backup Rápido (JSON)</h3>
      </div>
      <p style="font-size:13px;color:var(--grey-500);margin-bottom:14px">
        Exporta emisores, clientes, historial y facturas en formato JSON básico.
      </p>
      <button class="btn-primary full-width" onclick="accionExportarBackup()">
        💾 Exportar Backup JSON
      </button>
    </div>
    <div class="form-card" style="margin-top:12px">
      <div class="section-header">
        <div class="section-icon">📊</div>
        <h3>Historial IVA (CSV)</h3>
      </div>
      <p style="font-size:13px;color:var(--grey-500);margin-bottom:14px">
        Exportá el historial de IVA a CSV para abrir en Excel.
      </p>
      <button class="btn-primary full-width" onclick="accionExportarCSV()" ${historial.length === 0 ? 'disabled style="opacity:0.5"' : ''}>
        📈 Exportar CSV
      </button>
      ${historial.length === 0 ? '<p style="font-size:12px;color:var(--grey-400);margin-top:8px">No hay facturas para exportar</p>' : ''}
    </div>
    <div class="form-card" style="margin-top:12px">
      <div class="section-header">
        <div class="section-icon">✈️</div>
        <h3>Compartir Backup</h3>
      </div>
      <p style="font-size:13px;color:var(--grey-500);margin-bottom:14px">
        Enviá el backup por Telegram para tener una copia en la nube.
      </p>
      <button class="btn-primary full-width" onclick="accionCompartirBackup()">
        ✈️ Enviar Backup por Telegram
      </button>
    </div>
    <div class="form-card" style="margin-top:12px">
      <div class="section-header">
        <div class="section-icon">ℹ️</div>
        <h3>Información</h3>
      </div>
      <p style="font-size:12px;color:var(--grey-500);line-height:1.6">
        Versión: <strong>${typeof CURRENT_VERSION !== 'undefined' ? CURRENT_VERSION : '3.1.0'}</strong><br>
        Licencia: <strong>${typeof isAppLicensed === 'function' && isAppLicensed() ? '✅ Activada' : '❌ No activada'}</strong><br>
        Último backup: <strong>${localStorage.getItem('facturapp_last_update_check') ? new Date(parseInt(localStorage.getItem('facturapp_last_update_check'))).toLocaleDateString('es-ES') : 'Nunca'}</strong>
      </p>
    </div>
    ${sbIsConfigured() ? `
    <div class="form-card" style="margin-top:12px">
      <div class="section-header">
        <div class="section-icon">👤</div>
        <h3>Cuenta</h3>
      </div>
      <p style="font-size:13px;color:var(--grey-500);margin-bottom:14px" id="account-email">Cargando…</p>
      <button class="btn-secondary full-width" onclick="handleLogout()" style="margin-bottom:8px">
        Cerrar sesión
      </button>
      <button class="btn-delete full-width" onclick="handleDeleteAccount()" style="min-height:46px;font-size:14px;font-weight:600;width:100%">
        Eliminar cuenta y datos
      </button>
    </div>
    ` : ''}
  `;
  if (sbIsConfigured()) {
    sbGetUser().then(u => {
      const el = document.getElementById('account-email');
      if (el && u) el.textContent = u.email;
    });
  }
}

async function accionExportarTodo() {
  showToast('Generando backup completo…');
  try {
    const res = descargarBackupCompleto();
    if (res.ok) showModal('✅', 'Backup completo exportado', `Archivo: ${res.nombre}\nTamaño: ${(res.size / 1024).toFixed(1)} KB`);
  } catch (e) { showToast('Error al generar backup'); }
}

function accionImportarTodo() {
  const input = document.getElementById('import-file-input');
  if (input) input.click();
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  showConfirmDialog(
    '📥', 'Importar backup',
    `Se importarán los datos de "${file.name}". Solo se agregarán datos que no existan. ¿Continuar?`,
    () => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const result = importarTodo(e.target.result);
        if (result.ok) {
          showModal('✅', 'Backup importado', result.msg + `\n\nFecha del backup: ${result.fecha_backup}`);
        } else {
          showModal('❌', 'Error al importar', result.msg);
        }
      };
      reader.readAsText(file);
    },
    null
  );
  event.target.value = '';
}

async function accionExportarBackup() {
  showToast('Generando backup…');
  try {
    const res = await exportarBackup();
    if (res.ok) showModal('✅', 'Backup generado', `Guardado en: ${res.ruta}`);
  } catch (e) { showToast('Error al generar backup'); }
}

function accionExportarCSV() {
  const csv = exportarCSV();
  if (csv) showToast('CSV descargado');
  else     showToast('No hay datos para exportar');
}

async function accionCompartirBackup() {
  showToast('Preparando backup…');
  try {
    const res = await exportarBackup();
    if (!res.data) { showToast('Error al generar backup'); return; }

    const contacts = _getTgContacts();
    if (contacts.length === 0) {
      showModal('⚠️', 'Sin vincular', 'Vincula tu Telegram primero en la configuración.');
      return;
    }

    // Usar el primer contacto disponible
    const chatId = contacts[0].chatId;

    const blob = new Blob([res.data], { type: 'application/json' });
    const form = new FormData();
    form.append('chat_id', chatId);
    form.append('caption', '📦 Backup FacturAPP');
    form.append('document', blob, `facturapp_backup_${new Date().toISOString().split('T')[0]}.json`);

    const resp = await fetch(`https://api.telegram.org/bot${_getTgBotToken()}/sendDocument`, {
      method: 'POST', body: form
    });
    const json = await resp.json();
    if (json.ok) showModal('🎉', '¡Backup enviado!', 'Tu backup se envió correctamente a Telegram.');
    else throw new Error(json.description);
  } catch (e) { showModal('❌', 'Error', e.message); }
}

// ── ACCIONES FACTURAS EMITIDAS ────────────────────────────────
// accionAbrir, accionExportarFactura, accionCompartir — defined in fileActions.js

async function accionEmail(nombre) {
  const base64 = await _leerPDFLocal(nombre);
  if (!base64) { showToast('PDF no disponible'); return; }

  // Buscar email del cliente en los datos de la factura
  let clienteEmail = '';
  try {
    const datos = await leerDatosFactura(nombre);
    if (datos?.cliente?.email) {
      clienteEmail = datos.cliente.email;
    }
  } catch (_) {}

  // Crear blob del PDF
  const byteChars = atob(base64);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
  const blob = new Blob([byteArray], { type: 'application/pdf' });
  const blobUrl = URL.createObjectURL(blob);

  // Intentar Share API primero (permite elegir email, WhatsApp, etc.)
  try {
    const plugins = window.Capacitor?.Plugins;
    const Share   = plugins?.Share;
    const Fs      = getFS();
    const Dir     = getDir();
    if (Share && Fs) {
      const path = `Facturas/${nombre}`;
      await Fs.writeFile({ path, data: base64, directory: Dir.Cache, recursive: true });
      const { uri } = await Fs.getUri({ path, directory: Dir.Cache });
      await Share.share({
        title: nombre,
        text: `Adjunto ${nombre}`,
        url: uri,
        dialogTitle: 'Enviar por email'
      });
      URL.revokeObjectURL(blobUrl);
      return;
    }
  } catch (_) {}

  // Fallback: mailto con subject pre-rellenado
  const subject = encodeURIComponent(`Factura ${nombre}`);
  const body = encodeURIComponent(`Adjunto la factura ${nombre}.\n\nSaludos.`);
  const mailtoUrl = clienteEmail
    ? `mailto:${clienteEmail}?subject=${subject}&body=${body}`
    : `mailto:?subject=${subject}&body=${body}`;

  window.open(mailtoUrl, '_blank');
  URL.revokeObjectURL(blobUrl);
  showToast('Abre tu cliente de email para adjuntar el PDF');
}

// ── NOTA DE CRÉDITO / RECTIFICATIVA (desde menú facturas) ───
// Usar crearRectificativaDesdeFactura() definida abajo en la sección de rectificativas

async function accionTelegramDesdeListado(nombre) {
  const base64 = await _leerPDFLocal(nombre);
  if (!base64) { showToast('PDF no disponible'); return; }
  state._lastPdf = { base64Data: base64, nombre };
  showTelegramForm(state._lastPdf);
}

// accionEliminar — defined in fileActions.js

// ── UTILIDADES ────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;');
}

function escapeAttr(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;');
}

// ── MODALES ───────────────────────────────────────────────────
function showToast(msg) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(function() { t.classList.remove('show'); }, 2800);
  if (msg.includes('❌') || msg.includes('Error') || msg.includes('obligatorio') || msg.includes('inválido')) Sound.error();
  else Sound.notification();
}

function showModal(icon, title, msg) {
  var o = document.getElementById('modal-overlay');
  if (!o) return;
  var i = document.getElementById('modal-icon');
  var t = document.getElementById('modal-title');
  var m = document.getElementById('modal-msg');
  if (i && t && m) {
    i.textContent = icon;
    t.textContent = title;
    m.textContent = msg;
  } else {
    o.innerHTML = `
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-icon" id="modal-icon"></div>
        <h3 id="modal-title"></h3>
        <p id="modal-msg"></p>
        <button class="btn-primary" onclick="closeModal()">Aceptar</button>
      </div>
    `;
    document.getElementById('modal-icon').textContent = icon;
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-msg').textContent = msg;
  }
  o.classList.remove('hidden');
  o.onclick = closeModal;
  Sound.pop();
}

function closeModal() {
  Sound.tap();
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  if (window._previewObjectUrl) {
    URL.revokeObjectURL(window._previewObjectUrl);
    window._previewObjectUrl = null;
  }
  overlay.onclick  = closeModal;
  overlay.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-icon" id="modal-icon">✅</div>
      <h3 id="modal-title">Título</h3>
      <p id="modal-msg">Mensaje</p>
      <button class="btn-primary" onclick="closeModal()">Aceptar</button>
    </div>
  `;
}

function showConfirmDialog(icon, title, msg, onSi, onNo) {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  Sound.pop();
  overlay.onclick = null;

  overlay.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-icon"></div>
      <h3></h3>
      <p style="margin-bottom:20px"></p>
      <div class="row-btns">
        <button class="btn-secondary" id="confirmNoBtn">No</button>
        <button class="btn-primary"   id="confirmSiBtn">Sí</button>
      </div>
    </div>
  `;
  overlay.querySelector('.modal-icon').textContent = icon;
  overlay.querySelector('h3').textContent = title;
  overlay.querySelector('p').textContent = msg;

  document.getElementById('confirmNoBtn').addEventListener('click', function() {
    overlay.classList.add('hidden');
    if (onNo) onNo();
  });
  document.getElementById('confirmSiBtn').addEventListener('click', function() {
    overlay.classList.add('hidden');
    if (onSi) onSi();
  });
}

// ══════════════════════════════════════════════════════════════
//  BÚSQUEDA Y FILTROS
// ══════════════════════════════════════════════════════════════

// ── Facturas: búsqueda + filtros por fecha ──────────────────
function filtrarFacturas() {
  const query = (document.getElementById('facturas-search')?.value || '').toLowerCase().trim();
  const fechaDesde = document.getElementById('facturas-fecha-desde')?.value || '';
  const fechaHasta = document.getElementById('facturas-fecha-hasta')?.value || '';
  const clearBtn = document.getElementById('facturas-search-clear');
  const cobroFilter = state._cobroFilter || 'todos';

  if (clearBtn) clearBtn.classList.toggle('visible', query.length > 0);

  const facturas = _getFacturasCache();
  let filtradas = facturas;

  // Filtro por texto
  if (query) {
    filtradas = filtradas.filter(f => {
      const num = (f.num_factura || f.nombre || '').toLowerCase();
      const cli = (f.cliente || '').toLowerCase();
      const emi = (f.emisor || '').toLowerCase();
      return num.includes(query) || cli.includes(query) || emi.includes(query);
    });
  }

  // Filtro por fecha
  if (fechaDesde || fechaHasta) {
    filtradas = filtradas.filter(f => {
      const fechaISO = _fechaToISO(f.fecha);
      if (!fechaISO) return false;
      if (fechaDesde && fechaISO < fechaDesde) return false;
      if (fechaHasta && fechaISO > fechaHasta) return false;
      return true;
    });
  }

  // Filtro por estado de cobro
  if (cobroFilter !== 'todos') {
    filtradas = filtradas.filter(f => getEstadoCobro(f.nombre) === cobroFilter);
  }

  _renderFacturasFiltradas(filtradas);
}

function filtrarPorCobro(estado) {
  state._cobroFilter = estado;
  // Actualizar botones activos
  document.querySelectorAll('.cobro-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.estado === estado);
  });
  filtrarFacturas();
}

function _fechaToISO(fecha) {
  if (!fecha) return '';
  const parts = String(fecha).split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  if (fecha.includes('-')) return fecha;
  return '';
}

function _renderFacturasFiltradas(facturas) {
  const list  = document.getElementById('facturas-list');
  const empty = document.getElementById('facturas-empty');
  const stats = document.getElementById('facturas-stats');
  if (!list) return;

  list.innerHTML = '';

  if (stats) {
    const totalEuros = facturas.reduce((a, f) => a + Number(f.total || 0), 0);
    const cobrados = facturas.filter(f => getEstadoCobro(f.nombre) === 'cobrado').length;
    stats.innerHTML = `
      <div class="hist-stat"><div class="val">${facturas.length}</div><div class="lbl">Facturas</div></div>
      <div class="hist-stat"><div class="val">${totalEuros.toFixed(2)} €</div><div class="lbl">Total emitido</div></div>
      <div class="hist-stat"><div class="val">${cobrados}</div><div class="lbl">Cobradas</div></div>
    `;
  }

  if (!facturas.length) {
    if (empty) { empty.classList.remove('hidden'); const pEl2 = empty.querySelector('p'); if (pEl2) pEl2.textContent = 'No se encontraron facturas.'; }
    return;
  }
  if (empty) empty.classList.add('hidden');

  facturas.forEach((f, index) => {
    const div = document.createElement('div');
    div.className = 'emitida-card';
    div.style.animationDelay = `${index * 40}ms`;
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');

    div.innerHTML = `
      <div class="emitida-card-top">
        <div class="emitida-info">
          <span class="emitida-num">Factura ${escapeHtml(f.num_factura || f.nombre)}</span>
          <span class="emitida-fecha">${escapeHtml(f.fecha || '—')}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${getBadgeCobro(f.nombre)}
          <span class="emitida-total">${Number(f.total || 0).toFixed(2)} €</span>
        </div>
      </div>
      <div class="emitida-card-sub">
        <span>👤 ${escapeHtml(f.cliente || '—')}</span>
        <span>🏢 ${escapeHtml(f.emisor  || '—')}</span>
        <button class="btn-small" onclick="event.stopPropagation();toggleCobro('${escapeAttr(f.nombre)}')" style="margin-left:auto">
          ${getEstadoCobro(f.nombre) === 'cobrado' ? '🔄 Pendiente' : '✓ Cobrado'}
        </button>
      </div>
      <div class="emitida-hold-hint">Mantén pulsado para ver opciones</div>
    `;

    const editable = !!f.datos_completos;
    div.onpointerdown   = ev => _startFactLongPress(ev, f.nombre, editable);
    div.onpointerup     = _cancelFactLongPress;
    div.onpointerleave  = _cancelFactLongPress;
    div.onpointercancel = _cancelFactLongPress;
    div.oncontextmenu   = ev => { ev.preventDefault(); _showFactMenu(f.nombre, editable); };
    div.onclick = () => {
      if (window._factLPFired) { window._factLPFired = false; return; }
      showToast('Mantén pulsado para ver opciones');
    };
    div.onkeydown = ev => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); _showFactMenu(f.nombre, editable); }
    };
    list.appendChild(div);
  });
}

function limpiarBusquedaFacturas() {
  const input = document.getElementById('facturas-search');
  if (input) input.value = '';
  filtrarFacturas();
}

function limpiarFechasFacturas() {
  const desde = document.getElementById('facturas-fecha-desde');
  const hasta = document.getElementById('facturas-fecha-hasta');
  if (desde) desde.value = '';
  if (hasta) hasta.value = '';
  filtrarFacturas();
}

// ── Emisores: búsqueda ─────────────────────────────────────
function filtrarEmisores() {
  const query = (document.getElementById('emisores-search')?.value || '').toLowerCase().trim();
  const clearBtn = document.getElementById('emisores-search-clear');
  if (clearBtn) clearBtn.classList.toggle('visible', query.length > 0);

  const emisores = getEmisores();
  let filtrados = emisores;

  if (query) {
    filtrados = emisores.filter(em => {
      const nombre = (em.nombre || '').toLowerCase();
      const alias  = (em.alias || '').toLowerCase();
      const doi    = (em.doi || '').toLowerCase();
      const ciudad = (em.cp_ciudad || '').toLowerCase();
      return nombre.includes(query) || alias.includes(query) || doi.includes(query) || ciudad.includes(query);
    });
  }

  _renderEmisoresFiltrados(filtrados);
}

function _renderEmisoresFiltrados(emisores) {
  const list  = document.getElementById('emisores-mgmt-list');
  const empty = document.getElementById('emisores-empty');
  if (!list) return;
  list.innerHTML = '';

  if (!emisores.length) {
    if (empty) { empty.classList.remove('hidden'); empty.querySelector('p').textContent = 'No se encontraron emisores.'; }
    return;
  }
  if (empty) empty.classList.add('hidden');

  emisores.forEach(em => {
    const isPredefined = em._predefined;
    const div = document.createElement('div');
    div.className = 'mgmt-card';
    div.innerHTML = `
      <div class="mgmt-card-body">
        <strong>${escapeHtml(em.nombre)}</strong>
        <small>${escapeHtml(em.cp_ciudad)} · ${escapeHtml(em.doi)}</small>
      </div>
      ${isPredefined
        ? `<span class="mgmt-alias">${escapeHtml(em.alias)} ⭐</span>`
        : `${em.alias ? `<span class="mgmt-alias">${escapeHtml(em.alias)}</span>` : ''}
          <button class="btn-delete" onclick="confirmDeleteEmisor(this.dataset.alias)" data-alias="${escapeAttr(em.alias)}">✕</button>`
      }
    `;
    list.appendChild(div);
  });
}

function limpiarBusquedaEmisores() {
  const input = document.getElementById('emisores-search');
  if (input) input.value = '';
  filtrarEmisores();
}

// ── Clientes: búsqueda ─────────────────────────────────────
function filtrarClientes() {
  const query = (document.getElementById('clientes-search')?.value || '').toLowerCase().trim();
  const clearBtn = document.getElementById('clientes-search-clear');
  if (clearBtn) clearBtn.classList.toggle('visible', query.length > 0);

  const clientes = getClientes();
  let filtrados = clientes;

  if (query) {
    filtrados = clientes.filter(cl => {
      const nombre = (cl.nombre || '').toLowerCase();
      const alias  = (cl.alias || '').toLowerCase();
      const nif    = (cl.nif || '').toLowerCase();
      const ciudad = (cl.cp_ciudad || '').toLowerCase();
      return nombre.includes(query) || alias.includes(query) || nif.includes(query) || ciudad.includes(query);
    });
  }

  _renderClientesFiltrados(filtrados);
}

function _renderClientesFiltrados(clientes) {
  const list  = document.getElementById('clientes-mgmt-list');
  const empty = document.getElementById('clientes-empty');
  if (!list) return;
  list.innerHTML = '';

  if (!clientes.length) {
    if (empty) { empty.classList.remove('hidden'); empty.querySelector('p').textContent = 'No se encontraron clientes.'; }
    return;
  }
  if (empty) empty.classList.add('hidden');

  clientes.forEach(cl => {
    const isPredefined = cl._predefined;
    const div = document.createElement('div');
    div.className = 'mgmt-card';
    div.innerHTML = `
      <div class="mgmt-card-body">
        <strong>${escapeHtml(cl.nombre)}</strong>
        <small>${escapeHtml(cl.cp_ciudad)} · ${escapeHtml(cl.nif)}</small>
      </div>
      ${isPredefined
        ? `<span class="mgmt-alias">${escapeHtml(cl.alias)} ⭐</span>`
        : `${cl.alias ? `<span class="mgmt-alias">${escapeHtml(cl.alias)}</span>` : ''}
          <button class="btn-delete" onclick="confirmDeleteCliente(this.dataset.alias)" data-alias="${escapeAttr(cl.alias)}">✕</button>`
      }
    `;
    list.appendChild(div);
  });
}

function limpiarBusquedaClientes() {
  const input = document.getElementById('clientes-search');
  if (input) input.value = '';
  filtrarClientes();
}

// ── Helpers: limpiar búsquedas al navegar ───────────────────
function _clearSearchFacturas() {
  const s = document.getElementById('facturas-search');
  const d = document.getElementById('facturas-fecha-desde');
  const h = document.getElementById('facturas-fecha-hasta');
  if (s) s.value = '';
  if (d) d.value = '';
  if (h) h.value = '';
  const c = document.getElementById('facturas-search-clear');
  if (c) c.classList.remove('visible');
}

function _clearSearchEmisores() {
  const s = document.getElementById('emisores-search');
  if (s) s.value = '';
  const c = document.getElementById('emisores-search-clear');
  if (c) c.classList.remove('visible');
}

function _clearSearchClientes() {
  const s = document.getElementById('clientes-search');
  if (s) s.value = '';
  const c = document.getElementById('clientes-search-clear');
  if (c) c.classList.remove('visible');
}

// ══════════════════════════════════════════════════════════════
//  SERIES DE NUMERACIÓN — UI
// ══════════════════════════════════════════════════════════════

let _serieEditando = null;

function renderSeriesList() {
  const list = document.getElementById('series-list');
  if (!list) return;
  const series = getSeries();
  list.innerHTML = '';

  if (!series.length) {
    list.innerHTML = '<div class="empty-state"><span>🔢</span><p>No hay series configuradas.</p></div>';
    return;
  }

  series.forEach(serie => {
    const div = document.createElement('div');
    div.className = 'emitida-card';
    div.style.cursor = 'default';
    div.innerHTML = `
      <div class="emitida-card-top">
        <div class="emitida-info">
          <span class="emitida-num">${escapeHtml(serie.prefijo)} <small style="opacity:0.6">(${escapeHtml(serie.nombre)})</small></span>
          <span class="emitida-fecha">Último número: ${String(serie.ultimoNumero || 0).padStart(4, '0')}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          ${serie.activa
            ? '<span class="badge-success">Activa</span>'
            : `<button class="btn-small" onclick="activarSerie('${serie.id}')">Activar</button>`
          }
        </div>
      </div>
      <div class="emitida-card-sub" style="justify-content:flex-end;gap:8px;">
        <button class="btn-small" onclick="editarSerie('${serie.id}')">✏️ Editar</button>
        ${series.length > 1 ? `<button class="btn-delete" onclick="eliminarSerie('${serie.id}')">🗑️</button>` : ''}
      </div>
    `;
    list.appendChild(div);
  });
}

function mostrarFormSerie(serie) {
  const form = document.getElementById('series-form');
  const nombreInput = document.getElementById('serie-nombre');
  const prefijoInput = document.getElementById('serie-prefijo');
  if (!form) return;

  _serieEditando = serie || null;
  if (nombreInput) nombreInput.value = serie ? serie.nombre : '';
  if (prefijoInput) prefijoInput.value = serie ? serie.prefijo : '';
  form.classList.remove('hidden');
  Sound.tap();
}

function cancelarFormSerie() {
  const form = document.getElementById('series-form');
  if (form) form.classList.add('hidden');
  _serieEditando = null;
  Sound.tap();
}

function guardarSerie() {
  const nombre = (document.getElementById('serie-nombre')?.value || '').trim();
  const prefijo = (document.getElementById('serie-prefijo')?.value || '').trim().toUpperCase();

  if (!nombre) { showToast('Introduce un nombre para la serie'); Sound.error(); return; }
  if (!prefijo) { showToast('Introduce un prefijo (ej: FACT)'); Sound.error(); return; }
  if (prefijo.length > 10) { showToast('El prefijo no puede tener más de 10 caracteres'); Sound.error(); return; }

  const wasEditing = !!_serieEditando;

  if (_serieEditando) {
    // Editar existente
    _serieEditando.nombre = nombre;
    _serieEditando.prefijo = prefijo;
    saveSerie(_serieEditando);
  } else {
    // Nueva serie
    const nueva = {
      id: 'serie_' + Date.now(),
      nombre: nombre,
      prefijo: prefijo,
      ultimoNumero: 0,
      activa: false
    };
    saveSerie(nueva);
  }

  cancelarFormSerie();
  renderSeriesList();
  showToast(wasEditing ? 'Serie actualizada' : 'Serie creada');
  Sound.save();
}

function editarSerie(id) {
  const series = getSeries();
  const serie = series.find(s => s.id === id);
  if (serie) mostrarFormSerie(serie);
}

function activarSerie(id) {
  setSerieActiva(id);
  renderSeriesList();
  showToast('Serie activada');
}

function eliminarSerie(id) {
  showConfirmDialog('🗑️', 'Eliminar serie', '¿Eliminar esta serie de numeración?', () => {
    deleteSerie(id);
    renderSeriesList();
    showToast('Serie eliminada');
  }, null);
}

// ══════════════════════════════════════════════════════════════
//  CATÁLOGO DE PRODUCTOS — Premium UI
// ══════════════════════════════════════════════════════════════

let _catalogoEditando = null;
let _catalogoCatFiltro = null;

const CATALOGO_EMOJIS = { 'Materiales': '🔧', 'Mano de obra': '👷', 'Servicios': '💼', 'Herramientas': '🧰', 'Transporte': '🚚', 'Suministros': '📦', 'Mantenimiento': '🔩', 'Instalaciones': '⚡' };
const CATALOGO_CAT_CLASSES = { 'Materiales': 'cat-materiales', 'Mano de obra': 'cat-mano-de-obra', 'Servicios': 'cat-servicios' };
function _catEmoji(cat) { return CATALOGO_EMOJIS[cat] || '📦'; }
function _catClass(cat) { return CATALOGO_CAT_CLASSES[cat] || 'cat-otros'; }

function renderCatalogoList() {
  const list = document.getElementById('catalogo-list');
  const empty = document.getElementById('catalogo-empty');
  const countEl = document.getElementById('catalogo-count');
  const statsEl = document.getElementById('catalogo-stats');
  const catContainer = document.getElementById('catalogo-categorias');
  if (!list) return;

  const catalogo = getCatalogo();
  list.innerHTML = '';

  if (countEl) countEl.textContent = catalogo.length;

  if (!catalogo.length) {
    if (empty) empty.classList.remove('hidden');
    if (catContainer) catContainer.innerHTML = '';
    if (statsEl) statsEl.innerHTML = '';
    return;
  }
  if (empty) empty.classList.add('hidden');

  const totalValor = catalogo.reduce((s, c) => s + (Number(c.precio) || 0), 0);
  const cats = [...new Set(catalogo.map(c => c.categoria).filter(Boolean))];
  if (statsEl) {
    statsEl.innerHTML = `
      <span class="stat"><strong>${catalogo.length}</strong> productos</span>
      <span class="stat"><strong>${cats.length}</strong> categorías</span>
      <span class="stat">Valor: <strong>${totalValor.toFixed(2)} €</strong></span>
    `;
  }

  if (catContainer) {
    const catCounts = {};
    catalogo.forEach(c => { const k = c.categoria || 'Sin categoría'; catCounts[k] = (catCounts[k] || 0) + 1; });
    let catHtml = `<div class="catalogo-cat-tab ${!_catalogoCatFiltro ? 'active' : ''}" onclick="setCatalogoCatFiltro(null)">Todos <span class="cat-count">${catalogo.length}</span></div>`;
    Object.keys(catCounts).forEach(cat => {
      const isActive = _catalogoCatFiltro === cat;
      catHtml += `<div class="catalogo-cat-tab ${isActive ? 'active' : ''}" onclick="setCatalogoCatFiltro('${escapeAttr(cat)}')">${escapeHtml(cat)} <span class="cat-count">${catCounts[cat]}</span></div>`;
    });
    catContainer.innerHTML = catHtml;
  }

  let items = catalogo;
  if (_catalogoCatFiltro) items = items.filter(c => (c.categoria || 'Sin categoría') === _catalogoCatFiltro);

  items.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'catalogo-card';
    card.style.animationDelay = `${i * 0.04}s`;
    card.onclick = (e) => { if (!e.target.closest('.catalogo-card-btn')) editarCatalogo(item.id); };
    card.innerHTML = `
      <div class="catalogo-card-actions">
        <button class="catalogo-card-btn edit" onclick="event.stopPropagation();editarCatalogo('${item.id}')" title="Editar">✏️</button>
        <button class="catalogo-card-btn delete" onclick="event.stopPropagation();eliminarCatalogoItem('${item.id}')" title="Eliminar">🗑️</button>
      </div>
      <div class="catalogo-card-emoji">${_catEmoji(item.categoria)}</div>
      <div class="catalogo-card-name">${escapeHtml(item.nombre)}</div>
      ${item.descripcion ? `<div class="catalogo-card-desc">${escapeHtml(item.descripcion)}</div>` : ''}
      <div class="catalogo-card-bottom">
        <span class="catalogo-card-price">${Number(item.precio || 0).toFixed(2)} €</span>
        <span class="catalogo-card-cat ${_catClass(item.categoria)}">${escapeHtml(item.categoria || 'General')}</span>
      </div>
    `;
    list.appendChild(card);
  });
}

function setCatalogoCatFiltro(cat) {
  _catalogoCatFiltro = cat;
  filtrarCatalogo();
}

function mostrarFormCatalogo(item) {
  const form = document.getElementById('catalogo-form');
  if (!form) return;
  Sound.tap();
  _catalogoEditando = item || null;
  document.getElementById('catalogo-form-title').textContent = item ? 'Editar Producto' : 'Nuevo Producto';
  document.getElementById('cat-nombre').value = item ? item.nombre : '';
  document.getElementById('cat-descripcion').value = item ? (item.descripcion || '') : '';
  document.getElementById('cat-precio').value = item ? item.precio : '';
  document.getElementById('cat-categoria').value = item ? (item.categoria || '') : '';

  const chipContainer = document.getElementById('cat-categoria-select');
  if (chipContainer) {
    const catalogo = getCatalogo();
    const existingCats = [...new Set(catalogo.map(c => c.categoria).filter(Boolean))];
    const presetCats = ['Materiales', 'Mano de obra', 'Servicios', 'Herramientas', 'Transporte', 'Suministros'];
    const allCats = [...new Set([...presetCats, ...existingCats])];
    const selected = item ? (item.categoria || '') : '';
    chipContainer.innerHTML = allCats.map(c =>
      `<div class="catalogo-categoria-chip ${selected === c ? 'selected' : ''}" onclick="selectCatalogoCategoria('${escapeAttr(c)}')">${escapeHtml(c)}</div>`
    ).join('');
  }

  form.classList.remove('hidden');
}

function selectCatalogoCategoria(cat) {
  document.getElementById('cat-categoria').value = cat;
  document.querySelectorAll('.catalogo-categoria-chip').forEach(el => {
    el.classList.toggle('selected', el.textContent.trim() === cat);
  });
}

function cancelarFormCatalogo() {
  const form = document.getElementById('catalogo-form');
  if (form) form.classList.add('hidden');
  _catalogoEditando = null;
  Sound.tap();
}

function guardarCatalogoItem() {
  const nombre = (document.getElementById('cat-nombre').value || '').trim();
  const descripcion = (document.getElementById('cat-descripcion').value || '').trim();
  const precio = parseFloat(document.getElementById('cat-precio').value) || 0;
  const categoria = (document.getElementById('cat-categoria').value || '').trim();

  if (!nombre) { showToast('Introduce un nombre para el producto'); Sound.error(); return; }

  const item = {
    id: _catalogoEditando ? _catalogoEditando.id : null,
    nombre, descripcion, precio, categoria
  };

  guardarCatalogo(item);
  cancelarFormCatalogo();
  renderCatalogoList();
  showToast(_catalogoEditando ? 'Producto actualizado' : 'Producto guardado');
  Sound.save();
}

function editarCatalogo(id) {
  const catalogo = getCatalogo();
  const item = catalogo.find(c => c.id === id);
  if (item) mostrarFormCatalogo(item);
}

function eliminarCatalogoItem(id) {
  Sound.tap();
  showConfirmDialog('🗑️', 'Eliminar producto', '¿Eliminar este producto del catálogo?', () => {
    Sound.delete();
    eliminarCatalogo(id);
    renderCatalogoList();
    showToast('Producto eliminado');
  }, null);
}

function filtrarCatalogo() {
  const query = document.getElementById('catalogo-search')?.value || '';
  const clearBtn = document.getElementById('catalogo-search-clear');
  if (clearBtn) clearBtn.classList.toggle('visible', query.length > 0);

  const list = document.getElementById('catalogo-list');
  const empty = document.getElementById('catalogo-empty');
  const countEl = document.getElementById('catalogo-count');
  if (!list) return;

  let catalogo = buscarCatalogo(query);
  if (_catalogoCatFiltro) catalogo = catalogo.filter(c => (c.categoria || 'Sin categoría') === _catalogoCatFiltro);
  list.innerHTML = '';

  if (countEl) countEl.textContent = catalogo.length;

  if (!catalogo.length) {
    if (empty) { empty.classList.remove('hidden'); const pEl3 = empty.querySelector('p.catalogo-empty-sub'); if (pEl3) pEl3.textContent = 'No se encontraron productos.'; }
    return;
  }
  if (empty) empty.classList.add('hidden');

  catalogo.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'catalogo-card';
    card.style.animationDelay = `${i * 0.04}s`;
    card.onclick = (e) => { if (!e.target.closest('.catalogo-card-btn')) editarCatalogo(item.id); };
    card.innerHTML = `
      <div class="catalogo-card-actions">
        <button class="catalogo-card-btn edit" onclick="event.stopPropagation();editarCatalogo('${item.id}')" title="Editar">✏️</button>
        <button class="catalogo-card-btn delete" onclick="event.stopPropagation();eliminarCatalogoItem('${item.id}')" title="Eliminar">🗑️</button>
      </div>
      <div class="catalogo-card-emoji">${_catEmoji(item.categoria)}</div>
      <div class="catalogo-card-name">${escapeHtml(item.nombre)}</div>
      ${item.descripcion ? `<div class="catalogo-card-desc">${escapeHtml(item.descripcion)}</div>` : ''}
      <div class="catalogo-card-bottom">
        <span class="catalogo-card-price">${Number(item.precio || 0).toFixed(2)} €</span>
        <span class="catalogo-card-cat ${_catClass(item.categoria)}">${escapeHtml(item.categoria || 'General')}</span>
      </div>
    `;
    list.appendChild(card);
  });
}

function limpiarBusquedaCatalogo() {
  const s = document.getElementById('catalogo-search');
  if (s) s.value = '';
  _catalogoCatFiltro = null;
  filtrarCatalogo();
}

// ── Abrir catálogo desde wizard (seleccionar producto) ──────
function abrirCatalogo() {
  const catalogo = getCatalogo();
  if (!catalogo.length) {
    showToast('El catálogo está vacío. Agrega productos primero.');
    Sound.error();
    return;
  }
  Sound.tap();

  let modal = document.getElementById('modal-catalogo');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'modal-catalogo';
  modal.className = 'modal-overlay';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';

  let html = `
    <div style="background:var(--bg);border-radius:16px;max-width:500px;width:100%;max-height:80vh;overflow:hidden;display:flex;flex-direction:column">
      <div style="padding:16px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <strong>Seleccionar producto del catálogo</strong>
        <button onclick="document.getElementById('modal-catalogo').remove()" style="background:none;border:none;font-size:20px;cursor:pointer">✕</button>
      </div>
      <div style="padding:16px;border-bottom:1px solid var(--border)">
        <input type="text" id="catalogo-select-search" placeholder="Buscar..." oninput="filtrarCatalogoSelect()" style="width:100%;padding:10px;border:1px solid var(--border);border-radius:8px" />
      </div>
      <div id="catalogo-select-list" style="overflow-y:auto;flex:1;padding:8px">
  `;

  catalogo.forEach(item => {
    html += `
      <div class="catalogo-card" style="cursor:pointer;margin:6px 0" onclick="seleccionarDelCatalogo('${escapeAttr(item.nombre)}', ${item.precio || 0})">
        <div class="catalogo-card-emoji" style="width:36px;height:36px;font-size:18px;border-radius:10px">${_catEmoji(item.categoria)}</div>
        <div style="flex:1;min-width:0">
          <div class="catalogo-card-name" style="font-size:13px">${escapeHtml(item.nombre)}</div>
          ${item.descripcion ? `<div class="catalogo-card-desc">${escapeHtml(item.descripcion)}</div>` : ''}
        </div>
        <div style="text-align:right">
          <div class="catalogo-card-price" style="font-size:14px">${Number(item.precio || 0).toFixed(2)} €</div>
          ${item.categoria ? `<div class="catalogo-card-cat ${_catClass(item.categoria)}" style="font-size:9px;margin-top:2px">${escapeHtml(item.categoria)}</div>` : ''}
        </div>
      </div>
    `;
  });

  html += `</div></div>`;
  modal.innerHTML = html;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function seleccionarDelCatalogo(nombre, precio) {
  const modal = document.getElementById('modal-catalogo');
  if (modal) modal.remove();
  Sound.select();
  if (typeof addProducto === 'function') {
    addProducto();
    setTimeout(() => {
      const desc = document.getElementById('inp-desc-producto');
      const prec = document.getElementById('inp-prec-producto');
      if (desc) desc.value = nombre;
      if (prec) prec.value = precio || '';
      if (desc) desc.focus();
    }, 100);
  }
}

function filtrarCatalogoSelect() {
  const query = document.getElementById('catalogo-select-search')?.value || '';
  const list = document.getElementById('catalogo-select-list');
  if (!list) return;

  const catalogo = buscarCatalogo(query);
  list.innerHTML = '';

  catalogo.forEach(item => {
    const div = document.createElement('div');
    div.className = 'catalogo-card';
    div.style.cssText = 'cursor:pointer;margin:6px 0;display:flex;align-items:center;gap:10px';
    div.onclick = () => seleccionarDelCatalogo(item.nombre, item.precio || 0);
    div.innerHTML = `
      <div class="catalogo-card-emoji" style="width:36px;height:36px;font-size:18px;border-radius:10px">${_catEmoji(item.categoria)}</div>
      <div style="flex:1;min-width:0">
        <div class="catalogo-card-name" style="font-size:13px">${escapeHtml(item.nombre)}</div>
        ${item.descripcion ? `<div class="catalogo-card-desc">${escapeHtml(item.descripcion)}</div>` : ''}
      </div>
      <div style="text-align:right">
        <div class="catalogo-card-price" style="font-size:14px">${Number(item.precio || 0).toFixed(2)} €</div>
        ${item.categoria ? `<div class="catalogo-card-cat ${_catClass(item.categoria)}" style="font-size:9px;margin-top:2px">${escapeHtml(item.categoria)}</div>` : ''}
      </div>
    `;
    list.appendChild(div);
  });
}

// ══════════════════════════════════════════════════════════════
//  CONVERSIÓN PRESUPUESTO → FACTURA
// ══════════════════════════════════════════════════════════════

function convertirPresupuestoAFactura(numero) {
  const presupuestos = getPresupuestos();
  const pres = presupuestos.find(p => p.numero === numero || p.id === numero);
  if (!pres) {
    showToast('Presupuesto no encontrado');
    return;
  }

  // Cargar datos en el wizard
  state.docType = 'factura';

  // Emisor
  if (pres.emisor) {
    state.emisor = pres.emisor;
  }

  // Cliente
  if (pres.cliente) {
    state.cliente = pres.cliente;
  }

  // Productos
  state.productos = (pres.productos || []).map(p => ({
    descripcion:     p.descripcion || '',
    precio_unitario: Number(p.precio_unitario || 0),
    cantidad:        Number(p.cantidad || 1),
    subtotal_linea:  Math.round(Number(p.cantidad || 1) * Number(p.precio_unitario || 0) * 100) / 100,
  }));

  state.materiales = (pres.materiales || []).map(m => ({
    descripcion:     m.descripcion || '',
    precio_unitario: Number(m.precio_unitario || 0),
    cantidad:        Number(m.cantidad || 1),
    subtotal_linea:  Math.round(Number(m.cantidad || 1) * Number(m.precio_unitario || 0) * 100) / 100,
  }));

  // IVA y retención
  state.iva = pres.iva || 21;
  if (pres.retencion) {
    state.retencion = pres.retencion;
    state.retencionEnabled = true;
  }

  // Número de factura
  state.numFactura = sugerirNumeroFactura();

  // Ir al wizard
  state._skipResetNueva = true;
  navigate('screen-nueva');
  goToStep(1);

  showToast('Presupuesto convertido a factura. Revisa los datos y genera el PDF.');
}

// ══════════════════════════════════════════════════════════════
//  ESTADO DE COBRO — UI
// ══════════════════════════════════════════════════════════════

function toggleCobro(nombre) {
  const actual = getEstadoCobro(nombre);
  const nuevo = actual === 'cobrado' ? 'pendiente' : 'cobrado';
  setEstadoCobro(nombre, nuevo);
  renderFacturas();
  showToast(nuevo === 'cobrado' ? 'Marcado como cobrado ✓' : 'Marcado como pendiente');
}

function getBadgeCobro(nombre) {
  const estado = getEstadoCobro(nombre);
  if (estado === 'cobrado') {
    return '<span class="badge-cobrado">Cobrado</span>';
  }
  return '<span class="badge-pendiente">Pendiente</span>';
}

// ══════════════════════════════════════════════════════════════
//  NOTAS DE CRÉDITO / RECTIFICATIVAS
// ══════════════════════════════════════════════════════════════

const KEY_RECT = 'facturapp_rectificativas';

function _getRectCache() {
  try {
    return JSON.parse(localStorage.getItem(KEY_RECT) || '[]');
  } catch { return []; }
}

function _saveRectCache(data) {
  try { localStorage.setItem(KEY_RECT, JSON.stringify(data)); } catch (_) {}
  if (typeof _cloudSync === 'function' && typeof sbIsConfigured === 'function' && sbIsConfigured()) {
    (Array.isArray(data) ? data : []).forEach(item => {
      const plain = { ...item };
      delete plain.productos;
      delete plain.materiales;
      _cloudSync('rectificativas', plain);
    });
  }
}

function renderRectificativas() {
  const list  = document.getElementById('rectificativas-list');
  const empty = document.getElementById('rectificativas-empty');
  const stats = document.getElementById('rectificativas-stats');
  if (!list) return;

  const searchInput = document.getElementById('rectificativas-search');
  if (searchInput && searchInput.value.trim()) {
    filtrarRectificativas();
    return;
  }

  const rects = _getRectCache();
  list.innerHTML = '';

  if (stats) {
    const totalEuros = rects.reduce((a, r) => a + Number(r.total || 0), 0);
    stats.innerHTML = `
      <div class="hist-stat"><div class="val">${rects.length}</div><div class="lbl">Rectificativas</div></div>
      <div class="hist-stat"><div class="val">${totalEuros.toFixed(2)} €</div><div class="lbl">Total abonado</div></div>
    `;
  }

  if (!rects.length) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  rects.forEach((r, index) => {
    const div = document.createElement('div');
    div.className = 'emitida-card';
    div.style.animationDelay = `${index * 40}ms`;
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');

    div.innerHTML = `
      <div class="emitida-card-top">
        <div class="emitida-info">
          <span class="emitida-num">RC ${escapeHtml(r.num_factura || r.nombre)}</span>
          <span class="emitida-fecha">${escapeHtml(r.fecha || '—')}</span>
        </div>
        <span class="emitida-total" style="color:#dc3545">-${Number(r.total || 0).toFixed(2)} €</span>
      </div>
      <div class="emitida-card-sub">
        <span>👤 ${escapeHtml(r.cliente || '—')}</span>
        <span>🏢 ${escapeHtml(r.emisor  || '—')}</span>
        ${r.factura_original ? `<span style="font-size:11px;opacity:0.7">📄 ${escapeHtml(r.factura_original)}</span>` : ''}
      </div>
      <div class="emitida-hold-hint">Mantén pulsado para ver opciones</div>
    `;

    div.onpointerdown   = ev => _startRectLongPress(ev, r.nombre);
    div.onpointerup     = _cancelRectLongPress;
    div.onpointerleave  = _cancelRectLongPress;
    div.onpointercancel = _cancelRectLongPress;
    div.oncontextmenu   = ev => { ev.preventDefault(); _showRectMenu(r.nombre); };
    div.onclick = () => {
      if (window._rectLPFired) { window._rectLPFired = false; return; }
      showToast('Mantén pulsado para ver opciones');
    };
    div.onkeydown = ev => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); _showRectMenu(r.nombre); }
    };
    list.appendChild(div);
  });
}

// ── Long press ──────────────────────────────────────────────
let _rectLongPressTimer = null;
function _startRectLongPress(ev, nombre) {
  _cancelRectLongPress();
  window._rectLPFired = false;
  _rectLongPressTimer = setTimeout(() => {
    window._rectLPFired = true;
    _showRectMenu(nombre);
  }, 520);
}
function _cancelRectLongPress() {
  if (_rectLongPressTimer) { clearTimeout(_rectLongPressTimer); _rectLongPressTimer = null; }
}

// ── Menú contextual ─────────────────────────────────────────
function _showRectMenu(nombre) {
  const encoded = encodeURIComponent(nombre);
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  overlay.innerHTML = `
    <div class="action-sheet" onclick="event.stopPropagation()">
      <div class="sheet-handle"></div>
      <div class="sheet-title">Nota de Crédito</div>
      <div class="sheet-subtitle">${escapeHtml(nombre)}</div>
      <div class="sheet-actions">
        <button class="sheet-action" onclick="closeModal();accionAbrirRect(decodeURIComponent('${encoded}'))">📄 Abrir vista previa</button>
        <button class="sheet-action" onclick="closeModal();accionExportarRect(decodeURIComponent('${encoded}'))">⬇️ Exportar PDF</button>
        <button class="sheet-action" onclick="closeModal();accionEmailRect(decodeURIComponent('${encoded}'))">📧 Enviar por email</button>
        <button class="sheet-action" onclick="closeModal();accionCompartirRect(decodeURIComponent('${encoded}'))">🔗 Compartir</button>
        <button class="sheet-action" onclick="closeModal();accionTelegramRect(decodeURIComponent('${encoded}'))">✈️ Enviar a Telegram</button>
        <button class="sheet-action danger" onclick="closeModal();_eliminarRect(decodeURIComponent('${encoded}'))">🗑️ Eliminar</button>
      </div>
      <button class="sheet-cancel" onclick="closeModal()">Cancelar</button>
    </div>
  `;
  overlay.classList.remove('hidden');
  overlay.onclick = closeModal;
}

// ── Acciones ────────────────────────────────────────────────
async function accionAbrirRect(nombre) {
  const base64 = await _leerPDFLocal(nombre);
  if (base64) { showPdfPreview(base64, nombre); return; }
  showToast('PDF no disponible');
}

async function accionExportarRect(nombre) {
  const base64 = await _leerPDFLocal(nombre);
  if (!base64) { showToast('PDF no disponible'); return; }
  descargarBase64PDF(base64, nombre);
  showToast('PDF exportado');
}

async function accionCompartirRect(nombre) {
  const base64 = await _leerPDFLocal(nombre);
  if (!base64) { showToast('PDF no disponible'); return; }
  try {
    const plugins = window.Capacitor?.Plugins;
    const Share   = plugins?.Share;
    const Fs      = getFS();
    const Dir     = getDir();
    if (Share && Fs) {
      const path = `Rectificativas/${nombre}`;
      await Fs.writeFile({ path, data: base64, directory: Dir.Cache, recursive: true });
      const { uri } = await Fs.getUri({ path, directory: Dir.Cache });
      await Share.share({ title: nombre, url: uri, dialogTitle: 'Compartir nota de crédito' });
      return;
    }
    _compartirComoBlob(base64, nombre);
  } catch (e) { showToast('Error al compartir'); }
}

async function accionEmailRect(nombre) {
  const base64 = await _leerPDFLocal(nombre);
  if (!base64) { showToast('PDF no disponible'); return; }
  try {
    const plugins = window.Capacitor?.Plugins;
    const Share   = plugins?.Share;
    const Fs      = getFS();
    const Dir     = getDir();
    if (Share && Fs) {
      const path = `Rectificativas/${nombre}`;
      await Fs.writeFile({ path, data: base64, directory: Dir.Cache, recursive: true });
      const { uri } = await Fs.getUri({ path, directory: Dir.Cache });
      await Share.share({ title: nombre, text: `Adjunto ${nombre}`, url: uri, dialogTitle: 'Enviar por email' });
      return;
    }
  } catch (_) {}
  const subject = encodeURIComponent(`Nota de crédito ${nombre}`);
  const body = encodeURIComponent(`Adjunto la nota de crédito ${nombre}.\n\nSaludos.`);
  window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  showToast('Abre tu cliente de email para adjuntar el PDF');
}

async function accionTelegramRect(nombre) {
  const base64 = await _leerPDFLocal(nombre);
  if (!base64) { showToast('PDF no disponible'); return; }
  showTelegramForm({ base64Data: base64, nombre });
}

async function _eliminarRect(nombre) {
  showConfirmDialog('🗑️', 'Eliminar nota de crédito', `Se eliminará "${nombre}" permanentemente.`,
    async () => {
      try {
        await eliminarFacturaPDF(nombre);
        renderRectificativas();
        showToast('Nota de crédito eliminada');
      } catch (e) { showToast('Error al eliminar'); }
    }, null);
}

// ── Crear rectificativa ─────────────────────────────────────
function nuevaRectificativa() {
  state.docType = 'factura';
  state._rectificativaRef = 'nueva';
  state._skipResetNueva = false;
  Sound.click();
  navigate('screen-nueva');
  goToStep(1);
  showToast('Creando nota de crédito. Marca los productos con precio negativo para abonar.');
}

async function crearRectificativaDesdeFactura(nombre) {
  let datosOrig = null;
  try {
    const raw = localStorage.getItem(KEY.FACT);
    if (raw) {
      const items = JSON.parse(raw);
      const fac = items.find(i => i.nombre === nombre);
      if (fac?.datos_completos) datosOrig = fac.datos_completos;
    }
  } catch (_) {}

  if (!datosOrig) {
    showToast('No se pudieron cargar los datos de la factura original');
    return;
  }

  state.docType = 'factura';
  state.emisor = datosOrig.emisor;
  state.cliente = datosOrig.cliente;
  state.iva = datosOrig.iva || 21;

  state.productos = (datosOrig.productos || []).map(p => ({
    descripcion:     `[ABONO] ${p.desc || p.descripcion || ''}`,
    precio_unitario: -(Math.abs(Number(p.price || p.precio || 0))),
    cantidad:        Number(p.qty || p.cantidad || 1),
    subtotal_linea:  -(Math.abs(Number(p.qty || p.cantidad || 1) * Number(p.price || p.precio || 0))),
  }));

  state.materiales = (datosOrig.materiales || []).map(m => ({
    descripcion:     `[ABONO] ${m.desc || m.descripcion || ''}`,
    precio_unitario: -(Math.abs(Number(m.price || m.precio || 0))),
    cantidad:        Number(m.qty || m.cantidad || 1),
    subtotal_linea:  -(Math.abs(Number(m.qty || m.cantidad || 1) * Number(m.price || m.precio || 0))),
  }));

  state.retencion = datosOrig.retencion || { rate: 0, enabled: false, showInPdf: false, applyToTotal: false };
  state.numFactura = sugerirNumeroFactura();
  state._rectificativaRef = nombre;

  state._skipResetNueva = true;
  navigate('screen-nueva');
  goToStep(1);

  showToast(`Rectificativa de ${nombre} preparada.`);
}

// ── Búsqueda ────────────────────────────────────────────────
function filtrarRectificativas() {
  const query = (document.getElementById('rectificativas-search')?.value || '').toLowerCase().trim();
  const clearBtn = document.getElementById('rectificativas-search-clear');
  if (clearBtn) clearBtn.classList.toggle('visible', query.length > 0);

  const rects = _getRectCache();
  let filtradas = rects;

  if (query) {
    filtradas = filtradas.filter(r => {
      const num = (r.num_factura || r.nombre || '').toLowerCase();
      const cli = (r.cliente || '').toLowerCase();
      const emi = (r.emisor || '').toLowerCase();
      return num.includes(query) || cli.includes(query) || emi.includes(query);
    });
  }

  const list  = document.getElementById('rectificativas-list');
  const empty = document.getElementById('rectificativas-empty');
  const stats = document.getElementById('rectificativas-stats');
  if (!list) return;

  list.innerHTML = '';

  if (stats) {
    const totalEuros = filtradas.reduce((a, r) => a + Number(r.total || 0), 0);
    stats.innerHTML = `
      <div class="hist-stat"><div class="val">${filtradas.length}</div><div class="lbl">Rectificativas</div></div>
      <div class="hist-stat"><div class="val">${totalEuros.toFixed(2)} €</div><div class="lbl">Total abonado</div></div>
    `;
  }

  if (!filtradas.length) {
    if (empty) { empty.classList.remove('hidden'); const p = empty.querySelector('p'); if (p) p.textContent = 'No se encontraron notas de crédito.'; }
    return;
  }
  if (empty) empty.classList.add('hidden');

  filtradas.forEach((r, index) => {
    const div = document.createElement('div');
    div.className = 'emitida-card';
    div.style.animationDelay = `${index * 40}ms`;
    div.setAttribute('role', 'button');
    div.setAttribute('tabindex', '0');

    div.innerHTML = `
      <div class="emitida-card-top">
        <div class="emitida-info">
          <span class="emitida-num">RC ${escapeHtml(r.num_factura || r.nombre)}</span>
          <span class="emitida-fecha">${escapeHtml(r.fecha || '—')}</span>
        </div>
        <span class="emitida-total" style="color:#dc3545">-${Number(r.total || 0).toFixed(2)} €</span>
      </div>
      <div class="emitida-card-sub">
        <span>👤 ${escapeHtml(r.cliente || '—')}</span>
        <span>🏢 ${escapeHtml(r.emisor  || '—')}</span>
        ${r.factura_original ? `<span style="font-size:11px;opacity:0.7">📄 ${escapeHtml(r.factura_original)}</span>` : ''}
      </div>
      <div class="emitida-hold-hint">Mantén pulsado para ver opciones</div>
    `;

    div.onpointerdown   = ev => _startRectLongPress(ev, r.nombre);
    div.onpointerup     = _cancelRectLongPress;
    div.onpointerleave  = _cancelRectLongPress;
    div.onpointercancel = _cancelRectLongPress;
    div.oncontextmenu   = ev => { ev.preventDefault(); _showRectMenu(r.nombre); };
    div.onclick = () => {
      if (window._rectLPFired) { window._rectLPFired = false; return; }
      showToast('Mantén pulsado para ver opciones');
    };
    div.onkeydown = ev => {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); _showRectMenu(r.nombre); }
    };
    list.appendChild(div);
  });
}

function limpiarBusquedaRectificativas() {
  const s = document.getElementById('rectificativas-search');
  if (s) s.value = '';
  filtrarRectificativas();
}
