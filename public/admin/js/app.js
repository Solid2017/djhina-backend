/* ── Date helper ── */
function toDatetimeLocal(d) {
  if (!d) return '';
  const dt = new Date(d);
  if (isNaN(dt)) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}

/* ── Global error handler (debug) ── */
window.addEventListener('unhandledrejection', e => {
  // apiFetch retourne null sur erreur réseau — ignorer les rejets liés
  if (e.reason?.message?.includes('Failed to fetch')) {
    e.preventDefault(); // empêche l'affichage dans la console
    return;
  }
  console.error('[Djhina Admin] Unhandled rejection:', e.reason);
});

/* ── Submit button helper ── */
function setBtnLoading(btn, loading, label = '') {
  if (!btn) return;
  btn.disabled = loading;
  if (loading) { btn._orig = btn.innerHTML; btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Chargement…'; }
  else btn.innerHTML = label || btn._orig || btn.innerHTML;
}

/* ── Load categories into a <select> ── */
async function fillCategorySelect(selId, selectedId = '') {
  const sel = document.getElementById(selId);
  if (!sel) return;
  sel.innerHTML = '<option value="">Aucune catégorie</option>';
  try {
    const data = await apiFetch('/api/admin/categories');
    if (data?.success) {
      data.data.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.label;
        if (c.id === selectedId) opt.selected = true;
        sel.appendChild(opt);
      });
    }
  } catch { /* non-bloquant */ }
}

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
  document.getElementById('topbarTitle').textContent = { dashboard:'Tableau de bord', organizers:'Organisateurs', users:'Utilisateurs', events:'Événements', tickets:'Tickets', payments:'Paiements', scanlogs:'Logs de scan', categories:'Catégories' }[section] || section;
  loadSection(section);
}

document.querySelectorAll('.nav-item[data-section]').forEach(el => {
  el.addEventListener('click', () => navigate(el.dataset.section));
});

/* ── Section loader ── */
function loadSection(section) {
  const loaders = {
    dashboard:  loadDashboard,
    users:      loadUsers,
    events:     loadEvents,
    tickets:    loadTickets,
    payments:   loadPayments,
    scanlogs:   loadScanLogs,
    categories: loadCategories,
    organizers: loadOrganizers,
  };
  if (loaders[section]) {
    Promise.resolve(loaders[section]()).catch(err => {
      console.error('[loadSection]', section, err);
      toast(`Impossible de charger ${section} — serveur inaccessible ?`, 'error');
    });
  }
}

/* ══════════════════════ DASHBOARD ══════════════════════ */
async function loadDashboard() {
  let data;
  try { data = await apiFetch('/api/admin/stats'); } catch { return; }
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
  let data;
  try { data = await apiFetch(`/api/admin/users?${params}`); } catch { return; }
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
  let data;
  try { data = await apiFetch(`/api/admin/events?${params}`); } catch { return; }
  if (!data?.success) return;

  const tbody = document.getElementById('eventsTbody');
  tbody.innerHTML = data.data.map(e => `
    <tr>
      <td>
        <div style="font-weight:600;font-size:.83rem">${e.title}</div>
        <div style="color:var(--dj-muted);font-size:.72rem">${e.category || 'Non catégorisé'}</div>
      </td>
      <td>${fmtDate(e.date)}</td>
      <td>
        <div style="font-size:.83rem">${e.organizer_name}</div>
        <div style="color:var(--dj-muted);font-size:.72rem">${e.organizer_email || ''}</div>
      </td>
      <td>${badgeStatus(e.status)}</td>
      <td>${fmtNum(e.registered)} / ${fmtNum(e.capacity)}</td>
      <td style="text-align:center">
        <button class="star-btn" title="${e.is_featured ? 'Retirer de la une' : 'Mettre en avant'}" onclick="featureEvent('${e.id}')">
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
      <td>
        <button class="btn-dj ghost sm" title="Modifier" onclick="openEditEvent('${e.id}')"><i class="bi bi-pencil"></i></button>
        <button class="btn-dj danger sm" title="Supprimer" onclick="deleteEvent('${e.id}','${(e.title||'').replace(/'/g,`\\'`)}')"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`).join('') || `<tr><td colspan="8"><div class="empty-state"><i class="bi bi-calendar-x"></i>Aucun événement</div></td></tr>`;

  renderPagination('eventsPagination', data.meta, (p) => { eventsPage = p; loadEvents(); });
}

document.getElementById('eventsStatusFilter').addEventListener('change', function() { eventsStatus = this.value; eventsPage = 1; loadEvents(); });

function openCreateEventModal() {
  // Ouvrir la modale EN PREMIER — les catégories se chargent en arrière-plan
  document.getElementById('formCreateEvent').reset();
  openModal('modalCreateEvent');
  fillCategorySelect('newEvCategory');
}

