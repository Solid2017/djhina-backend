/* ── Auth guard ── */
if (!getToken()) window.location.href = 'login.html';
const ME = getUser();
if (!ME) window.location.href = 'login.html';

/* ── Init user info ── */
document.getElementById('userAvatar').textContent = avatar(ME.name);
document.getElementById('userName').textContent   = ME.name;
document.getElementById('userRole').textContent   = ME.role === 'admin' ? 'Administrateur' : 'Organisateur';
document.getElementById('topbarUser').textContent  = ME.name;

/* ── Navigation ── */
function navigate(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('sec-' + section).classList.add('active');
  document.querySelector(`[data-section="${section}"]`).classList.add('active');
  document.getElementById('topbarTitle').textContent = { dashboard:'Tableau de bord', users:'Utilisateurs', events:'Événements', tickets:'Tickets', payments:'Paiements', scanlogs:'Logs de scan', categories:'Catégories' }[section] || section;
  loadSection(section);
}

document.querySelectorAll('.nav-item[data-section]').forEach(el => {
  el.addEventListener('click', () => navigate(el.dataset.section));
});

/* ── Section loader ── */
function loadSection(section) {
  const loaders = { dashboard: loadDashboard, users: loadUsers, events: loadEvents, tickets: loadTickets, payments: loadPayments, scanlogs: loadScanLogs, categories: loadCategories };
  if (loaders[section]) loaders[section]();
}

/* ══════════════════════ DASHBOARD ══════════════════════ */
async function loadDashboard() {
  const data = await apiFetch('/api/admin/stats');
  if (!data?.success) return;
  const s = data.data;

  document.getElementById('statUsers').textContent    = fmtNum(s.users);
  document.getElementById('statOrgs').textContent     = fmtNum(s.organizers);
  document.getElementById('statEvents').textContent   = fmtNum(s.events);
  document.getElementById('statTickets').textContent  = fmtNum(s.tickets);
  document.getElementById('statRevenue').textContent  = fmtNum(s.revenue) + ' XAF';
  document.getElementById('statScans').textContent    = fmtNum(s.validScans);

  // Recent events
  const tbody = document.getElementById('recentEventsTbody');
  tbody.innerHTML = s.recentEvents.map(e => `
    <tr>
      <td>${e.title}</td>
      <td>${fmtDate(e.date)}</td>
      <td>${e.organizer_name}</td>
      <td>${badgeStatus(e.status)}</td>
      <td>${fmtNum(e.registered)}</td>
    </tr>`).join('') || `<tr><td colspan="5" class="text-center text-muted">Aucun événement</td></tr>`;

  // Recent payments
  const tbody2 = document.getElementById('recentPaysTbody');
  tbody2.innerHTML = s.recentPayments.map(p => `
    <tr>
      <td>${p.user_name}</td>
      <td>${p.event_title}</td>
      <td><strong>${fmtNum(p.total)} ${p.currency}</strong></td>
      <td>${fmtDateTime(p.created_at)}</td>
    </tr>`).join('') || `<tr><td colspan="4" class="text-center text-muted">Aucun paiement</td></tr>`;
}

/* ══════════════════════ USERS ══════════════════════ */
let usersPage = 1, usersRole = '', usersSearch = '';

async function loadUsers() {
  const params = new URLSearchParams({ page: usersPage, limit: 15, ...(usersRole && { role: usersRole }), ...(usersSearch && { search: usersSearch }) });
  const data = await apiFetch(`/api/admin/users?${params}`);
  if (!data?.success) return;

  const tbody = document.getElementById('usersTbody');
  tbody.innerHTML = data.data.map(u => `
    <tr>
      <td><div style="display:flex;align-items:center;gap:.6rem"><div class="sidebar-user" style="padding:0"><div class="avatar" style="width:30px;height:30px;font-size:.7rem">${avatar(u.name)}</div></div><div><div style="font-weight:600;font-size:.83rem">${u.name}</div><div style="color:var(--dj-muted);font-size:.72rem">${u.email}</div></div></div></td>
      <td>${badgeStatus(u.role)}</td>
      <td>${u.phone || '—'}</td>
      <td>${u.country || '—'}</td>
      <td>${u.is_active ? '<span style="color:#34d399"><i class="bi bi-check-circle"></i> Actif</span>' : '<span style="color:#f87171"><i class="bi bi-x-circle"></i> Inactif</span>'}</td>
      <td>${fmtDateTime(u.last_login)}</td>
      <td>
        <button class="btn-dj ghost sm" onclick="openEditUser('${u.id}','${u.name}','${u.email}','${u.role}','${u.phone||''}','${u.is_active}')"><i class="bi bi-pencil"></i></button>
        <button class="btn-dj danger sm" onclick="deleteUser('${u.id}','${u.name}')"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`).join('') || `<tr><td colspan="7"><div class="empty-state"><i class="bi bi-people"></i>Aucun utilisateur</div></td></tr>`;

  renderPagination('usersPagination', data.meta, (p) => { usersPage = p; loadUsers(); });
}

