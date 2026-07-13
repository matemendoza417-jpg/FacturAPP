// ============================================================
//  config.js — Configuración centralizada de FacturAPP
//  ⚠️ IMPORTANTE: Este archivo contiene configuración sensible.
//  En producción, el token debería estar en un backend proxy.
// ============================================================

var FacturAPPConfig = (function () {

  // ── Token de Telegram ─────────────────────────────────────
  // CONFIGURACIÓN: Reemplaza con tu token de @BotFather
  // O configúralo desde localStorage con la clave 'tg_bot_token'
  function _getTgToken() {
    return localStorage.getItem('tg_bot_token') || '';
  }

  function _getTgUsername() {
    return localStorage.getItem('tg_bot_username') || '';
  }

  // ── Configuración pública ──────────────────────────────────
  return {
    // Bot de Telegram — getters que leen de localStorage en vivo
    get TG_BOT_TOKEN() { return _getTgToken(); },
    get TG_BOT_USERNAME() { return _getTgUsername(); },

    // Backup automático
    AUTO_BACKUP_ENABLED: true,
    AUTO_BACKUP_INTERVAL_MS: 5 * 60 * 1000, // cada 5 minutos
    AUTO_BACKUP_MAX_SIZE_KB: 4096, // 4MB máximo para backup en localStorage

    // Versión del esquema de datos (para futuras migraciones)
    SCHEMA_VERSION: 3,

    // Límites
    MAX_PDF_CACHE_ITEMS: 50,
    MAX_PDF_CACHE_SIZE_MB: 4,

    // Numeración por defecto
    DEFAULT_IVA_PCT: 21,
    DEFAULT_RETENCION_PCT: 19,

    // Tiempo máximo de vinculación TG (segundos)
    TG_LINK_TIMEOUT_SECONDS: 60,
    TG_POLL_INTERVAL_MS: 2000,
  };
})();