document.getElementById('formCreateEvent').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.submitter || e.target.querySelector('[type=submit]');
  setBtnLoading(btn, true);

  const fd = new FormData();
  fd.append('title',       document.getElementById('newEvTitle').value);
  fd.append('date',        document.getElementById('newEvDate').value);
  const dateEnd = document.getElementById('newEvDateEnd').value;
  if (dateEnd) fd.append('end_time', dateEnd);
  fd.append('location',    document.getElementById('newEvLocation').value);
  fd.append('description', document.getElementById('newEvDesc').value || '');
  const capacity = document.getElementById('newEvCapacity').value;
  if (capacity) fd.append('capacity', capacity);
  const catId = document.getElementById('newEvCategory').value;
  if (catId) fd.append('category_id', catId);
  fd.append('status', document.getElementById('newEvStatus').value);
  const coverFile = document.getElementById('newEvCover').files[0];
  if (coverFile) fd.append('cover', coverFile);

  try {
    const token = getToken();
    const res = await fetch(`${API_BASE}/api/events`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: fd,
    });
    const data = await res.json();
    if (data?.success) {
      toast('Événement créé avec succès ✓', 'success');
      closeModal('modalCreateEvent');
      e.target.reset();
      loadEvents();
    } else {
      toast(data?.message || 'Erreur lors de la création', 'error');
      setBtnLoading(btn, false);
    }
  } catch (err) {
    toast('Erreur réseau : ' + (err.message || err), 'error');
    setBtnLoading(btn, false);
  }
});

async function setEventStatus(id, status) {
  const data = await apiFetch(`/api/admin/events/${id}/status`, { method:'PUT', body: JSON.stringify({ status }) });
  if (data?.success) toast(`Statut mis à jour : ${status}`, 'success');
  else { toast(data?.message || 'Erreur', 'error'); loadEvents(); }
}

/* ══ EDIT EVENT ══ */
function openEditEvent(id) {
  // Ouvrir la modale immédiatement avec un état de chargement
  openModal('modalEditEvent');
  document.getElementById('editEvId').value       = id;
  document.getElementById('editEvTitle').value    = '…';
  document.getElementById('editEvSubtitle').value = '';
  document.getElementById('editEvDate').value     = '';
  document.getElementById('editEvDateEnd').value  = '';
  document.getElementById('editEvLocation').value = '';
  document.getElementById('editEvCity').value     = '';
  document.getElementById('editEvCapacity').value = '';
  document.getElementById('editEvDesc').value     = '';
  document.getElementById('editTTBody').innerHTML = '';

  // Charger les données en arrière-plan
  _loadEditEventData(id);
}

async function _loadEditEventData(id) {
  try {
    const [evData, catsData] = await Promise.all([
      apiFetch(`/api/admin/events/${id}`),
      apiFetch('/api/admin/categories'),
    ]);

    if (!evData?.success) { toast('Impossible de charger l\'événement', 'error'); return; }
    const e = evData.data;

    document.getElementById('editEvId').value       = e.id;
    document.getElementById('editEvTitle').value    = e.title || '';
    document.getElementById('editEvSubtitle').value = e.subtitle || '';
    document.getElementById('editEvDate').value     = toDatetimeLocal(e.date);
    document.getElementById('editEvDateEnd').value  = toDatetimeLocal(e.end_time || e.date_end);
    document.getElementById('editEvLocation').value = e.location || '';
    document.getElementById('editEvCity').value     = e.city || '';
    document.getElementById('editEvCapacity').value = e.capacity || '';
    document.getElementById('editEvDesc').value     = e.description || '';
    document.getElementById('editEvStatus').value   = e.status || 'draft';

    // Catégories
    const sel = document.getElementById('editEvCategory');
    sel.innerHTML = '<option value="">Aucune catégorie</option>';
    if (catsData?.success) {
      catsData.data.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.label;
        if (c.id === e.category_id) opt.selected = true;
        sel.appendChild(opt);
      });
    }

    // Types de billets
    const ttBody = document.getElementById('editTTBody');
    ttBody.innerHTML = '';
    (e.ticket_types || []).forEach(tt => addTicketTypeRow('editTTBody', tt));

    // Bouton supprimer
    document.getElementById('btnDeleteEventFromEdit').onclick =
      () => deleteEvent(e.id, e.title, true);

  } catch (err) {
    toast('Erreur chargement : ' + (err.message || err), 'error');
  }
}