document.getElementById('usersSearch').addEventListener('input', function() { usersSearch = this.value; usersPage = 1; loadUsers(); });
document.getElementById('usersRoleFilter').addEventListener('change', function() { usersRole = this.value; usersPage = 1; loadUsers(); });

function openEditUser(id, name, email, role, phone, isActive) {
  document.getElementById('editUserId').value    = id;
  document.getElementById('editUserName').value  = name;
  document.getElementById('editUserEmail').value = email;
  document.getElementById('editUserRole').value  = role;
  document.getElementById('editUserPhone').value = phone;
  document.getElementById('editUserActive').value = isActive;
  openModal('modalEditUser');
}

document.getElementById('formEditUser').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editUserId').value;
  const body = {
    name:      document.getElementById('editUserName').value,
    email:     document.getElementById('editUserEmail').value,
    role:      document.getElementById('editUserRole').value,
    phone:     document.getElementById('editUserPhone').value,
    is_active: parseInt(document.getElementById('editUserActive').value),
  };
  const data = await apiFetch(`/api/admin/users/${id}`, { method:'PUT', body: JSON.stringify(body) });
  if (data?.success) { toast('Utilisateur mis à jour', 'success'); closeModal('modalEditUser'); loadUsers(); }
  else toast(data?.message || 'Erreur', 'error');
});

async function deleteUser(id, name) {
  if (!confirm(`Désactiver le compte de "${name}" ?`)) return;
  const data = await apiFetch(`/api/admin/users/${id}`, { method:'DELETE' });
  if (data?.success) { toast('Compte désactivé', 'success'); loadUsers(); }
  else toast(data?.message || 'Erreur', 'error');
}

document.getElementById('formCreateUser').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    name:     document.getElementById('newUserName').value,
    email:    document.getElementById('newUserEmail').value,
    phone:    document.getElementById('newUserPhone').value,
    password: document.getElementById('newUserPassword').value,
    role:     document.getElementById('newUserRole').value,
  };
  const data = await apiFetch('/api/admin/users', { method:'POST', body: JSON.stringify(body) });
  if (data?.success) { toast('Utilisateur créé', 'success'); closeModal('modalCreateUser'); e.target.reset(); loadUsers(); }
  else toast(data?.message || 'Erreur', 'error');
});

/* ══════════════════════ EVENTS ══════════════════════ */
let eventsPage = 1, eventsStatus = '';

async function loadEvents() {
  const params = new URLSearchParams({ page: eventsPage, limit: 15, ...(eventsStatus && { status: eventsStatus }) });
  const data = await apiFetch(`/api/admin/events?${params}`);
  if (!data?.success) return;

  const tbody = document.getElementById('eventsTbody');
  tbody.innerHTML = data.data.map(e => `
    <tr>
      <td>
        <div style="font-weight:600;font-size:.83rem">${e.title}</div>
        <div style="color:var(--dj-muted);font-size:.72rem">${e.category || 'Non catégorisé'}</div>
      </td>
      <td>${fmtDate(e.date)}</td>
      <td>${e.organizer_name}</td>
      <td>${badgeStatus(e.status)}</td>
      <td>${fmtNum(e.registered)} / ${fmtNum(e.capacity)}</td>
      <td>
        <button class="star-btn" title="Mettre en avant" onclick="featureEvent('${e.id}')">
          ${e.is_featured ? '⭐' : '☆'}
        </button>
      </td>
      <td>
        <select class="dj-select" style="font-size:.72rem;padding:.25rem .5rem" onchange="setEventStatus('${e.id}',this.value)">
          <option value="published" ${e.status==='published'?'selected':''}>Publié</option>
          <option value="draft"     ${e.status==='draft'?'selected':''}>Brouillon</option>
          <option value="cancelled" ${e.status==='cancelled'?'selected':''}>Annulé</option>
        </select>
      </td>
    </tr>`).join('') || `<tr><td colspan="7"><div class="empty-state"><i class="bi bi-calendar-x"></i>Aucun événement</div></td></tr>`;

  renderPagination('eventsPagination', data.meta, (p) => { eventsPage = p; loadEvents(); });
}

