// ============================================================
//  fileActions.js — Abrir · Compartir · Borrar facturas
//  Depende de: fileService.js, app.js (showToast, showConfirmDialog)
// ============================================================

// ── Compartir PDF (Android Share Sheet) ─────────────────────
async function accionCompartir(nombre) {
  showToast('Preparando…');
  try {
    const plugins = window.Capacitor && window.Capacitor.Plugins;
    const Share   = plugins && plugins.Share;

    if (Share) {
      // Obtener URI nativa del archivo ya guardado
      const uri = await getURIFactura(nombre);
      if (uri) {
        await Share.share({
          title:       nombre,
          text:        `Factura: ${nombre}`,
          url:         uri,
          dialogTitle: 'Compartir factura',
        });
        return;
      }
    }

    // Fallback: leer el PDF y compartir como blob
    const base64 = await leerPDFBase64(nombre);
    if (base64) {
      _compartirComoBlob(base64, nombre);
    } else {
      showToast('No se encontró el archivo PDF');
    }
  } catch (e) {
    console.error('accionCompartir:', e);
    showToast('Error al compartir: ' + (e.message || 'desconocido'));
  }
}

// ── Abrir PDF en vista previa integrada ──────────────────────
async function accionAbrir(nombre) {
  showToast('Preparando vista previa…');
  try {
    const base64 = await leerPDFBase64(nombre);
    if (base64) {
      showPdfPreview(base64, nombre);
      return;
    }
    showToast('No se encontró el PDF para previsualizar');
  } catch (e) {
    console.error('accionAbrir:', e);
    showToast('Error al abrir: ' + (e.message || 'desconocido'));
  }
}

async function accionExportarFactura(nombre) {
  showToast('Exportando PDF…');
  try {
    const base64 = await leerPDFBase64(nombre);
    if (!base64) {
      showToast('No se encontró el PDF para exportar');
      return;
    }
    descargarBase64PDF(base64, nombre);
    showToast('PDF exportado');
  } catch (e) {
    console.error('accionExportarFactura:', e);
    showToast('Error al exportar: ' + (e.message || 'desconocido'));
  }
}

// ── Eliminar PDF ──────────────────────────────────────────────
async function accionEliminar(nombre) {
  showConfirmDialog(
    '🗑️', '¿Eliminar factura?',
    `Se eliminará "${nombre}" permanentemente.`,
    async () => {
      showToast('Eliminando…');
      try {
        await eliminarFacturaPDF(nombre);
        showToast('Factura eliminada');
        // Refrescar la pantalla de facturas emitidas
        if (typeof renderFacturas === 'function') {
          renderFacturas();
        }
      } catch (e) {
        console.error('accionEliminar:', e);
        showToast('Error al eliminar: ' + (e.message || 'desconocido'));
      }
    },
    null  // No → no hacer nada
  );
}

// accionTelegramDesdeListado — definido en app.js

