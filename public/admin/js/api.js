/* ── API Helper ─────────────────────────────────────── */
const API_BASE = window.location.origin;

function getToken() { return localStorage.getItem('dj_token'); }
function getUser()  { try { return JSON.parse(localStorage.getItem('dj_user')); } catch { return null; } }

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    // Essayer de rafraîchir le token
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getToken()}`;
      const res2 = await fetch(`${API_BASE}${path}`, { ...options, headers });
      return res2.json();
    } else {
      logout();
      return;
    }
  }
  return res.json();
}

async function tryRefresh() {
  const refresh = localStorage.getItem('dj_refresh');
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh })
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

/* ── Toast notifications ── */
function toast(msg, type = 'info') {
  const icons = { success: 'bi-check-circle', error: 'bi-x-circle', warning: 'bi-exclamation-triangle', info: 'bi-info-circle' };
  const colors = { success: '#34d399', error: '#f87171', warning: '#fbbf24', info: '#7ea3ff' };
  const t = document.createElement('div');
  t.className = `dj-toast ${type}`;
  t.innerHTML = `<i class="bi ${icons[type]}" style="color:${colors[type]}"></i>${msg}`;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/* ── Format helpers ── */
function fmtDate(d)  { if (!d) return '—'; return new Date(d).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' }); }
function fmtDateTime(d) { if (!d) return '—'; return new Date(d).toLocaleString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }); }
function fmtPrice(p, c = 'XAF') { if (!p || p == 0) return '<span style="color:#34d399">Gratuit</span>'; return `${Number(p).toLocaleString('fr-FR')} ${c}`; }
function fmtNum(n)   { return Number(n || 0).toLocaleString('fr-FR'); }
function avatar(name) { return (name || '?').split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase(); }

function badgeStatus(status) {
  const labels = { published:'Publié', draft:'Brouillon', cancelled:'Annulé', active:'Actif', used:'Utilisé', admin:'Admin', organizer:'Organisateur', user:'Utilisateur', valid:'Valide', invalid:'Invalide', completed:'Complété', pending:'En attente' };
  return `<span class="badge-status ${status}"><span class="dot"></span>${labels[status] || status}</span>`;
}

/* ── Modal helpers ── */
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