document.getElementById('eventsStatusFilter').addEventListener('change', function() { eventsStatus = this.value; eventsPage = 1; loadEvents(); });

async function setEventStatus(id, status) {
  const data = await apiFetch(`/api/admin/events/${id}/status`, { method:'PUT', body: JSON.stringify({ status }) });
  if (data?.success) toast(`Statut mis à jour : ${status}`, 'success');
  else { toast(data?.message || 'Erreur', 'error'); loadEvents(); }
}

async function featureEvent(id) {
  const data = await apiFetch(`/api/admin/events/${id}/feature`, { method:'PUT' });
  if (data?.success) { toast(data.data.is_featured ? 'Mis en avant ⭐' : 'Retiré de la une', 'success'); loadEvents(); }
  else toast(data?.message || 'Erreur', 'error');
}

/* ══════════════════════ TICKETS ══════════════════════ */
let ticketsPage = 1;

async function loadTickets() {
  // Use organizer endpoint for listing tickets by event or the generic user tickets endpoint
  const params = new URLSearchParams({ page: ticketsPage, limit: 20 });
  const data = await apiFetch(`/api/tickets/my?${params}`);
  if (!data?.success) return;

  const tbody = document.getElementById('ticketsTbody');
  tbody.innerHTML = data.data.map(t => `
    <tr>
      <td><code style="font-size:.75rem;color:var(--dj-muted)">${t.ticket_number}</code></td>
      <td>${t.event_title || '—'}</td>
      <td>${t.holder_name || t.user_name || '—'}</td>
      <td>${t.ticket_type_name || t.type_name || '—'}</td>
      <td>${fmtPrice(t.price_paid, t.currency)}</td>
      <td>${badgeStatus(t.status)}</td>
      <td>${fmtDate(t.purchase_date || t.created_at)}</td>
    </tr>`).join('') || `<tr><td colspan="7"><div class="empty-state"><i class="bi bi-ticket"></i>Aucun ticket</div></td></tr>`;
}

/* ══════════════════════ PAYMENTS ══════════════════════ */
let paymentsPage = 1;

async function loadPayments() {
  const params = new URLSearchParams({ page: paymentsPage, limit: 20 });
  const data = await apiFetch(`/api/admin/payments?${params}`);
  if (!data?.success) return;

  const tbody = document.getElementById('paymentsTbody');
  tbody.innerHTML = data.data.map(p => `
    <tr>
      <td>${p.user_name}</td>
      <td>${p.event_title}</td>
      <td><strong>${fmtNum(p.total)} ${p.currency || 'XAF'}</strong></td>
      <td>${p.provider || '—'}</td>
      <td>${p.phone || '—'}</td>
      <td>${badgeStatus(p.status)}</td>
      <td>${fmtDateTime(p.created_at)}</td>
    </tr>`).join('') || `<tr><td colspan="7"><div class="empty-state"><i class="bi bi-cash-stack"></i>Aucun paiement</div></td></tr>`;

  renderPagination('paymentsPagination', data.meta, (p) => { paymentsPage = p; loadPayments(); });
}

/* ══════════════════════ SCAN LOGS ══════════════════════ */
async function loadScanLogs() {
  const data = await apiFetch('/api/admin/scan-logs?limit=50');
  if (!data?.success) return;

  const tbody = document.getElementById('scansTbody');
  tbody.innerHTML = data.data.map(s => `
    <tr>
      <td><code style="font-size:.75rem;color:var(--dj-muted)">${s.ticket_number || '—'}</code></td>
      <td>${s.event_title || '—'}</td>
      <td>${s.scanned_by_name || 'Système'}</td>
      <td>${badgeStatus(s.result)}</td>
      <td>${s.note || '—'}</td>
      <td>${fmtDateTime(s.created_at)}</td>
    </tr>`).join('') || `<tr><td colspan="6"><div class="empty-state"><i class="bi bi-qr-code-scan"></i>Aucun scan</div></td></tr>`;
}