document.getElementById('formEditEvent').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const btn = ev.submitter || ev.target.querySelector('[type=submit]');
  setBtnLoading(btn, true);

  const id = document.getElementById('editEvId').value;
  const fd = new FormData();
  fd.append('title',       document.getElementById('editEvTitle').value);
  fd.append('subtitle',    document.getElementById('editEvSubtitle').value);
  fd.append('date',        document.getElementById('editEvDate').value);
  const de = document.getElementById('editEvDateEnd').value;
  if (de) fd.append('end_time', de);
  fd.append('location',    document.getElementById('editEvLocation').value);
  fd.append('city',        document.getElementById('editEvCity').value);
  fd.append('description', document.getElementById('editEvDesc').value);
  const cap = document.getElementById('editEvCapacity').value;
  if (cap) fd.append('capacity', cap);
  const cat = document.getElementById('editEvCategory').value;
  if (cat) fd.append('category_id', cat);
  const coverFile = document.getElementById('editEvCover').files[0];
  if (coverFile) fd.append('cover', coverFile);

  try {
    const token = getToken();
    const [putRes] = await Promise.all([
      fetch(`${API_BASE}/api/events/${id}`, {
        method: 'PUT',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: fd,
      }),
    ]);
    const data = await putRes.json();
    if (data?.success) {
      // Mettre à jour le statut séparément
      const newStatus = document.getElementById('editEvStatus').value;
      await apiFetch(`/api/admin/events/${id}/status`, {
        method: 'PUT', body: JSON.stringify({ status: newStatus }),
      });
      toast('Événement mis à jour ✓', 'success');
      closeModal('modalEditEvent');
      loadEvents();
    } else {
      toast(data?.message || 'Erreur', 'error');
      setBtnLoading(btn, false);
    }
  } catch (err) {
    toast('Erreur réseau : ' + (err.message || err), 'error');
    setBtnLoading(btn, false);
  }
});

async function deleteEvent(id, title, fromModal = false) {
  if (!confirm(`Supprimer / annuler l'événement "${title}" ?\nLes tickets actifs seront maintenus.`)) return;
  const data = await apiFetch(`/api/events/${id}`, { method:'DELETE' });
  if (data?.success) {
    toast('Événement supprimé', 'success');
    if (fromModal) closeModal('modalEditEvent');
    loadEvents();
  } else toast(data?.message || 'Erreur', 'error');
}

