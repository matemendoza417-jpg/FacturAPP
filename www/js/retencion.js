// ============================================================
//  retencion.js — Módulo de Retención Fiscal
//  Lógica COMPLETAMENTE separada:
//    - showInPdf   → si aparece en el PDF
//    - applyToTotal → si resta del total
//  Las dos dimensiones son INDEPENDIENTES entre sí.
// ============================================================

/**
 * Reglas por emisor (alias en minúsculas):
 *
 * EMISOR EJEMPLO 1 (alias: 'emisor1'):
 *   - enabled=false → showInPdf=false, applyToTotal=false  (NO aparece NADA)
 *   - enabled=true  → showInPdf=true,  applyToTotal=true   (aparece y resta)
 *
 * EMISOR EJEMPLO 2 (alias: 'emisor2'):
 *   - enabled=true  → showInPdf=true,  applyToTotal=true   (aparece y resta)
 *   - enabled=false → showInPdf=true,  applyToTotal=false  (aparece pero NO resta)
 *
 * CUALQUIER OTRO emisor (comportamiento genérico):
 *   - enabled=false → showInPdf=false, applyToTotal=false
 *   - enabled=true  → showInPdf=true,  applyToTotal=true
 */

const RETENCION_DEFAULT_PCT = 19;

/**
 * Calcula el modelo de retención completo.
 *
 * @param {Object} emisor  - Objeto emisor con propiedad `alias`
 * @param {boolean} enabled - Si el usuario activó el checkbox de retención
 * @param {number}  rate    - Porcentaje de retención (ej: 19)
 * @returns {{ rate, enabled, showInPdf, applyToTotal }}
 */
function calcularModeloRetencion(emisor, enabled, rate) {
  const alias = (emisor?.alias || '').toLowerCase().trim();
  const pct   = Number(rate) || RETENCION_DEFAULT_PCT;

  // ── Emisor Ejemplo 1 ─────────────────────────────────────
  if (alias === 'emisor1') {
    if (!enabled) {
      return { rate: pct, enabled: false, showInPdf: false, applyToTotal: false };
    } else {
      return { rate: pct, enabled: true,  showInPdf: true,  applyToTotal: true  };
    }
  }

  // ── Emisor Ejemplo 2 ─────────────────────────────────────
  if (alias === 'emisor2') {
    if (!enabled) {
      return { rate: pct, enabled: false, showInPdf: true,  applyToTotal: false };
    } else {
      return { rate: pct, enabled: true,  showInPdf: true,  applyToTotal: true  };
    }
  }

  // ── Comportamiento genérico (cualquier otro emisor) ────────
  if (!enabled) {
    return { rate: pct, enabled: false, showInPdf: false, applyToTotal: false };
  } else {
    return { rate: pct, enabled: true,  showInPdf: true,  applyToTotal: true  };
  }
}

/**
 * Calcula el importe de retención a APLICAR al total.
 * Si applyToTotal=false → siempre devuelve 0.
 *
 * @param {Object} modelo  - Resultado de calcularModeloRetencion()
 * @param {number} base    - Base imponible (subtotal sin IVA)
 * @returns {number}
 */
function calcularImporteRetencion(modelo, base) {
  if (!modelo.applyToTotal) return 0;
  return Math.round(base * modelo.rate / 100 * 100) / 100;
}

/**
 * Devuelve el texto de retención para el PDF.
 * Sólo debe llamarse si modelo.showInPdf === true.
 *
 * @param {Object} modelo
 * @returns {string}  ej: "-RET (19%)"
 */
function textoRetencionPDF(modelo) {
  return `-RET (${modelo.rate}%)`;
}
