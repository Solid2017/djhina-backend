/* ── API Helper ─────────────────────────────────────── */
const API_BASE = window.location.origin;

function getToken()  { return localStorage.getItem('dj_token'); }
function getUser()   { try { return JSON.parse(localStorage.getItem('dj_user')); } catch { return null; } }
function getRefresh(){ return localStorage.getItem('dj_refresh'); }

/* ── Fetch central avec retry token + gestion d'erreurs réseau ── */
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (networkErr) {
    // Erreur réseau (serveur arrêté, reset, timeout…)
    console.warn('[apiFetch] Erreur réseau sur', path, ':', networkErr.message);
    showNetworkBanner(true);
    return null;   // null = appelant sait que ça a échoué via if (!data?.success)
  }

  showNetworkBanner(false); // serveur répond → cacher la bannière si elle était visible

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getToken()}`;
      try {
        const res2 = await fetch(`${API_BASE}${path}`, { ...options, headers });
        return res2.json().catch(() => null);
      } catch { return null; }
    } else {
      logout();
      return null;
    }
  }

  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function tryRefresh() {
  const refresh = getRefresh();
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('dj_token', data.data.token);
      return true;
    }
  } catch {}
  return false;
}

function logout() {
  localStorage.removeItem('dj_token');
  localStorage.removeItem('dj_refresh');
  localStorage.removeItem('dj_user');
  window.location.href = 'login.html';
}

/* ── Bannière hors-ligne ── */
let _banner = null;
function showNetworkBanner(show) {
  if (!_banner) {
    _banner = document.createElement('div');
    _banner.id = 'networkBanner';
    _banner.style.cssText = [
      'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:9999',
      'background:#dc2626', 'color:#fff', 'text-align:center',
      'padding:.45rem 1rem', 'font-size:.82rem', 'font-weight:600',
      'display:none', 'align-items:center', 'justify-content:center', 'gap:.5rem',
    ].join(';');
    _banner.innerHTML = '<i class="bi bi-wifi-off"></i> Serveur inaccessible — vérifiez que le backend tourne sur le port 3000';
    document.body.appendChild(_banner);
  }
  _banner.style.display = show ? 'flex' : 'none';
}

/* ── Toast notifications ── */
function toast(msg, type = 'info') {
  const icons  = { success:'bi-check-circle', error:'bi-x-circle', warning:'bi-exclamation-triangle', info:'bi-info-circle' };
  const colors = { success:'#16a34a', error:'#dc2626', warning:'#d97706', info:'#4D6FFF' };
  const t = document.createElement('div');
  t.className = `dj-toast ${type}`;
  t.innerHTML = `<i class="bi ${icons[type]}" style="color:${colors[type]}"></i><span>${msg}</span>`;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

/* ── Format helpers ── */
function fmtDate(d)     { if (!d) return '—'; const dt = new Date(d); return isNaN(dt) ? d : dt.toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }); }
function fmtDateTime(d) { if (!d) return '—'; const dt = new Date(d); return isNaN(dt) ? d : dt.toLocaleString('fr-FR',     { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }); }
function fmtPrice(p, c = 'XAF') { if (!p || p == 0) return '<span style="color:#16a34a;font-weight:600">Gratuit</span>'; return `${Number(p).toLocaleString('fr-FR')} ${c}`; }
function fmtNum(n)      { return Number(n || 0).toLocaleString('fr-FR'); }
function avatar(name)   { return (name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase(); }

function badgeStatus(status) {
  const labels = {
    published:'Publié', draft:'Brouillon', cancelled:'Annulé',
    active:'Actif', used:'Utilisé',
    admin:'Admin', organizer:'Organisateur', user:'Utilisateur',
    valid:'Valide', invalid:'Invalide',
    completed:'Complété', pending:'En attente', failed:'Échoué', refunded:'Remboursé',
  };
  return `<span class="badge-status ${status}"><span class="dot"></span>${labels[status] || status}</span>`;
}

/* ── Modal helpers ── */
function openModal(id)  { const el = document.getElementById(id); if (el) el.classList.add('open'); }
function closeModal(id) { const el = document.getElementById(id); if (el) el.classList.remove('open'); }

/* ── Fermer modale en cliquant sur l'overlay ── */
document.addEventListener('click', e => {
  if (e.target.classList.contains('dj-modal-overlay')) {
    e.target.classList.remove('open');
  }
});

/* ── Fermer modale avec Escape ── */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.dj-modal-overlay.open')
      .forEach(el => el.classList.remove('open'));
  }
});