/* ── Ticket-type row helper ── */
function addTicketTypeRow(tbodyId, tt = {}) {
  const tb = document.getElementById(tbodyId);
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td><input type="text" class="dj-input tt-name" value="${tt.name||''}" placeholder="VIP, Standard…" required style="width:100%"></td>
    <td><input type="number" class="dj-input tt-price" value="${tt.price||0}" min="0" style="width:80px"></td>
    <td><input type="number" class="dj-input tt-avail" value="${tt.available||''}" min="1" placeholder="∞" style="width:70px"></td>
    <td><button type="button" class="btn-dj danger sm" onclick="this.closest('tr').remove()"><i class="bi bi-x-lg"></i></button></td>`;
  tb.appendChild(tr);
}

async function featureEvent(id) {
  const data = await apiFetch(`/api/admin/events/${id}/feature`, { method:'PUT' });
  if (data?.success) { toast(data.data.is_featured ? 'Mis en avant ⭐' : 'Retiré de la une', 'success'); loadEvents(); }
  else toast(data?.message || 'Erreur', 'error');
}

/* ══════════════════════ TICKETS ══════════════════════ */
let ticketsPage = 1, ticketsStatus = '', ticketsSearch = '';

async function loadTickets() {
  const params = new URLSearchParams({
    page: ticketsPage, limit: 20,
    ...(ticketsStatus && { status: ticketsStatus }),
    ...(ticketsSearch && { search: ticketsSearch }),
  });
  let data;
  try { data = await apiFetch(`/api/admin/tickets?${params}`); } catch { return; }
  if (!data?.success) return;

  const tbody = document.getElementById('ticketsTbody');
  tbody.innerHTML = data.data.map(t => `
    <tr>
      <td><code style="font-size:.75rem;color:var(--dj-blue)">${t.ticket_number}</code></td>
      <td>
        <div style="font-size:.83rem;font-weight:600">${t.event_title || '—'}</div>
        <div style="font-size:.72rem;color:var(--dj-muted)">${fmtDate(t.event_date)}</div>
      </td>
      <td>
        <div style="font-size:.83rem">${t.holder_name || t.buyer_name || '—'}</div>
        <div style="font-size:.72rem;color:var(--dj-muted)">${t.holder_email || ''}</div>
      </td>
      <td>${t.ticket_type_name || '—'}</td>
      <td>${fmtPrice(t.price_paid, t.currency)}</td>
      <td>${badgeStatus(t.status)}</td>
      <td>${fmtDate(t.created_at)}</td>
      <td>
        <button class="btn-dj ghost sm" title="Voir détail" onclick="viewTicketModal('${t.ticket_number}')"><i class="bi bi-eye"></i></button>
        ${t.status === 'active' ? `<button class="btn-dj danger sm" title="Annuler" onclick="cancelTicket('${t.ticket_number}')"><i class="bi bi-x-circle"></i></button>` : ''}
      </td>
    </tr>`).join('') || `<tr><td colspan="8"><div class="empty-state"><i class="bi bi-ticket"></i>Aucun ticket</div></td></tr>`;

  renderPagination('ticketsPagination', data.meta, (p) => { ticketsPage = p; loadTickets(); });
}

document.getElementById('ticketsSearch').addEventListener('input', function() { ticketsSearch = this.value; ticketsPage = 1; loadTickets(); });
document.getElementById('ticketsStatusFilter').addEventListener('change', function() { ticketsStatus = this.value; ticketsPage = 1; loadTickets(); });

async function viewTicketModal(number) {
  openModal('modalViewTicket');
  document.getElementById('ticketDetailContent').innerHTML = '<div class="empty-state"><i class="bi bi-hourglass-split"></i>Chargement...</div>';
  document.getElementById('ticketModalFooter').innerHTML   = '<button type="button" class="btn-dj ghost" onclick="closeModal(\'modalViewTicket\')">Fermer</button>';

  const data = await apiFetch(`/api/admin/tickets/${number}`);
  if (!data?.success) {
    document.getElementById('ticketDetailContent').innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-circle"></i>${data?.message || 'Erreur'}</div>`;
    return;
  }
  const t = data.data;

  document.getElementById('ticketDetailContent').innerHTML = `
    <div style="border:2px dashed var(--dj-border);border-radius:12px;overflow:hidden;margin-bottom:1rem">
      <div style="background:linear-gradient(135deg,var(--dj-blue),var(--dj-blue-lt));padding:1rem;color:#fff;text-align:center">
        <div style="font-size:1.1rem;font-weight:800">${t.event_title}</div>
        <div style="font-size:.8rem;opacity:.85">${fmtDate(t.event_date)} · ${t.event_location || ''}</div>
      </div>
      <div style="padding:1rem;display:grid;grid-template-columns:1fr 1fr;gap:.6rem;font-size:.82rem">
        <div><span style="color:var(--dj-muted);font-size:.7rem">N° BILLET</span><br><strong style="color:var(--dj-blue)">${t.ticket_number}</strong></div>
        <div><span style="color:var(--dj-muted);font-size:.7rem">STATUT</span><br>${badgeStatus(t.status)}</div>
        <div><span style="color:var(--dj-muted);font-size:.7rem">TITULAIRE</span><br><strong>${t.holder_name || '—'}</strong></div>
        <div><span style="color:var(--dj-muted);font-size:.7rem">EMAIL</span><br>${t.holder_email || t.buyer_email || '—'}</div>
        <div><span style="color:var(--dj-muted);font-size:.7rem">TYPE DE BILLET</span><br>${t.ticket_type_name || '—'}</div>
        <div><span style="color:var(--dj-muted);font-size:.7rem">PRIX PAYÉ</span><br><strong>${fmtPrice(t.price_paid, t.currency)}</strong></div>
        <div><span style="color:var(--dj-muted);font-size:.7rem">ACHETEUR</span><br>${t.buyer_name || '—'}</div>
        <div><span style="color:var(--dj-muted);font-size:.7rem">DATE ACHAT</span><br>${fmtDateTime(t.created_at)}</div>
        ${t.used_at ? `<div><span style="color:var(--dj-muted);font-size:.7rem">UTILISÉ LE</span><br>${fmtDateTime(t.used_at)}</div>` : ''}
        ${t.payment_status ? `<div><span style="color:var(--dj-muted);font-size:.7rem">STATUT PAIEMENT</span><br>${badgeStatus(t.payment_status)}</div>` : ''}
        ${t.provider ? `<div><span style="color:var(--dj-muted);font-size:.7rem">OPÉRATEUR</span><br>${t.provider}</div>` : ''}
        ${t.transaction_id ? `<div style="grid-column:1/-1"><span style="color:var(--dj-muted);font-size:.7rem">ID TRANSACTION</span><br><code style="font-size:.75rem">${t.transaction_id}</code></div>` : ''}
      </div>
    </div>
    ${t.cancel_reason ? `<div style="background:rgba(220,38,38,.07);border-radius:8px;padding:.7rem .9rem;font-size:.8rem;color:#dc2626"><i class="bi bi-info-circle me-1"></i>Motif d'annulation : ${t.cancel_reason}</div>` : ''}`;

  const footer = document.getElementById('ticketModalFooter');
  footer.innerHTML = `<button type="button" class="btn-dj ghost" onclick="closeModal('modalViewTicket')">Fermer</button>`;
  if (t.status === 'active') {
    footer.innerHTML += `
      <button type="button" class="btn-dj warning" onclick="cancelTicket('${t.ticket_number}',true)">
        <i class="bi bi-x-circle"></i> Annuler ce billet
      </button>`;
  }
  if (t.status !== 'used') {
    footer.innerHTML += `
      <a href="/tickets/${t.ticket_number}/view" target="_blank" class="btn-dj primary">
        <i class="bi bi-eye"></i> Voir le billet
      </a>`;
  }
}

async function cancelTicket(number, fromModal = false) {
  const reason = prompt('Motif d\'annulation (optionnel) :') ?? null;
  if (reason === null && !confirm('Annuler sans motif ?')) return;
  const data = await apiFetch(`/api/admin/tickets/${number}/cancel`, {
    method: 'PUT',
    body: JSON.stringify({ reason }),
  });
  if (data?.success) {
    toast('Billet annulé ✓', 'success');
    if (fromModal) viewTicketModal(number);
    else loadTickets();
  } else toast(data?.message || 'Erreur', 'error');
}

/* ══════════════════════ PAYMENTS ══════════════════════ */
let paymentsPage = 1, paymentsStatus = '';