// ── Helpers internos ──────────────────────────────────────────
function _compartirComoBlob(base64, nombre) {
  try {
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const blob  = new Blob([bytes], { type: 'application/pdf' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
  } catch (e) {
    showToast('No se pudo preparar el PDF para compartir');
  }
}

function showPdfPreview(base64, nombre) {
  const overlay = document.getElementById('modal-overlay');
  window._previewBase64 = base64;
  window._previewFileName = nombre;
  // Estado de zoom/pan
  window._pvZoom = 1;
  window._pvPanX = 0;
  window._pvPanY = 0;

  overlay.innerHTML = `
    <div class="document-preview" onclick="event.stopPropagation()">
      <div class="document-preview-bar">
        <div style="flex:1;min-width:0">
          <strong>Vista previa</strong>
          <span style="display:block;font-size:11px;opacity:.75;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(nombre)}</span>
        </div>
        <div class="document-preview-controls">
          <button class="btn-icon-clear" onclick="pvZoomBtn(-0.25)" aria-label="Alejar" title="Alejar">−</button>
          <span id="preview-zoom-label" style="min-width:38px;text-align:center;font-size:12px;font-weight:700;color:#fff">100%</span>
          <button class="btn-icon-clear" onclick="pvZoomBtn(0.25)" aria-label="Acercar" title="Acercar">＋</button>
          <button class="btn-icon-clear" onclick="pvResetZoom()" aria-label="Resetear zoom" title="Resetear">⊙</button>
          <button class="btn-icon-clear" onclick="closeModal()" aria-label="Cerrar">×</button>
        </div>
      </div>
      <div class="document-preview-scroll" id="pv-scroll">
        <div id="document-preview-pages" class="document-preview-pages">
          <div class="loading-state"><span>⏳</span><p>Renderizando PDF…</p></div>
        </div>
      </div>
    </div>
  `;
  overlay.classList.remove('hidden');
  overlay.onclick = closeModal;
  renderPdfPreviewPages(base64, nombre);

  // Iniciar gestos después de que el DOM esté listo
  setTimeout(() => _initPvGestures(), 80);
}

function _pvApplyTransform() {
  const pages = document.getElementById('document-preview-pages');
  const label = document.getElementById('preview-zoom-label');
  if (!pages) return;
  pages.style.transform = `translate(${window._pvPanX}px, ${window._pvPanY}px) scale(${window._pvZoom})`;
  pages.style.transformOrigin = 'top center';
  if (label) label.textContent = `${Math.round(window._pvZoom * 100)}%`;
}

function pvZoomBtn(delta) {
  window._pvZoom = Math.min(5, Math.max(0.5, (window._pvZoom || 1) + delta));
  _pvApplyTransform();
}

function pvResetZoom() {
  window._pvZoom = 1;
  window._pvPanX = 0;
  window._pvPanY = 0;
  _pvApplyTransform();
}

// mantener compatibilidad con llamadas viejas
function previewZoom(delta) { pvZoomBtn(delta); }

function _initPvGestures() {
  const scroll = document.getElementById('pv-scroll');
  const pages  = document.getElementById('document-preview-pages');
  if (!scroll || !pages) return;

  // Remove previous listeners to prevent accumulation
  if (window._pvMousemoveHandler) {
    window.removeEventListener('mousemove', window._pvMousemoveHandler);
    window.removeEventListener('mouseup', window._pvMouseupHandler);
  }
  if (window._pvWheelHandler) {
    scroll.removeEventListener('wheel', window._pvWheelHandler);
  }

  pages.style.transition = 'none';
  pages.style.cursor = 'grab';

  // ── Variables de estado ───────────────────────────────────────
  let isPinching = false;
  let startDist  = 0;
  let startZoom  = 1;
  let startMidX  = 0;
  let startMidY  = 0;

  let isDragging  = false;
  let dragStartX  = 0;
  let dragStartY  = 0;
  let dragStartPX = 0;
  let dragStartPY = 0;

  function dist(t) {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function midpoint(t) {
    return {
      x: (t[0].clientX + t[1].clientX) / 2,
      y: (t[0].clientY + t[1].clientY) / 2,
    };
  }

  // ── Touch gestures (pinch + drag) ─────────────────────────────
  scroll.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      isPinching = true;
      isDragging = false;
      startDist  = dist(e.touches);
      startZoom  = window._pvZoom || 1;
      const mid  = midpoint(e.touches);
      startMidX  = mid.x;
      startMidY  = mid.y;
    } else if (e.touches.length === 1 && (window._pvZoom || 1) > 1) {
      isDragging  = true;
      dragStartX  = e.touches[0].clientX;
      dragStartY  = e.touches[0].clientY;
      dragStartPX = window._pvPanX || 0;
      dragStartPY = window._pvPanY || 0;
      pages.style.cursor = 'grabbing';
    }
  }, { passive: false });

  scroll.addEventListener('touchmove', (e) => {
    if (isPinching && e.touches.length === 2) {
      e.preventDefault();
      const d       = dist(e.touches);
      const scale   = d / startDist;
      window._pvZoom = Math.min(5, Math.max(0.5, startZoom * scale));
      _pvApplyTransform();
    } else if (isDragging && e.touches.length === 1) {
      e.preventDefault();
      const dx = e.touches[0].clientX - dragStartX;
      const dy = e.touches[0].clientY - dragStartY;
      window._pvPanX = dragStartPX + dx;
      window._pvPanY = dragStartPY + dy;
      _pvApplyTransform();
    }
  }, { passive: false });

  scroll.addEventListener('touchend', (e) => {
    if (e.touches.length < 2) isPinching = false;
    if (e.touches.length === 0) {
      isDragging = false;
      pages.style.cursor = 'grab';
      // Doble-tap para reset
      const now = Date.now();
      if (now - (window._pvLastTap || 0) < 280) {
        pvResetZoom();
      }
      window._pvLastTap = now;
    }
  }, { passive: true });

  // ── Mouse wheel (desktop) ─────────────────────────────────────
  window._pvWheelHandler = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.12 : 0.12;
    window._pvZoom = Math.min(5, Math.max(0.5, (window._pvZoom || 1) + delta));
    _pvApplyTransform();
  };
  scroll.addEventListener('wheel', window._pvWheelHandler, { passive: false });

  // ── Mouse drag (desktop) ──────────────────────────────────────
  scroll.addEventListener('mousedown', (e) => {
    if ((window._pvZoom || 1) <= 1) return;
    isDragging  = true;
    dragStartX  = e.clientX;
    dragStartY  = e.clientY;
    dragStartPX = window._pvPanX || 0;
    dragStartPY = window._pvPanY || 0;
    pages.style.cursor = 'grabbing';
    e.preventDefault();
  });
  window._pvMousemoveHandler = (e) => {
    if (!isDragging) return;
    window._pvPanX = dragStartPX + (e.clientX - dragStartX);
    window._pvPanY = dragStartPY + (e.clientY - dragStartY);
    _pvApplyTransform();
  };
  window._pvMouseupHandler = () => {
    isDragging = false;
    if (pages) pages.style.cursor = 'grab';
  };
  window.addEventListener('mousemove', window._pvMousemoveHandler);
  window.addEventListener('mouseup', window._pvMouseupHandler);
}