/* ══════════════════════ CATEGORIES ══════════════════════ */
async function loadCategories() {
  const data = await apiFetch('/api/admin/categories');
  if (!data?.success) return;

  const grid = document.getElementById('categoriesGrid');
  grid.innerHTML = data.data.map(c => `
    <div class="dj-card" style="padding:1rem;display:flex;align-items:center;gap:.85rem">
      <div style="width:40px;height:40px;border-radius:10px;background:${c.color}22;display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0">
        <i class="bi bi-${c.icon || 'tag'}" style="color:${c.color}"></i>
      </div>
      <div style="flex:1">
        <div style="font-weight:700;font-size:.88rem">${c.label}</div>
        <div style="font-size:.72rem;color:var(--dj-muted)">${c.slug}</div>
      </div>
      <div style="display:flex;gap:.4rem">
        <button class="btn-dj ghost sm" onclick="openEditCat('${c.id}','${c.label}','${c.slug}','${c.icon||''}','${c.color}')"><i class="bi bi-pencil"></i></button>
        <button class="btn-dj danger sm" onclick="deleteCat('${c.id}','${c.label}')"><i class="bi bi-trash"></i></button>
      </div>
    </div>`).join('') || '<div class="empty-state"><i class="bi bi-tags"></i>Aucune catégorie</div>';
}

function openEditCat(id, label, slug, icon, color) {
  document.getElementById('editCatId').value    = id;
  document.getElementById('editCatLabel').value = label;
  document.getElementById('editCatSlug').value  = slug;
  document.getElementById('editCatIcon').value  = icon;
  document.getElementById('editCatColor').value = color;
  openModal('modalEditCat');
}

document.getElementById('formEditCat').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editCatId').value;
  const body = {
    label: document.getElementById('editCatLabel').value,
    slug:  document.getElementById('editCatSlug').value,
    icon:  document.getElementById('editCatIcon').value,
    color: document.getElementById('editCatColor').value,
  };
  const data = await apiFetch(`/api/admin/categories/${id}`, { method:'PUT', body: JSON.stringify(body) });
  if (data?.success) { toast('Catégorie mise à jour', 'success'); closeModal('modalEditCat'); loadCategories(); }
  else toast(data?.message || 'Erreur', 'error');
});

document.getElementById('formCreateCat').addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = {
    label: document.getElementById('newCatLabel').value,
    slug:  document.getElementById('newCatSlug').value,
    icon:  document.getElementById('newCatIcon').value,
    color: document.getElementById('newCatColor').value || '#0000FF',
  };
  const data = await apiFetch('/api/admin/categories', { method:'POST', body: JSON.stringify(body) });
  if (data?.success) { toast('Catégorie créée', 'success'); closeModal('modalCreateCat'); e.target.reset(); loadCategories(); }
  else toast(data?.message || 'Erreur', 'error');
});

async function deleteCat(id, label) {
  if (!confirm(`Supprimer la catégorie "${label}" ?`)) return;
  const data = await apiFetch(`/api/admin/categories/${id}`, { method:'DELETE' });
  if (data?.success) { toast('Catégorie supprimée', 'success'); loadCategories(); }
  else toast(data?.message || 'Erreur', 'error');
}

/* ══════════════════════ PAGINATION ══════════════════════ */
function renderPagination(containerId, meta, onPage) {
  const el = document.getElementById(containerId);
  if (!meta || meta.pages <= 1) { el.innerHTML = ''; return; }
  let html = `<span class="page-info">Page ${meta.page} / ${meta.pages} — ${fmtNum(meta.total)} résultats</span>`;
  if (meta.page > 1) html += `<button class="page-btn" onclick="(${onPage.toString()})(${meta.page - 1})"><i class="bi bi-chevron-left"></i></button>`;
  const start = Math.max(1, meta.page - 2), end = Math.min(meta.pages, start + 4);
  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn${i === meta.page ? ' active' : ''}" onclick="(${onPage.toString()})(${i})">${i}</button>`;
  }
  if (meta.page < meta.pages) html += `<button class="page-btn" onclick="(${onPage.toString()})(${meta.page + 1})"><i class="bi bi-chevron-right"></i></button>`;
  el.innerHTML = html;
}

/* ── Logout ── */
document.getElementById('btnLogout').addEventListener('click', async () => {
  await apiFetch('/api/auth/logout', { method:'POST' });
  logout();
});

/* ── Start ── */
navigate('dashboard');

/* ── Auto-hide admin-only items for organizer ── */
if (ME.role !== 'admin') {
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
}