async function loadPayments() {
  const params = new URLSearchParams({
    page: paymentsPage, limit: 20,
    ...(paymentsStatus && { status: paymentsStatus }),
  });
  let data;
  try { data = await apiFetch(`/api/admin/payments?${params}`); } catch { return; }
  if (!data?.success) return;

  const tbody = document.getElementById('paymentsTbody');
  tbody.innerHTML = data.data.map(p => `
    <tr>
      <td>
        <div style="font-weight:600;font-size:.83rem">${p.user_name}</div>
        <div style="font-size:.72rem;color:var(--dj-muted)">${p.user_email || ''}</div>
      </td>
      <td>${p.event_title}</td>
      <td><strong>${fmtNum(p.total)} ${p.currency || 'XAF'}</strong></td>
      <td>${p.provider || '—'}</td>
      <td>${p.phone || '—'}</td>
      <td>${badgeStatus(p.status)}</td>
      <td>${fmtDateTime(p.created_at)}</td>
      <td>
        <button class="btn-dj ghost sm" title="Voir détail" onclick="viewPayment('${p.id}')"><i class="bi bi-eye"></i></button>
        ${p.status === 'pending'   ? `<button class="btn-dj success sm" title="Marquer complété" onclick="quickPaymentStatus('${p.id}','completed')"><i class="bi bi-check-lg"></i></button>` : ''}
        ${p.status === 'completed' ? `<button class="btn-dj warning sm" title="Rembourser" onclick="quickPaymentStatus('${p.id}','refunded')"><i class="bi bi-arrow-counterclockwise"></i></button>` : ''}
      </td>
    </tr>`).join('') || `<tr><td colspan="8"><div class="empty-state"><i class="bi bi-cash-stack"></i>Aucun paiement</div></td></tr>`;

  renderPagination('paymentsPagination', data.meta, (p) => { paymentsPage = p; loadPayments(); });
}

document.getElementById('paymentsStatusFilter').addEventListener('change', function() { paymentsStatus = this.value; paymentsPage = 1; loadPayments(); });

async function viewPayment(id) {
  openModal('modalViewPayment');
  document.getElementById('paymentDetailContent').innerHTML = '<div class="empty-state"><i class="bi bi-hourglass-split"></i>Chargement...</div>';
  document.getElementById('currentPaymentId').value = id;
  // Hide action buttons until loaded
  document.getElementById('btnRefundPayment').style.display   = 'none';
  document.getElementById('btnCompletePayment').style.display = 'none';

  const data = await apiFetch(`/api/admin/payments/${id}`);
  if (!data?.success) {
    document.getElementById('paymentDetailContent').innerHTML = `<div class="empty-state"><i class="bi bi-exclamation-circle"></i>${data?.message || 'Erreur'}</div>`;
    return;
  }
  const p = data.data;

  const ticketRows = (p.tickets || []).map(t => `
    <tr>
      <td><code style="font-size:.75rem;color:var(--dj-blue)">${t.ticket_number}</code></td>
      <td>${t.holder_name || '—'}</td>
      <td>${badgeStatus(t.status)}</td>
    </tr>`).join('') || '<tr><td colspan="3" style="color:var(--dj-muted);font-size:.78rem;padding:.5rem">Aucun billet associé</td></tr>';

  document.getElementById('paymentDetailContent').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.65rem;font-size:.82rem;margin-bottom:1rem">
      <div><span style="color:var(--dj-muted);font-size:.7rem">CLIENT</span><br><strong>${p.user_name}</strong><br><span style="font-size:.75rem;color:var(--dj-muted)">${p.user_email || ''}</span></div>
      <div><span style="color:var(--dj-muted);font-size:.7rem">ÉVÉNEMENT</span><br><strong>${p.event_title}</strong></div>
      <div><span style="color:var(--dj-muted);font-size:.7rem">MONTANT</span><br><strong style="font-size:1.1rem;color:var(--dj-blue)">${fmtNum(p.total)} ${p.currency || 'XAF'}</strong></div>
      <div><span style="color:var(--dj-muted);font-size:.7rem">STATUT</span><br>${badgeStatus(p.status)}</div>
      <div><span style="color:var(--dj-muted);font-size:.7rem">OPÉRATEUR</span><br>${p.provider || '—'}</div>
      <div><span style="color:var(--dj-muted);font-size:.7rem">TÉLÉPHONE</span><br>${p.phone || '—'}</div>
      <div><span style="color:var(--dj-muted);font-size:.7rem">DATE</span><br>${fmtDateTime(p.created_at)}</div>
      ${p.transaction_id ? `<div><span style="color:var(--dj-muted);font-size:.7rem">ID TRANSACTION</span><br><code style="font-size:.73rem">${p.transaction_id}</code></div>` : ''}
      ${p.refund_reason ? `<div style="grid-column:1/-1;background:rgba(217,119,6,.08);border-radius:6px;padding:.5rem .7rem"><span style="color:#d97706;font-size:.75rem"><i class="bi bi-info-circle me-1"></i>Motif : ${p.refund_reason}</span></div>` : ''}
    </div>
    <div style="border-top:1px solid var(--dj-border);padding-top:.75rem">
      <div style="font-size:.75rem;font-weight:700;color:var(--dj-muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:.5rem">Billets associés (${(p.tickets||[]).length})</div>
      <table class="dj-table" style="font-size:.78rem">
        <thead><tr><th>N° Billet</th><th>Titulaire</th><th>Statut</th></tr></thead>
        <tbody>${ticketRows}</tbody>
      </table>
    </div>`;

  // Show contextual action buttons
  if (p.status === 'completed') document.getElementById('btnRefundPayment').style.display   = 'inline-flex';
  if (p.status === 'pending')   document.getElementById('btnCompletePayment').style.display = 'inline-flex';
}

async function updatePaymentStatus(status) {
  const id     = document.getElementById('currentPaymentId').value;
  const reason = status === 'refunded' ? (prompt('Motif du remboursement (optionnel) :') || '') : '';
  const data   = await apiFetch(`/api/admin/payments/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, reason }),
  });
  if (data?.success) {
    toast(`Paiement : ${status} ✓`, 'success');
    closeModal('modalViewPayment');
    loadPayments();
  } else toast(data?.message || 'Erreur', 'error');
}