async function renderPdfPreviewPages(base64, nombre) {
  const container = document.getElementById('document-preview-pages');
  if (!container) return;
  if (!window.pdfjsLib) {
    container.innerHTML = `
      <div class="preview-error">
        <strong>No se pudo cargar el visor interno.</strong>
        <button class="btn-primary" onclick="descargarBase64PDF(window._previewBase64, window._previewFileName)">Descargar PDF</button>
      </div>
    `;
    window._previewBase64 = base64;
    return;
  }

  try {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf.worker.min.js';
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const pdf = await window.pdfjsLib.getDocument({ data: bytes }).promise;
    container.innerHTML = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.55 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.className = 'pdf-page-canvas';
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = '100%';
      canvas.style.maxWidth = `${Math.floor(viewport.width)}px`;
      await page.render({ canvasContext: ctx, viewport }).promise;
      container.appendChild(canvas);
    }
  } catch (e) {
    console.error('renderPdfPreviewPages:', e);
    window._previewBase64 = base64;
    container.innerHTML = `
      <div class="preview-error">
        <strong>No se pudo renderizar el PDF.</strong>
        <span>${escapeHtml(e.message || 'Error desconocido')}</span>
        <button class="btn-primary" onclick="descargarBase64PDF(window._previewBase64, window._previewFileName)">Descargar PDF</button>
      </div>
    `;
  }
}

// previewZoom is now pvZoomBtn (defined in showPdfPreview block above)

function descargarBase64PDF(base64, nombre) {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
}
