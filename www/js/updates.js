// ============================================================
//  updates.js — Sistema de actualizaciones
//  Compara la versión local con la remota y avisa si hay nueva
// ============================================================

const CURRENT_VERSION = '3.1.0';
const UPDATE_CHECK_URL = 'https://gist.githubusercontent.com/matemendoza417-jpg/e933299e7af893624c2fa8123ee28fb8/raw/version.json';
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 horas

let _updateData = null;

function getCurrentVersion() {
  return CURRENT_VERSION;
}

function _parseVersion(v) {
  if (!v) return [0, 0, 0];
  return String(v).split('.').map(n => parseInt(n, 0) || 0);
}

function _isVersionNewer(remote, local) {
  const r = _parseVersion(remote);
  const l = _parseVersion(local);
  for (let i = 0; i < 3; i++) {
    if (r[i] > l[i]) return true;
    if (r[i] < l[i]) return false;
  }
  return false;
}

async function checkForUpdates() {
  try {
    const resp = await fetch(UPDATE_CHECK_URL + '?_=' + Date.now(), {
      method: 'GET',
      cache: 'no-store'
    });
    if (!resp.ok) return null;

    const data = await resp.json();
    _updateData = data;

    if (data.version && _isVersionNewer(data.version, CURRENT_VERSION)) {
      localStorage.setItem('facturapp_pending_update', JSON.stringify({
        version: data.version,
        changelog: data.changelog || '',
        downloadUrl: data.downloadUrl || '',
        date: new Date().toISOString()
      }));
      return data;
    }
    return null;
  } catch (e) {
    console.warn('FacturAPP: Error checking updates:', e.message);
    return null;
  }
}

function getPendingUpdate() {
  try {
    const raw = localStorage.getItem('facturapp_pending_update');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearPendingUpdate() {
  localStorage.removeItem('facturapp_pending_update');
}

function showUpdateNotification(updateData) {
  if (!updateData) return;
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;

  overlay.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-icon">🔄</div>
      <h3>Nueva versión disponible</h3>
      <p style="margin-bottom:8px">
        <strong>FacturAPP v${updateData.version}</strong> está disponible.
        <br>Tu versión: <strong>v${CURRENT_VERSION}</strong>
      </p>
      ${updateData.changelog ? `<p style="font-size:12px;color:var(--grey-600);margin-bottom:14px;text-align:left;max-height:120px;overflow-y:auto">${escapeHtml(updateData.changelog)}</p>` : ''}
      <div class="row-btns" style="flex-direction:column;gap:8px">
        ${updateData.downloadUrl ? `<button class="btn-primary full-width" onclick="window.open('${updateData.downloadUrl}','_system');closeModal()">⬇️ Descargar actualización</button>` : ''}
        <button class="btn-secondary full-width" onclick="closeModal()">Ahora no</button>
      </div>
    </div>
  `;
  overlay.classList.remove('hidden');
  overlay.onclick = closeModal;
}

function initUpdateChecker() {
  const lastCheck = localStorage.getItem('facturapp_last_update_check');
  const now = Date.now();
  if (lastCheck && (now - parseInt(lastCheck)) < UPDATE_CHECK_INTERVAL) return;

  localStorage.setItem('facturapp_last_update_check', String(now));

  setTimeout(async () => {
    const update = await checkForUpdates();
    if (update) showUpdateNotification(update);
  }, 5000);
}