async function quickPaymentStatus(id, status) {
  const reason = status === 'refunded' ? (prompt('Motif du remboursement :') || '') : '';
  if (status === 'refunded' && !confirm(`Confirmer le remboursement du paiement #${id} ?`)) return;
  const data = await apiFetch(`/api/admin/payments/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, reason }),
  });
  if (data?.success) { toast(`Paiement mis à jour : ${status}`, 'success'); loadPayments(); }
  else toast(data?.message || 'Erreur', 'error');
}

/* ══════════════════════ ORGANISATEURS ══════════════════════ */
let orgsPage = 1, orgsSearch = '', orgsActive = '';

// Couleurs pour les avatars organisateurs
const ORG_COLORS = ['#0000FF','#7c3aed','#0891b2','#d97706','#16a34a','#dc2626','#db2777','#059669'];
function orgColor(name) { let h=0; for(let c of name) h=(h*31+c.charCodeAt(0))&0xffff; return ORG_COLORS[h % ORG_COLORS.length]; }

async function loadOrganizers() {
  const params = new URLSearchParams({
    page: orgsPage, limit: 12, role: 'organizer',
    ...(orgsSearch && { search: orgsSearch }),
    ...(orgsActive !== '' && { is_active: orgsActive }),
  });
  let data;
  try { data = await apiFetch(`/api/admin/users?${params}`); } catch { return; }
  if (!data?.success) return;

  const tbody = document.getElementById('orgsTbody');
  tbody.innerHTML = data.data.map(o => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:.65rem">
          <div style="width:36px;height:36px;border-radius:10px;background:${orgColor(o.name)};
            display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.85rem;flex-shrink:0">
            ${avatar(o.name)}
          </div>
          <div>
            <div style="font-weight:700;font-size:.84rem">${o.name}</div>
            <div style="font-size:.72rem;color:var(--dj-muted)">${o.email}</div>
          </div>
        </div>
      </td>
      <td>${o.email}</td>
      <td>${o.phone || '—'}</td>
      <td>${o.city || o.country || '—'}</td>
      <td><span style="background:rgba(0,0,255,.08);color:var(--dj-blue);border-radius:12px;padding:.15rem .55rem;font-size:.75rem;font-weight:600" id="orgEvCount-${o.id}">…</span></td>
      <td>${o.is_active
        ? '<span style="color:#16a34a;font-size:.82rem"><i class="bi bi-check-circle-fill"></i> Actif</span>'
        : '<span style="color:#dc2626;font-size:.82rem"><i class="bi bi-x-circle-fill"></i> Suspendu</span>'}</td>
      <td>${fmtDate(o.created_at)}</td>
      <td style="white-space:nowrap">
        <button class="btn-dj ghost sm" title="Voir la fiche" onclick="viewOrg('${o.id}')"><i class="bi bi-eye"></i></button>
        <button class="btn-dj ghost sm" title="Modifier" onclick="openEditOrg(${JSON.stringify(o).replace(/"/g,'&quot;')})"><i class="bi bi-pencil"></i></button>
        <button class="btn-dj danger sm" title="Suspendre" onclick="toggleOrgStatus('${o.id}','${o.name}',${o.is_active})"><i class="bi bi-${o.is_active ? 'slash-circle' : 'check-circle'}"></i></button>
      </td>
    </tr>`).join('') || `<tr><td colspan="8"><div class="empty-state"><i class="bi bi-person-badge"></i>Aucun organisateur</div></td></tr>`;

  renderPagination('orgsPagination', data.meta, (p) => { orgsPage = p; loadOrganizers(); });

  // Charger le nb d'événements de chaque organisateur en arrière-plan
  data.data.forEach(o => {
    apiFetch(`/api/admin/events?organizer_id=${o.id}&limit=1`).then(d => {
      const el = document.getElementById(`orgEvCount-${o.id}`);
      if (el && d?.meta) el.textContent = `${fmtNum(d.meta.total)} événement${d.meta.total !== 1 ? 's' : ''}`;
    }).catch(() => {});
  });

  // Cartes visuelles
  renderOrgCards(data.data);
}

