// ============================================================
//  license.js — Sistema de licencia simple
//  Clave basada en hash del email + salt
// ============================================================

const LICENSE_SALT = 'FacturAPP-2026';
const LICENSE_DB_KEY = 'facturapp_license';

function _simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(6, '0');
}

function _generateLicenseKey(email) {
  const normalized = email.trim().toLowerCase();
  const hash1 = _simpleHash(normalized + LICENSE_SALT);
  const hash2 = _simpleHash(LICENSE_SALT + normalized + hash1);
  const part1 = hash1.substring(0, 4);
  const part2 = hash2.substring(0, 4);
  const part3 = _simpleHash(normalized + hash2).substring(0, 4);
  return `FA-${part1}-${part2}-${part3}`;
}

function isAppLicensed() {
  try {
    const raw = localStorage.getItem(LICENSE_DB_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || !data.active || !data.email || !data.key) return false;
    const expectedKey = _generateLicenseKey(data.email);
    return data.key === expectedKey;
  } catch { return false; }
}

function getLicenseInfo() {
  try {
    const raw = localStorage.getItem(LICENSE_DB_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function activateLicense(email, key) {
  if (!email || !key) return { ok: false, msg: 'Ingresa email y clave' };

  const expectedKey = _generateLicenseKey(email);
  if (key.toUpperCase().trim() !== expectedKey) {
    return { ok: false, msg: 'Clave de activación incorrecta' };
  }

  const data = {
    active: true,
    email: email.trim().toLowerCase(),
    key: key.toUpperCase().trim(),
    activatedAt: new Date().toISOString(),
    version: typeof CURRENT_VERSION !== 'undefined' ? CURRENT_VERSION : '1.0.0'
  };

  try {
    localStorage.setItem(LICENSE_DB_KEY, JSON.stringify(data));
    return { ok: true, msg: 'FacturAPP activada correctamente' };
  } catch (e) {
    return { ok: false, msg: 'Error al guardar la licencia' };
  }
}

function deactivateLicense() {
  localStorage.removeItem(LICENSE_DB_KEY);
}

function showLicenseScreen() {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;

  overlay.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()" style="max-width:400px">
      <div class="modal-icon">🔑</div>
      <h3>Activar FacturAPP</h3>
      <p style="margin-bottom:14px;font-size:13px;color:var(--grey-600)">
        Ingresa tu email y clave de activación para usar la app.
      </p>
      <div class="form-row" style="text-align:left;margin-bottom:10px">
        <label style="font-size:12px;font-weight:600;color:var(--grey-700)">Email</label>
        <input type="email" id="license-email" placeholder="tu@email.com" style="width:100%;padding:10px;border:1px solid var(--grey-300);border-radius:8px;font-size:14px;margin-top:4px" autocomplete="email">
      </div>
      <div class="form-row" style="text-align:left;margin-bottom:14px">
        <label style="font-size:12px;font-weight:600;color:var(--grey-700)">Clave de activación</label>
        <input type="text" id="license-key" placeholder="FA-XXXX-XXXX-XXXX" style="width:100%;padding:10px;border:1px solid var(--grey-300);border-radius:8px;font-size:14px;margin-top:4px;text-transform:uppercase;letter-spacing:1px" autocomplete="off">
      </div>
      <p id="license-error" style="color:#dc3545;font-size:12px;margin-bottom:10px;display:none"></p>
      <button class="btn-primary full-width" onclick="handleActivateLicense()" id="license-activate-btn">Activar</button>
      <button class="btn-secondary full-width" style="margin-top:8px" onclick="handleSkipLicense()">Usar sin activar (limitado)</button>
    </div>
  `;
  overlay.classList.remove('hidden');
  overlay.onclick = null;
}

function handleActivateLicense() {
  const email = (document.getElementById('license-email')?.value || '').trim();
  const key = (document.getElementById('license-key')?.value || '').trim();
  const errorEl = document.getElementById('license-error');

  if (!email || !key) {
    if (errorEl) { errorEl.textContent = 'Completa ambos campos'; errorEl.style.display = 'block'; }
    return;
  }

  const result = activateLicense(email, key);
  if (result.ok) {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('hidden');
    showToast('✅ ' + result.msg);
    if (typeof location !== 'undefined') location.reload();
  } else {
    if (errorEl) { errorEl.textContent = result.msg; errorEl.style.display = 'block'; }
  }
}

function handleSkipLicense() {
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.add('hidden');
  localStorage.setItem('facturapp_license_skipped', '1');
  showToast('Funcionando sin licencia. Algunas funciones pueden estar limitadas.');
}

function isLicenseSkipped() {
  return localStorage.getItem('facturapp_license_skipped') === '1';
}