function renderOrgCards(orgs) {
  const grid = document.getElementById('orgsCardsGrid');
  if (!grid) return;
  if (!orgs.length) { grid.innerHTML = ''; return; }
  grid.innerHTML = orgs.map(o => `
    <div class="dj-card" style="padding:1.25rem;cursor:pointer" onclick="viewOrg('${o.id}')">
      <div style="display:flex;align-items:center;gap:.85rem;margin-bottom:.85rem">
        <div style="width:48px;height:48px;border-radius:12px;background:${orgColor(o.name)};
          display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.1rem;flex-shrink:0">
          ${avatar(o.name)}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${o.name}</div>
          <div style="font-size:.72rem;color:var(--dj-muted)">${o.city || o.country || 'Tchad'}</div>
        </div>
        ${o.is_verified ? '<i class="bi bi-patch-check-fill" style="color:var(--dj-blue);font-size:1rem" title="Vérifié"></i>' : ''}
      </div>
      <div style="font-size:.78rem;color:var(--dj-muted);margin-bottom:.85rem;min-height:2rem">
        ${o.bio ? o.bio.substring(0,80) + (o.bio.length > 80 ? '…' : '') : '<em>Aucune description</em>'}
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:.72rem;color:var(--dj-muted)"><i class="bi bi-telephone me-1"></i>${o.phone || '—'}</div>
        ${o.is_active
          ? '<span style="background:rgba(22,163,74,.1);color:#16a34a;font-size:.7rem;border-radius:20px;padding:.15rem .6rem;font-weight:600"><i class="bi bi-circle-fill" style="font-size:.45rem;vertical-align:middle"></i> Actif</span>'
          : '<span style="background:rgba(220,38,38,.1);color:#dc2626;font-size:.7rem;border-radius:20px;padding:.15rem .6rem;font-weight:600">Suspendu</span>'}
      </div>
    </div>`).join('');
}

document.getElementById('orgsSearch').addEventListener('input', function() { orgsSearch = this.value; orgsPage = 1; loadOrganizers(); });
document.getElementById('orgsStatusFilter').addEventListener('change', function() { orgsActive = this.value; orgsPage = 1; loadOrganizers(); });

/* ── Voir fiche organisateur ── */
async function viewOrg(id) {
  openModal('modalViewOrg');
  document.getElementById('orgDetailContent').innerHTML = '<div class="empty-state"><i class="bi bi-hourglass-split"></i>Chargement...</div>';

  let data;
  try { data = await apiFetch(`/api/admin/users/${id}`); } catch { return; }
  if (!data?.success) return;
  const o = data.data;

  let evData;
  try { evData = await apiFetch(`/api/admin/events?page=1&limit=5`); } catch { evData = null; }

  document.getElementById('orgDetailContent').innerHTML = `
    <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1.25rem;padding-bottom:1rem;border-bottom:1px solid var(--dj-border)">
      <div style="width:60px;height:60px;border-radius:14px;background:${orgColor(o.name)};
        display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.4rem;flex-shrink:0">
        ${avatar(o.name)}
      </div>
      <div>
        <div style="font-size:1.05rem;font-weight:800">${o.name}
          ${o.is_verified ? '<i class="bi bi-patch-check-fill" style="color:var(--dj-blue);margin-left:.3rem" title="Vérifié"></i>' : ''}
        </div>
        <div style="font-size:.8rem;color:var(--dj-muted)">${o.email}</div>
        <div style="margin-top:.35rem">${o.is_active
          ? '<span style="background:rgba(22,163,74,.1);color:#16a34a;font-size:.72rem;border-radius:20px;padding:.15rem .6rem;font-weight:600">✓ Actif</span>'
          : '<span style="background:rgba(220,38,38,.1);color:#dc2626;font-size:.72rem;border-radius:20px;padding:.15rem .6rem;font-weight:600">Suspendu</span>'}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.65rem;font-size:.82rem;margin-bottom:1rem">
      <div><span style="color:var(--dj-muted);font-size:.7rem">TÉLÉPHONE</span><br>${o.phone || '—'}</div>
      <div><span style="color:var(--dj-muted);font-size:.7rem">VILLE</span><br>${o.city || '—'}</div>
      <div><span style="color:var(--dj-muted);font-size:.7rem">PAYS</span><br>${o.country || 'Tchad'}</div>
      <div><span style="color:var(--dj-muted);font-size:.7rem">MEMBRE DEPUIS</span><br>${fmtDate(o.created_at)}</div>
      <div><span style="color:var(--dj-muted);font-size:.7rem">ÉVÉNEMENTS</span><br><strong style="color:var(--dj-blue)">${fmtNum(o.stats?.events || 0)}</strong></div>
      <div><span style="color:var(--dj-muted);font-size:.7rem">DERNIÈRE CONNEXION</span><br>${fmtDateTime(o.last_login)}</div>
    </div>
    ${o.bio ? `<div style="background:var(--dj-surface2);border-radius:8px;padding:.75rem .9rem;font-size:.82rem;color:var(--dj-muted);margin-bottom:.5rem"><i class="bi bi-quote me-1"></i>${o.bio}</div>` : ''}`;

  const footer = document.getElementById('orgDetailFooter');
  footer.innerHTML = `
    <button type="button" class="btn-dj ghost" onclick="closeModal('modalViewOrg')">Fermer</button>
    <button type="button" class="btn-dj warning" onclick="toggleOrgStatus('${o.id}','${o.name}',${o.is_active});closeModal('modalViewOrg')">
      <i class="bi bi-${o.is_active ? 'slash-circle' : 'check-circle'}"></i> ${o.is_active ? 'Suspendre' : 'Réactiver'}
    </button>
    <button type="button" class="btn-dj primary" onclick="closeModal('modalViewOrg');openEditOrg(${JSON.stringify(o).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026')})">
      <i class="bi bi-pencil"></i> Modifier
    </button>`;
}

/* ── Ouvrir modale d'édition ── */
function openEditOrg(o) {
  document.getElementById('editOrgId').value      = o.id;
  document.getElementById('editOrgName').value    = o.name    || '';
  document.getElementById('editOrgEmail').value   = o.email   || '';
  document.getElementById('editOrgPhone').value   = o.phone   || '';
  document.getElementById('editOrgCity').value    = o.city    || '';
  document.getElementById('editOrgCountry').value = o.country || 'Tchad';
  document.getElementById('editOrgBio').value     = o.bio     || '';
  document.getElementById('editOrgActive').value  = o.is_active ? '1' : '0';
  document.getElementById('editOrgVerified').value= o.is_verified ? '1' : '0';
  document.getElementById('btnSuspendOrg').onclick = () => toggleOrgStatus(o.id, o.name, o.is_active, true);
  document.getElementById('btnSuspendOrg').innerHTML = o.is_active
    ? '<i class="bi bi-slash-circle"></i> Suspendre'
    : '<i class="bi bi-check-circle"></i> Réactiver';
  openModal('modalEditOrg');
}

/* ── Soumettre modification ── */
document.getElementById('formEditOrg').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.submitter || e.target.querySelector('[type=submit]');
  setBtnLoading(btn, true);
  const id = document.getElementById('editOrgId').value;
  const body = {
    name:        document.getElementById('editOrgName').value,
    email:       document.getElementById('editOrgEmail').value,
    phone:       document.getElementById('editOrgPhone').value,
    city:        document.getElementById('editOrgCity').value,
    country:     document.getElementById('editOrgCountry').value,
    bio:         document.getElementById('editOrgBio').value,
    is_active:   parseInt(document.getElementById('editOrgActive').value),
    is_verified: parseInt(document.getElementById('editOrgVerified').value),
  };
  const data = await apiFetch(`/api/admin/users/${id}`, { method:'PUT', body: JSON.stringify(body) });
  setBtnLoading(btn, false);
  if (data?.success) { toast('Organisateur mis à jour ✓', 'success'); closeModal('modalEditOrg'); loadOrganizers(); }
  else toast(data?.message || 'Erreur', 'error');
});

/* ── Créer un organisateur ── */
document.getElementById('formCreateOrg').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.submitter || e.target.querySelector('[type=submit]');
  setBtnLoading(btn, true);
  const body = {
    name:     document.getElementById('newOrgName').value,
    email:    document.getElementById('newOrgEmail').value,
    phone:    document.getElementById('newOrgPhone').value,
    city:     document.getElementById('newOrgCity').value,
    country:  document.getElementById('newOrgCountry').value || 'Tchad',
    bio:      document.getElementById('newOrgBio').value,
    password: document.getElementById('newOrgPassword').value,
    role:     'organizer',
  };
  const data = await apiFetch('/api/admin/users', { method:'POST', body: JSON.stringify(body) });
  setBtnLoading(btn, false);
  if (data?.success) {
    toast('Organisateur créé ✓', 'success');
    closeModal('modalCreateOrg');
    e.target.reset();
    loadOrganizers();
  } else toast(data?.message || 'Erreur', 'error');
});

/* ── Suspendre / Réactiver ── */
async function toggleOrgStatus(id, name, isActive, fromModal = false) {
  const action = isActive ? 'suspendre' : 'réactiver';
  if (!confirm(`Voulez-vous ${action} l'organisateur "${name}" ?`)) return;
  const data = await apiFetch(`/api/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ is_active: isActive ? 0 : 1 }),
  });
  if (data?.success) {
    toast(`Organisateur ${isActive ? 'suspendu' : 'réactivé'} ✓`, 'success');
    if (fromModal) closeModal('modalEditOrg');
    loadOrganizers();
  } else toast(data?.message || 'Erreur', 'error');
}

/* ══════════════════════ SCAN LOGS ══════════════════════ */
async function loadScanLogs() {
  let data;
  try { data = await apiFetch('/api/admin/scan-logs?limit=50'); } catch { return; }
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
  let data;
  try { data = await apiFetch('/api/admin/categories'); } catch { return; }
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
