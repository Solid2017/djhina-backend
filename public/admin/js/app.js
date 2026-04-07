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

/* ── Prévisualisation instantanée d'image (FileReader, 0 réseau) ── */
function previewImage(input, previewId) {
  const wrap = document.getElementById(previewId);
  if (!wrap) return;
  const file = input.files[0];
  if (!file) { wrap.style.display = 'none'; return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = wrap.querySelector('img');
    img.src = e.target.result;
    wrap.style.display = 'block';
  };
  reader.readAsDataURL(file);
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
  document.getElementById('topbarTitle').textContent = { dashboard:'Tableau de bord', organizers:'Organisateurs', users:'Utilisateurs', events:'Événements', tickets:'Tickets', payments:'Paiements', scanlogs:'Logs de scan', categories:'Catégories', speakers:'Speakers' }[section] || section;
  localStorage.setItem('djhina_admin_section', section);
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
    speakers:   loadSpeakers,
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
  const params = new URLSearchParams({ page: usersPage, limit: 18, ...(usersRole && { role: usersRole }), ...(usersSearch && { search: usersSearch }) });
  let data;
  try { data = await apiFetch(`/api/admin/users?${params}`); } catch { return; }
  if (!data?.success) return;

  const grid = document.getElementById('usersGrid');
  if (!data.data.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="bi bi-people"></i>Aucun utilisateur trouvé</div>`;
    renderPagination('usersPagination', data.meta, (p) => { usersPage = p; loadUsers(); });
    return;
  }

  const ROLE_COLOR = { admin:'#7c3aed', organizer:'#0891b2', user:'#16a34a' };

  grid.innerHTML = data.data.map(u => {
    const roleColor = ROLE_COLOR[u.role] || '#64748b';
    const avatarUrl = u.avatar ? `${API_BASE}${u.avatar}` : null;
    const avatarHtml = avatarUrl
      ? `<img src="${avatarUrl}" class="usr-card-avatar" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        + `<div class="usr-card-avatar-placeholder" style="background:${roleColor};display:none">${avatar(u.name)}</div>`
      : `<div class="usr-card-avatar-placeholder" style="background:${roleColor}">${avatar(u.name)}</div>`;
    const statusHtml = u.is_active
      ? `<span class="usr-status-badge active"><i class="bi bi-check-circle-fill"></i> Actif</span>`
      : `<span class="usr-status-badge inactive"><i class="bi bi-x-circle-fill"></i> Inactif</span>`;
    return `
    <div class="usr-card">
      <div class="usr-card-header">
        <div class="usr-card-avatar-wrap">${avatarHtml}</div>
        <div class="usr-card-identity">
          <div class="usr-card-name">${u.name}</div>
          <div class="usr-card-email">${u.email}</div>
        </div>
        <span class="usr-role-badge" style="background:${roleColor}22;color:${roleColor};border:1px solid ${roleColor}44">${u.role}</span>
      </div>
      <div class="usr-card-meta">
        ${u.phone ? `<span><i class="bi bi-telephone"></i>${u.phone}</span>` : ''}
        ${u.country ? `<span><i class="bi bi-geo-alt"></i>${u.country}</span>` : ''}
        <span><i class="bi bi-clock"></i>${fmtDateTime(u.last_login)}</span>
      </div>
      <div class="usr-card-footer">
        ${statusHtml}
        <div class="usr-card-actions">
          <button class="btn-dj ghost sm" title="Voir fiche" onclick="viewUser('${u.id}')"><i class="bi bi-eye"></i></button>
          <button class="btn-dj ghost sm" title="Modifier" onclick="openEditUser('${u.id}','${u.name}','${u.email}','${u.role}','${u.phone||''}','${u.is_active}','${u.avatar||''}')"><i class="bi bi-pencil"></i></button>
          <button class="btn-dj danger sm" title="Désactiver" onclick="deleteUser('${u.id}','${u.name}')"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');

  renderPagination('usersPagination', data.meta, (p) => { usersPage = p; loadUsers(); });
}

document.getElementById('usersRoleFilter').addEventListener('change', function() { usersRole = this.value; usersPage = 1; loadUsers(); });

function previewAvatar(input, previewId) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    const wrap = document.getElementById(previewId);
    wrap.innerHTML = `<img src="${e.target.result}" class="usr-card-avatar" style="width:56px;height:56px">`;
  };
  reader.readAsDataURL(file);
}

function openEditUser(id, name, email, role, phone, isActive, avatarPath) {
  document.getElementById('editUserId').value     = id;
  document.getElementById('editUserName').value   = name;
  document.getElementById('editUserEmail').value  = email;
  document.getElementById('editUserRole').value   = role;
  document.getElementById('editUserPhone').value  = phone;
  document.getElementById('editUserActive').value = isActive;
  // Reset file input
  const fileInput = document.getElementById('editUserAvatar');
  fileInput.value = '';
  // Show current avatar or placeholder
  const preview = document.getElementById('editUserAvatarPreview');
  const roleColor = { admin:'#7c3aed', organizer:'#0891b2', user:'#16a34a' }[role] || '#64748b';
  if (avatarPath) {
    const src = avatarPath.startsWith('http') ? avatarPath : `${API_BASE}${avatarPath}`;
    preview.innerHTML = `<img src="${src}" class="usr-card-avatar" style="width:56px;height:56px" onerror="this.outerHTML='<div class=usr-card-avatar-placeholder style=background:${roleColor}>${avatar(name)}</div>'">`;
  } else {
    preview.innerHTML = `<div class="usr-card-avatar-placeholder" style="background:${roleColor}">${avatar(name)}</div>`;
  }
  openModal('modalEditUser');
}

document.getElementById('formEditUser').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editUserId').value;
  const fd = new FormData();
  fd.append('name',      document.getElementById('editUserName').value);
  fd.append('email',     document.getElementById('editUserEmail').value);
  fd.append('role',      document.getElementById('editUserRole').value);
  fd.append('phone',     document.getElementById('editUserPhone').value);
  fd.append('is_active', document.getElementById('editUserActive').value);
  const file = document.getElementById('editUserAvatar').files[0];
  if (file) fd.append('avatar', file);
  const data = await apiFetch(`/api/admin/users/${id}`, { method:'PUT', body: fd });
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

const EVENT_STATUS_COLOR = { published:'#16a34a', draft:'#d97706', cancelled:'#dc2626', completed:'#6366f1' };
const EVENT_STATUS_LABEL = { published:'Publié', draft:'Brouillon', cancelled:'Annulé', completed:'Terminé' };
const EVENT_TYPE_ICON    = { concert:'bi-music-note-beamed', conference:'bi-mic', festival:'bi-stars', sport:'bi-trophy', expo:'bi-easel' };

async function loadEvents() {
  const search = document.getElementById('eventsSearch')?.value?.trim() || '';
  const params = new URLSearchParams({
    page: eventsPage, limit: 12,
    ...(eventsStatus && { status: eventsStatus }),
    ...(search && { search }),
  });
  const grid = document.getElementById('eventsGrid');
  grid.innerHTML = '<div class="empty-state"><i class="bi bi-hourglass-split"></i>Chargement…</div>';

  let data;
  try { data = await apiFetch(`/api/admin/events?${params}`); } catch { data = null; }
  if (!data?.success) {
    grid.innerHTML = `<div class="empty-state" style="color:#dc2626"><i class="bi bi-exclamation-circle"></i> ${data?.message || 'Erreur serveur'}</div>`;
    return;
  }

  if (!data.data.length) {
    grid.innerHTML = '<div class="empty-state"><i class="bi bi-calendar-x"></i>Aucun événement trouvé</div>';
    renderPagination('eventsPagination', data.meta, (p) => { eventsPage = p; loadEvents(); });
    return;
  }

  grid.innerHTML = data.data.map(e => {
    const pct  = e.capacity ? Math.min(100, Math.round((e.registered / e.capacity) * 100)) : 0;
    const sc   = EVENT_STATUS_COLOR[e.status] || '#6b7280';
    const sl   = EVENT_STATUS_LABEL[e.status] || e.status;
    const safeTitle = (e.title||'').replace(/'/g,"\\'").replace(/"/g,'&quot;');
    const coverSrc  = e.cover_image ? (e.cover_image.startsWith('http') ? e.cover_image : `${API_BASE}${e.cover_image}`) : null;
    const coverHtml = coverSrc
      ? `<img src="${coverSrc}" alt="${e.title}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=ev-card-cover-placeholder><i class=bi-bi-calendar-event style=font-size:3rem;color:var(--dj-border)></i></div>'">`
      : `<div class="ev-card-cover-placeholder"><i class="bi bi-calendar-event"></i></div>`;

    return `
    <div class="ev-card">
      <div class="ev-card-cover">
        ${coverHtml}
        <div class="ev-card-badges">
          <span class="ev-badge" style="background:${sc}22;color:${sc};border:1px solid ${sc}44">${sl}</span>
          ${e.is_featured ? '<span class="ev-badge" style="background:rgba(234,179,8,.2);color:#ca8a04;border:1px solid rgba(234,179,8,.3)">⭐ Vedette</span>' : ''}
        </div>
        <button class="ev-star-btn" title="${e.is_featured ? 'Retirer' : 'Mettre en avant'}" onclick="featureEvent('${e.id}')">
          ${e.is_featured ? '⭐' : '☆'}
        </button>
      </div>
      <div class="ev-card-body">
        <div class="ev-card-title" title="${e.title}">${e.title}</div>
        <div class="ev-card-meta">
          <span><i class="bi bi-calendar3"></i>${fmtDate(e.date)}</span>
          ${e.location ? `<span><i class="bi bi-geo-alt"></i>${e.location}${e.city ? ', '+e.city : ''}</span>` : ''}
          <span><i class="bi bi-person-badge"></i>${e.organizer_name || '—'}</span>
          ${e.category ? `<span><i class="bi bi-tag"></i>${e.category}</span>` : ''}
        </div>
        ${e.capacity ? `
        <div class="ev-card-capacity">
          <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--dj-muted);margin-bottom:3px">
            <span>${fmtNum(e.registered)} inscrits</span>
            <span>${fmtNum(e.capacity)} places</span>
          </div>
          <div class="capacity-bar"><div class="capacity-bar-fill" style="width:${pct}%;background:${pct>85?'#dc2626':pct>60?'#d97706':'var(--dj-blue)'}"></div></div>
        </div>` : ''}
      </div>
      <div class="ev-card-footer">
        <select class="dj-select" style="font-size:.72rem;padding:.2rem .45rem;flex:1;min-width:0" onchange="setEventStatus('${e.id}',this.value)">
          <option value="published"  ${e.status==='published' ?'selected':''}>Publié</option>
          <option value="draft"      ${e.status==='draft'     ?'selected':''}>Brouillon</option>
          <option value="cancelled"  ${e.status==='cancelled' ?'selected':''}>Annulé</option>
        </select>
        <button class="btn-dj ghost sm" title="Voir détails" onclick="viewEvent('${e.id}')"><i class="bi bi-eye"></i></button>
        <button class="btn-dj info sm" title="Agenda" onclick="openAgendaModal('${e.id}','${safeTitle}')"><i class="bi bi-list-ul"></i></button>
        <button class="btn-dj ghost sm" title="Modifier" onclick="openEditEvent('${e.id}')"><i class="bi bi-pencil"></i></button>
        <button class="btn-dj danger sm" title="Supprimer" onclick="deleteEvent('${e.id}','${safeTitle}')"><i class="bi bi-trash"></i></button>
      </div>
    </div>`;
  }).join('');

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
    const res = await fetch(`${API_BASE}/api/admin/events`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: fd,
    });
    const data = await res.json();
    if (data?.success) {
      toast('Événement créé avec succès ✓', 'success');
      closeModal('modalCreateEvent');
      e.target.reset();
      const prev = document.getElementById('newEvPreview');
      if (prev) prev.style.display = 'none';
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
  document.getElementById('editEvCover').value    = '';
  const prev = document.getElementById('editEvPreview');
  if (prev) prev.style.display = 'none';

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

    // Afficher la couverture actuelle si elle existe
    const prevWrap = document.getElementById('editEvPreview');
    if (prevWrap) {
      if (e.cover_image) {
        prevWrap.querySelector('img').src = e.cover_image;
        prevWrap.style.display = 'block';
        prevWrap.querySelector('img').style.opacity = '0.6';
        prevWrap.title = 'Image actuelle — sélectionne un nouveau fichier pour la remplacer';
      } else {
        prevWrap.style.display = 'none';
      }
    }

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
    const putRes = await fetch(`${API_BASE}/api/admin/events/${id}`, {
      method: 'PUT',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: fd,
    });
    const data = await putRes.json();
    if (data?.success) {
      // Mettre à jour le statut séparément
      const newStatus = document.getElementById('editEvStatus').value;
      await apiFetch(`/api/admin/events/${id}/status`, {
        method: 'PUT', body: JSON.stringify({ status: newStatus }),
      });
      setBtnLoading(btn, false);
      toast('Événement mis à jour ✓', 'success');
      closeModal('modalEditEvent');
      // Réinitialiser la prévisualisation
      const prev = document.getElementById('editEvPreview');
      if (prev) prev.style.display = 'none';
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
  const data = await apiFetch(`/api/admin/events/${id}`, { method:'DELETE' });
  if (data?.success) {
    toast('Événement annulé', 'success');
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
  document.getElementById('ticketsTbody').innerHTML =
    '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--dj-muted)"><i class="bi bi-hourglass-split me-1"></i>Chargement…</td></tr>';
  let data;
  try { data = await apiFetch(`/api/admin/tickets?${params}`); } catch { data = null; }
  if (!data?.success) {
    document.getElementById('ticketsTbody').innerHTML =
      `<tr><td colspan="8"><div class="empty-state" style="color:#dc2626"><i class="bi bi-exclamation-circle"></i> ${data?.message || 'Erreur serveur'}</div></td></tr>`;
    return;
  }

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
  document.getElementById('paymentsTbody').innerHTML =
    '<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--dj-muted)"><i class="bi bi-hourglass-split me-1"></i>Chargement…</td></tr>';
  let data;
  try { data = await apiFetch(`/api/admin/payments?${params}`); } catch { data = null; }
  if (!data?.success) {
    document.getElementById('paymentsTbody').innerHTML =
      `<tr><td colspan="8"><div class="empty-state" style="color:#dc2626"><i class="bi bi-exclamation-circle"></i> ${data?.message || 'Erreur serveur'}</div></td></tr>`;
    return;
  }

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
  const grid = document.getElementById('orgsGrid');
  grid.innerHTML = '<div class="empty-state"><i class="bi bi-hourglass-split"></i>Chargement…</div>';

  let data;
  try { data = await apiFetch(`/api/admin/users?${params}`); } catch { return; }
  if (!data?.success) {
    grid.innerHTML = '<div class="empty-state" style="color:#dc2626"><i class="bi bi-exclamation-circle"></i>Erreur de chargement</div>';
    return;
  }

  if (!data.data.length) {
    grid.innerHTML = '<div class="empty-state"><i class="bi bi-person-badge"></i>Aucun organisateur</div>';
    renderPagination('orgsPagination', data.meta, (p) => { orgsPage = p; loadOrganizers(); });
    return;
  }

  grid.innerHTML = data.data.map(o => {
    const logoSrc  = o.avatar ? (o.avatar.startsWith('http') ? o.avatar : `${API_BASE}${o.avatar}`) : null;
    const logoHtml = logoSrc
      ? `<img src="${logoSrc}" class="org-card-logo" alt="${o.name}" onerror="this.outerHTML='<div class=org-card-logo-placeholder style=background:${orgColor(o.name)}>${avatar(o.name)}</div>'">`
      : `<div class="org-card-logo-placeholder" style="background:${orgColor(o.name)}">${avatar(o.name)}</div>`;
    return `
    <div class="org-card">
      <div class="org-card-header">
        ${logoHtml}
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:.92rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${o.name}
            ${o.is_verified ? '<i class="bi bi-patch-check-fill" style="color:var(--dj-blue);margin-left:.3rem;font-size:.8rem" title="Vérifié"></i>' : ''}
          </div>
          <div style="font-size:.72rem;color:var(--dj-muted);margin-top:.1rem">${o.city || o.country || 'Tchad'}</div>
        </div>
        ${o.is_active
          ? '<span class="org-status-badge active">Actif</span>'
          : '<span class="org-status-badge suspended">Suspendu</span>'}
      </div>

      <div class="org-card-bio">${o.bio ? o.bio.substring(0,90)+(o.bio.length>90?'…':'') : '<em>Aucune description</em>'}</div>

      <div class="org-card-info">
        <span><i class="bi bi-envelope"></i>${o.email}</span>
        <span><i class="bi bi-telephone"></i>${o.phone || '—'}</span>
        <span id="orgEvCount-${o.id}"><i class="bi bi-calendar-event"></i>… événements</span>
        <span><i class="bi bi-clock"></i>${fmtDate(o.created_at)}</span>
      </div>

      <div class="org-card-actions">
        <button class="btn-dj ghost sm" onclick="viewOrg('${o.id}')"><i class="bi bi-eye"></i> Fiche</button>
        <button class="btn-dj ghost sm" onclick="openEditOrg(${JSON.stringify(o).replace(/"/g,'&quot;')})"><i class="bi bi-pencil"></i> Modifier</button>
        <button class="btn-dj ${o.is_active ? 'danger' : 'success'} sm" onclick="toggleOrgStatus('${o.id}','${(o.name||'').replace(/'/g,"\\'")}',${o.is_active})">
          <i class="bi bi-${o.is_active ? 'slash-circle' : 'check-circle'}"></i> ${o.is_active ? 'Suspendre' : 'Réactiver'}
        </button>
      </div>
    </div>`;
  }).join('');

  renderPagination('orgsPagination', data.meta, (p) => { orgsPage = p; loadOrganizers(); });

  // Événements par organisateur (arrière-plan)
  data.data.forEach(o => {
    apiFetch(`/api/admin/events?organizer_id=${o.id}&limit=1`).then(d => {
      const el = document.getElementById(`orgEvCount-${o.id}`);
      if (el && d?.meta) el.innerHTML = `<i class="bi bi-calendar-event"></i>${fmtNum(d.meta.total)} événement${d.meta.total!==1?'s':''}`;
    }).catch(() => {});
  });
}

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
      ${o.avatar
        ? `<img src="${o.avatar.startsWith('http') ? o.avatar : API_BASE+o.avatar}" style="width:64px;height:64px;border-radius:14px;object-fit:cover;border:2px solid var(--dj-border);flex-shrink:0" alt="${o.name}">`
        : `<div style="width:64px;height:64px;border-radius:14px;background:${orgColor(o.name)};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.5rem;flex-shrink:0">${avatar(o.name)}</div>`}
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
    <button type="button" class="btn-dj primary" onclick="closeModal('modalViewOrg');openEditOrg(${JSON.stringify(o).replace(/</g,'\\u003c').replace(/>/g,'\\u003e').replace(/&/g,'\\u0026').replace(/"/g,'&quot;')})">
      <i class="bi bi-pencil"></i> Modifier
    </button>`;
}

/* ══════════════════════ VIEW EVENT ══════════════════════ */
const SESSION_TYPE_LABEL = { keynote:'Keynote', conference:'Conférence', workshop:'Atelier', panel:'Table ronde', networking:'Networking', break:'Pause', other:'Autre' };
const SESSION_TYPE_COLOR = { keynote:'#7c3aed', conference:'#0891b2', workshop:'#16a34a', panel:'#d97706', networking:'#db2777', break:'#64748b', other:'#6366f1' };

async function viewEvent(id) {
  openModal('modalViewEvent');
  const el = document.getElementById('eventDetailContent');
  el.innerHTML = '<div class="empty-state"><i class="bi bi-hourglass-split"></i>Chargement...</div>';

  const [evRes, sessRes] = await Promise.all([
    apiFetch(`/api/admin/events/${id}`),
    apiFetch(`/api/admin/events/${id}/sessions`),
  ]);
  if (!evRes?.success) { el.innerHTML = '<div class="empty-state" style="color:#f87171"><i class="bi bi-exclamation-triangle"></i>Erreur de chargement</div>'; return; }

  const e    = evRes.data;
  const sess = sessRes?.data || [];
  const coverSrc = e.cover_image ? (e.cover_image.startsWith('http') ? e.cover_image : `${API_BASE}${e.cover_image}`) : null;

  // Sessions + speakers HTML
  const sessHtml = sess.length ? sess.map(s => {
    const tc = SESSION_TYPE_COLOR[s.type] || '#6366f1';
    const tl = SESSION_TYPE_LABEL[s.type] || s.type;
    const spHtml = (s.speakers || []).map(sp => {
      const photoHtml = sp.photo
        ? `<img src="${sp.photo}" class="detail-sp-photo" alt="${sp.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div class="detail-sp-photo" style="display:none;background:linear-gradient(135deg,#7c3aed,#6366f1);color:#fff;font-weight:700;font-size:.6rem;align-items:center;justify-content:center">${avatar(sp.name)}</div>`
        : `<div class="detail-sp-photo" style="background:linear-gradient(135deg,#7c3aed,#6366f1);color:#fff;font-weight:700;font-size:.6rem;display:flex;align-items:center;justify-content:center">${avatar(sp.name)}</div>`;
      return `<div class="detail-sp-chip">${photoHtml}<div><div style="font-weight:600;font-size:.75rem">${sp.name}</div>${sp.job_title?`<div style="font-size:.68rem;color:var(--dj-muted)">${sp.job_title}</div>`:''}</div></div>`;
    }).join('');
    return `
    <div class="detail-session">
      <div class="detail-session-head">
        <span class="detail-sess-type" style="background:${tc}1a;color:${tc};border:1px solid ${tc}33">${tl}</span>
        <strong style="font-size:.88rem;flex:1">${s.title}</strong>
        <span style="font-size:.72rem;color:var(--dj-muted);white-space:nowrap">
          <i class="bi bi-clock"></i> ${s.start_time ? new Date(s.start_time).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'}) : '—'}
          ${s.end_time ? ' → '+new Date(s.end_time).toLocaleTimeString('fr',{hour:'2-digit',minute:'2-digit'}) : ''}
        </span>
        ${s.room ? `<span style="font-size:.72rem;color:var(--dj-muted)"><i class="bi bi-geo-alt"></i> ${s.room}</span>` : ''}
      </div>
      ${s.description ? `<div style="font-size:.78rem;color:var(--dj-muted);margin:.35rem 0 .4rem;line-height:1.5">${s.description}</div>` : ''}
      ${s.access_conditions ? `<div style="font-size:.72rem;color:#d97706;background:rgba(217,119,6,.08);border-radius:6px;padding:.25rem .55rem;margin-bottom:.4rem"><i class="bi bi-lock"></i> ${s.access_conditions}</div>` : ''}
      ${spHtml ? `<div class="detail-sp-list">${spHtml}</div>` : '<div style="font-size:.72rem;color:var(--dj-muted);font-style:italic">Aucun speaker assigné</div>'}
    </div>`;
  }).join('') : `<div class="empty-state" style="padding:1.5rem"><i class="bi bi-calendar-x"></i> Aucune session créée pour cet événement</div>`;

  const sc = EVENT_STATUS_COLOR[e.status] || '#6b7280';
  el.innerHTML = `
    ${coverSrc ? `<div style="height:180px;overflow:hidden;position:relative"><img src="${coverSrc}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.style.display='none'"><div style="position:absolute;inset:0;background:linear-gradient(to bottom,transparent 50%,rgba(0,0,0,.55))"></div></div>` : ''}
    <div style="padding:1.25rem 1.4rem">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;margin-bottom:1rem">
        <div>
          <h4 style="margin:0;font-size:1.05rem;font-weight:800">${e.title}</h4>
          ${e.subtitle ? `<div style="font-size:.82rem;color:var(--dj-muted);margin-top:.2rem">${e.subtitle}</div>` : ''}
        </div>
        <span style="background:${sc}1a;color:${sc};border:1px solid ${sc}33;font-size:.7rem;font-weight:700;padding:.2rem .6rem;border-radius:99px;white-space:nowrap">${EVENT_STATUS_LABEL[e.status]||e.status}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:.5rem .9rem;font-size:.8rem;margin-bottom:1rem">
        <div><span style="color:var(--dj-muted);font-size:.68rem;text-transform:uppercase">Date</span><br><strong>${fmtDate(e.date)}</strong></div>
        ${e.location ? `<div><span style="color:var(--dj-muted);font-size:.68rem;text-transform:uppercase">Lieu</span><br><strong>${e.location}${e.city?', '+e.city:''}</strong></div>` : ''}
        <div><span style="color:var(--dj-muted);font-size:.68rem;text-transform:uppercase">Organisateur</span><br><strong>${e.organizer_name||'—'}</strong></div>
        ${e.capacity ? `<div><span style="color:var(--dj-muted);font-size:.68rem;text-transform:uppercase">Capacité</span><br><strong>${fmtNum(e.registered)} / ${fmtNum(e.capacity)}</strong></div>` : ''}
      </div>
      ${e.description ? `<div style="font-size:.82rem;color:var(--dj-muted);margin-bottom:1rem;line-height:1.6;border-top:1px solid var(--dj-border);padding-top:.85rem">${e.description}</div>` : ''}
      <div style="border-top:1px solid var(--dj-border);padding-top:.85rem">
        <div style="font-weight:700;font-size:.85rem;margin-bottom:.75rem;display:flex;align-items:center;gap:.5rem">
          <i class="bi bi-list-ul" style="color:var(--dj-blue)"></i> Programme (${sess.length} session${sess.length!==1?'s':''})
        </div>
        <div class="detail-sessions-list">${sessHtml}</div>
      </div>
    </div>`;

  const safeTitle = (e.title||'').replace(/'/g,"\\'");
  document.getElementById('btnViewEventAgenda').onclick = () => { closeModal('modalViewEvent'); openAgendaModal(id, safeTitle); };
  document.getElementById('btnViewEventEdit').onclick   = () => { closeModal('modalViewEvent'); openEditEvent(id); };
}

/* ══════════════════════ VIEW SPEAKER ══════════════════════ */
async function viewSpeaker(id) {
  openModal('modalViewSpeaker');
  document.getElementById('speakerDetailContent').innerHTML = '<div class="empty-state"><i class="bi bi-hourglass-split"></i>Chargement...</div>';

  const data = await apiFetch(`/api/admin/speakers/${id}`);
  if (!data?.success) { document.getElementById('speakerDetailContent').innerHTML = '<div class="empty-state" style="color:#f87171"><i class="bi bi-exclamation-triangle"></i>Erreur</div>'; return; }
  const s = data.data;
  const sl = (typeof s.social_links === 'string' ? JSON.parse(s.social_links) : s.social_links) || {};
  const photoHtml = s.photo
    ? `<img src="${s.photo}" style="width:88px;height:88px;border-radius:50%;object-fit:cover;border:3px solid var(--dj-border)" alt="${s.name}">`
    : `<div style="width:88px;height:88px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#6366f1);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.8rem">${avatar(s.name)}</div>`;

  const socialsHtml = [
    sl.twitter   ? `<a href="${sl.twitter}"   target="_blank" class="sp-social-link" style="font-size:1.1rem" title="Twitter"><i class="bi bi-twitter-x"></i></a>` : '',
    sl.linkedin  ? `<a href="${sl.linkedin}"  target="_blank" class="sp-social-link" style="font-size:1.1rem" title="LinkedIn"><i class="bi bi-linkedin"></i></a>` : '',
    sl.instagram ? `<a href="${sl.instagram}" target="_blank" class="sp-social-link" style="font-size:1.1rem" title="Instagram"><i class="bi bi-instagram"></i></a>` : '',
    sl.website   ? `<a href="${sl.website}"   target="_blank" class="sp-social-link" style="font-size:1.1rem" title="Site web"><i class="bi bi-globe"></i></a>` : '',
  ].filter(Boolean).join('');

  // Événements déduits des sessions
  const eventsUniq = [];
  const seenEv = new Set();
  (s.sessions||[]).forEach(sess => {
    if (sess.event_title && !seenEv.has(sess.event_title)) {
      seenEv.add(sess.event_title);
      eventsUniq.push({ title: sess.event_title, session: sess.title, type: sess.type });
    }
  });
  const evBadges = eventsUniq.map(e => `
    <div class="sp-event-badge" style="flex-direction:column;align-items:flex-start;gap:.1rem;padding:.35rem .65rem">
      <span style="display:flex;align-items:center;gap:.35rem"><i class="bi bi-calendar-event"></i><strong>${e.title}</strong></span>
      <span style="font-size:.67rem;color:var(--dj-muted);padding-left:1.3rem">${SESSION_TYPE_LABEL[e.type]||e.type} — ${e.session}</span>
    </div>`).join('');

  document.getElementById('speakerDetailContent').innerHTML = `
    <div style="text-align:center;padding:1.5rem 1.25rem 1rem">
      ${photoHtml}
      <div style="font-size:1.1rem;font-weight:800;margin-top:.75rem">${s.name}
        ${s.is_active ? '<i class="bi bi-check-circle-fill" style="color:#16a34a;font-size:.8rem;margin-left:.3rem"></i>' : ''}
      </div>
      ${s.job_title ? `<div style="font-size:.82rem;color:var(--dj-muted);margin-top:.15rem">${s.job_title}${s.company?` <em>— ${s.company}</em>`:''}</div>` : ''}
      ${socialsHtml ? `<div style="display:flex;justify-content:center;gap:.75rem;margin-top:.75rem">${socialsHtml}</div>` : ''}
    </div>
    <div style="padding:0 1.25rem 1.25rem;display:flex;flex-direction:column;gap:.9rem;border-top:1px solid var(--dj-border);padding-top:.9rem">
      ${s.bio ? `<div><div style="font-size:.68rem;color:var(--dj-muted);text-transform:uppercase;font-weight:700;margin-bottom:.3rem">Biographie</div><div style="font-size:.82rem;line-height:1.6;color:var(--dj-muted)">${s.bio}</div></div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem .9rem;font-size:.8rem">
        ${s.email ? `<div><span style="color:var(--dj-muted);font-size:.68rem;text-transform:uppercase">Email</span><br><a href="mailto:${s.email}" style="color:var(--dj-blue)">${s.email}</a></div>` : ''}
        ${s.phone ? `<div><span style="color:var(--dj-muted);font-size:.68rem;text-transform:uppercase">Téléphone</span><br>${s.phone}</div>` : ''}
        <div><span style="color:var(--dj-muted);font-size:.68rem;text-transform:uppercase">Organisateur</span><br>${s.organizer_name||'—'}</div>
        <div><span style="color:var(--dj-muted);font-size:.68rem;text-transform:uppercase">Depuis</span><br>${fmtDate(s.created_at)}</div>
      </div>
      ${evBadges ? `<div><div style="font-size:.68rem;color:var(--dj-muted);text-transform:uppercase;font-weight:700;margin-bottom:.4rem">Événements associés</div><div style="display:flex;flex-direction:column;gap:.3rem">${evBadges}</div></div>` : ''}
    </div>`;

  document.getElementById('btnViewSpEdit').onclick = () => { closeModal('modalViewSpeaker'); openEditSpeakerModal(id); };
}

/* ══════════════════════ VIEW USER ══════════════════════ */
async function viewUser(id) {
  openModal('modalViewUser');
  document.getElementById('userDetailContent').innerHTML = '<div class="empty-state"><i class="bi bi-hourglass-split"></i>Chargement...</div>';

  const data = await apiFetch(`/api/admin/users/${id}`);
  if (!data?.success) { document.getElementById('userDetailContent').innerHTML = '<div class="empty-state" style="color:#f87171"><i class="bi bi-exclamation-triangle"></i>Erreur</div>'; return; }
  const u = data.data;
  const ROLE_COLOR = { admin:'#7c3aed', organizer:'#0891b2', user:'#16a34a' };
  const rc = ROLE_COLOR[u.role] || '#64748b';
  const avatarUrl = u.avatar ? (u.avatar.startsWith('http') ? u.avatar : `${API_BASE}${u.avatar}`) : null;
  const photoHtml = avatarUrl
    ? `<img src="${avatarUrl}" style="width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid var(--dj-border)" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
      + `<div style="width:80px;height:80px;border-radius:50%;background:${rc};display:none;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.6rem">${avatar(u.name)}</div>`
    : `<div style="width:80px;height:80px;border-radius:50%;background:${rc};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:1.6rem">${avatar(u.name)}</div>`;

  document.getElementById('userDetailContent').innerHTML = `
    <div style="text-align:center;padding:1.5rem 1.25rem 1rem">
      <div style="display:inline-flex">${photoHtml}</div>
      <div style="font-size:1.05rem;font-weight:800;margin-top:.7rem">${u.name}</div>
      <div style="font-size:.78rem;color:var(--dj-muted)">${u.email}</div>
      <div style="display:flex;justify-content:center;gap:.5rem;margin-top:.6rem">
        <span style="background:${rc}1a;color:${rc};border:1px solid ${rc}33;font-size:.68rem;font-weight:700;padding:.15rem .55rem;border-radius:99px;text-transform:capitalize">${u.role}</span>
        ${u.is_active
          ? '<span style="background:rgba(22,163,74,.1);color:#16a34a;font-size:.68rem;font-weight:700;padding:.15rem .55rem;border-radius:99px;border:1px solid rgba(22,163,74,.25)">✓ Actif</span>'
          : '<span style="background:rgba(220,38,38,.1);color:#dc2626;font-size:.68rem;font-weight:700;padding:.15rem .55rem;border-radius:99px;border:1px solid rgba(220,38,38,.2)">Inactif</span>'}
      </div>
    </div>
    <div style="padding:0 1.25rem 1.25rem;border-top:1px solid var(--dj-border);padding-top:.9rem">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem .9rem;font-size:.8rem">
        ${u.phone    ? `<div><span style="color:var(--dj-muted);font-size:.68rem;text-transform:uppercase">Téléphone</span><br>${u.phone}</div>` : ''}
        ${u.country  ? `<div><span style="color:var(--dj-muted);font-size:.68rem;text-transform:uppercase">Pays</span><br>${u.country}</div>` : ''}
        ${u.city     ? `<div><span style="color:var(--dj-muted);font-size:.68rem;text-transform:uppercase">Ville</span><br>${u.city}</div>` : ''}
        <div><span style="color:var(--dj-muted);font-size:.68rem;text-transform:uppercase">Inscrit le</span><br>${fmtDate(u.created_at)}</div>
        <div><span style="color:var(--dj-muted);font-size:.68rem;text-transform:uppercase">Dernière connexion</span><br>${fmtDateTime(u.last_login)}</div>
        <div><span style="color:var(--dj-muted);font-size:.68rem;text-transform:uppercase">Vérifié</span><br>${u.is_verified ? '<span style="color:#16a34a">✓ Oui</span>' : '<span style="color:var(--dj-muted)">Non</span>'}</div>
      </div>
      ${u.bio ? `<div style="margin-top:.85rem"><span style="color:var(--dj-muted);font-size:.68rem;text-transform:uppercase">Bio</span><div style="font-size:.8rem;color:var(--dj-muted);margin-top:.25rem;line-height:1.6">${u.bio}</div></div>` : ''}
    </div>`;

  document.getElementById('btnViewUserEdit').onclick = () => {
    closeModal('modalViewUser');
    openEditUser(u.id, u.name, u.email, u.role, u.phone||'', u.is_active, u.avatar||'');
  };
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
  // Logo existant
  const logoWrap = document.getElementById('editOrgCurrentLogo');
  if (o.avatar) {
    const logoSrc = o.avatar.startsWith('http') ? o.avatar : `${API_BASE}${o.avatar}`;
    document.getElementById('editOrgCurrentLogoImg').src = logoSrc;
    logoWrap.style.display = 'block';
  } else { logoWrap.style.display = 'none'; }
  document.getElementById('editOrgLogo').value = '';
  document.getElementById('editOrgLogoPreview').style.display = 'none';
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
  const fd = new FormData();
  fd.append('name',        document.getElementById('editOrgName').value);
  fd.append('email',       document.getElementById('editOrgEmail').value);
  fd.append('phone',       document.getElementById('editOrgPhone').value);
  fd.append('city',        document.getElementById('editOrgCity').value);
  fd.append('country',     document.getElementById('editOrgCountry').value);
  fd.append('bio',         document.getElementById('editOrgBio').value);
  fd.append('is_active',   document.getElementById('editOrgActive').value);
  fd.append('is_verified', document.getElementById('editOrgVerified').value);
  const logoFile = document.getElementById('editOrgLogo').files[0];
  if (logoFile) fd.append('avatar', logoFile);

  const data = await apiFetch(`/api/admin/users/${id}`, { method:'PUT', body: fd });
  setBtnLoading(btn, false);
  if (data?.success) { toast('Organisateur mis à jour ✓', 'success'); closeModal('modalEditOrg'); loadOrganizers(); }
  else toast(data?.message || 'Erreur', 'error');
});

/* ── Créer un organisateur ── */
document.getElementById('formCreateOrg').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btnCreateOrg') || e.submitter || e.target.querySelector('[type=submit]');
  setBtnLoading(btn, true);
  const fd = new FormData();
  fd.append('name',     document.getElementById('newOrgName').value);
  fd.append('email',    document.getElementById('newOrgEmail').value);
  fd.append('phone',    document.getElementById('newOrgPhone').value);
  fd.append('city',     document.getElementById('newOrgCity').value);
  fd.append('country',  document.getElementById('newOrgCountry').value || 'Tchad');
  fd.append('bio',      document.getElementById('newOrgBio').value);
  fd.append('password', document.getElementById('newOrgPassword').value);
  fd.append('role',     'organizer');
  const logoFile = document.getElementById('newOrgLogo').files[0];
  if (logoFile) fd.append('avatar', logoFile);

  const data = await apiFetch('/api/admin/users', { method:'POST', body: fd });
  setBtnLoading(btn, false);
  if (data?.success) {
    toast('Organisateur créé ✓', 'success');
    closeModal('modalCreateOrg');
    e.target.reset();
    document.getElementById('newOrgLogoPreview').style.display = 'none';
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
  document.getElementById('scansTbody').innerHTML =
    '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--dj-muted)"><i class="bi bi-hourglass-split me-1"></i>Chargement…</td></tr>';
  let data;
  try { data = await apiFetch('/api/admin/scan-logs?limit=50'); } catch { data = null; }
  if (!data?.success) {
    document.getElementById('scansTbody').innerHTML =
      `<tr><td colspan="6"><div class="empty-state" style="color:#dc2626"><i class="bi bi-exclamation-circle"></i> ${data?.message || 'Erreur serveur'}</div></td></tr>`;
    return;
  }

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

/* ══════════════════════ SPEAKERS ══════════════════════ */
let _spPage = 1;

async function loadSpeakers(page = 1) {
  _spPage = page;
  const search = document.getElementById('speakersSearch')?.value?.trim() || '';
  const params = new URLSearchParams({ page, limit: 16, ...(search && { search }) });
  const grid = document.getElementById('speakersGrid');
  grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="bi bi-hourglass-split"></i> Chargement…</div>`;

  const data = await apiFetch(`/api/admin/speakers?${params}`);
  if (!data?.success) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;color:#f87171"><i class="bi bi-exclamation-triangle"></i> Erreur de chargement</div>`;
    return;
  }
  if (!data.data.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><i class="bi bi-mic-mute"></i>Aucun speaker trouvé</div>`;
    renderPagination('speakersPagination', data.meta, loadSpeakers);
    return;
  }

  grid.innerHTML = data.data.map(s => {
    const photoHtml = s.photo
      ? `<img src="${s.photo}" class="sp-card-photo" alt="${s.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
        + `<div class="sp-card-photo-placeholder" style="display:none">${avatar(s.name)}</div>`
      : `<div class="sp-card-photo-placeholder">${avatar(s.name)}</div>`;

    const statusBadge = s.is_active
      ? `<span class="sp-status-badge active"><i class="bi bi-check-circle-fill"></i> Actif</span>`
      : `<span class="sp-status-badge inactive"><i class="bi bi-x-circle-fill"></i> Inactif</span>`;

    const eventsHtml = (s.events || []).length
      ? (s.events || []).map(e => `<span class="sp-event-badge" title="${e.title}"><i class="bi bi-calendar-event"></i> ${e.title}</span>`).join('')
      : `<span class="sp-event-badge empty"><i class="bi bi-calendar-x"></i> Aucun événement</span>`;

    const sl = s.social_links || {};
    const socialsHtml = [
      sl.twitter    ? `<a href="${sl.twitter}"    target="_blank" class="sp-social-link" title="Twitter"><i class="bi bi-twitter-x"></i></a>` : '',
      sl.linkedin   ? `<a href="${sl.linkedin}"   target="_blank" class="sp-social-link" title="LinkedIn"><i class="bi bi-linkedin"></i></a>` : '',
      sl.instagram  ? `<a href="${sl.instagram}"  target="_blank" class="sp-social-link" title="Instagram"><i class="bi bi-instagram"></i></a>` : '',
      sl.website    ? `<a href="${sl.website}"    target="_blank" class="sp-social-link" title="Site web"><i class="bi bi-globe"></i></a>` : '',
    ].filter(Boolean).join('');

    return `
    <div class="sp-card">
      <div class="sp-card-top">
        <div class="sp-card-photo-wrap">${photoHtml}</div>
        ${statusBadge}
      </div>
      <div class="sp-card-body">
        <div class="sp-card-name">${s.name}</div>
        ${s.job_title ? `<div class="sp-card-title">${s.job_title}${s.company ? ` <span class="sp-card-company">— ${s.company}</span>` : ''}</div>` : ''}
        ${s.email ? `<div class="sp-card-email"><i class="bi bi-envelope"></i> ${s.email}</div>` : ''}
      </div>
      <div class="sp-card-events">${eventsHtml}</div>
      <div class="sp-card-footer">
        <div class="sp-card-socials">${socialsHtml || '<span style="font-size:.72rem;color:var(--dj-muted)">—</span>'}</div>
        <div style="display:flex;gap:.35rem">
          <button class="btn-dj ghost sm" title="Voir profil" onclick="viewSpeaker('${s.id}')"><i class="bi bi-eye"></i></button>
          <button class="btn-dj ghost sm" title="Modifier" onclick="openEditSpeakerModal('${s.id}')"><i class="bi bi-pencil"></i></button>
          <button class="btn-dj danger sm" title="Supprimer" onclick="deleteSpeaker('${s.id}','${(s.name||'').replace(/'/g,"\\'")}')"><i class="bi bi-trash"></i></button>
        </div>
      </div>
    </div>`;
  }).join('');

  renderPagination('speakersPagination', data.meta, loadSpeakers);
}

function openCreateSpeakerModal() {
  document.getElementById('formCreateSpeaker').reset();
  document.getElementById('newSpPreview').style.display = 'none';
  openModal('modalCreateSpeaker');
}

async function openEditSpeakerModal(id) {
  openModal('modalEditSpeaker');
  document.getElementById('editSpId').value = id;
  const data = await apiFetch(`/api/admin/speakers/${id}`);
  if (!data?.success) { toast('Impossible de charger le speaker', 'error'); return; }
  const s = data.data;
  const sl = s.social_links || {};
  document.getElementById('editSpName').value     = s.name || '';
  document.getElementById('editSpJobTitle').value = s.job_title || '';
  document.getElementById('editSpCompany').value  = s.company || '';
  document.getElementById('editSpEmail').value    = s.email || '';
  document.getElementById('editSpPhone').value    = s.phone || '';
  document.getElementById('editSpBio').value      = s.bio || '';
  document.getElementById('editSpActive').value   = s.is_active ? '1' : '0';
  document.getElementById('editSpTwitter').value  = sl.twitter || '';
  document.getElementById('editSpLinkedin').value = sl.linkedin || '';
  document.getElementById('editSpInstagram').value= sl.instagram || '';
  document.getElementById('editSpWebsite').value  = sl.website || '';
  document.getElementById('editSpPreview').style.display = 'none';
  document.getElementById('editSpPhoto').value = '';
  const photoWrap = document.getElementById('editSpCurrentPhoto');
  if (s.photo) {
    photoWrap.style.display = 'block';
    document.getElementById('editSpCurrentPhotoImg').src = s.photo;
  } else { photoWrap.style.display = 'none'; }
}

function buildSocialLinks(prefix) {
  const sl = {};
  const t = document.getElementById(`${prefix}Twitter`)?.value?.trim();
  const l = document.getElementById(`${prefix}Linkedin`)?.value?.trim();
  const i = document.getElementById(`${prefix}Instagram`)?.value?.trim();
  const w = document.getElementById(`${prefix}Website`)?.value?.trim();
  if (t) sl.twitter   = t;
  if (l) sl.linkedin  = l;
  if (i) sl.instagram = i;
  if (w) sl.website   = w;
  return sl;
}

document.getElementById('formCreateSpeaker').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btnCreateSpeaker');
  setBtnLoading(btn, true);
  const fd = new FormData();
  fd.append('name',         document.getElementById('newSpName').value);
  fd.append('job_title',    document.getElementById('newSpJobTitle').value);
  fd.append('company',      document.getElementById('newSpCompany').value);
  fd.append('email',        document.getElementById('newSpEmail').value);
  fd.append('phone',        document.getElementById('newSpPhone').value);
  fd.append('bio',          document.getElementById('newSpBio').value);
  fd.append('is_active',    document.getElementById('newSpActive').value);
  fd.append('social_links', JSON.stringify(buildSocialLinks('newSp')));
  const photoFile = document.getElementById('newSpPhoto').files[0];
  if (photoFile) fd.append('photo', photoFile);

  const data = await apiFetch('/api/admin/speakers', { method: 'POST', body: fd, isFormData: true });
  setBtnLoading(btn, false);
  if (data?.success) {
    toast('Speaker créé avec succès', 'success');
    closeModal('modalCreateSpeaker');
    loadSpeakers(_spPage);
  } else toast(data?.message || 'Erreur lors de la création', 'error');
});

document.getElementById('formEditSpeaker').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btnEditSpeaker');
  setBtnLoading(btn, true);
  const id = document.getElementById('editSpId').value;
  const fd = new FormData();
  fd.append('name',         document.getElementById('editSpName').value);
  fd.append('job_title',    document.getElementById('editSpJobTitle').value);
  fd.append('company',      document.getElementById('editSpCompany').value);
  fd.append('email',        document.getElementById('editSpEmail').value);
  fd.append('phone',        document.getElementById('editSpPhone').value);
  fd.append('bio',          document.getElementById('editSpBio').value);
  fd.append('is_active',    document.getElementById('editSpActive').value);
  fd.append('social_links', JSON.stringify(buildSocialLinks('editSp')));
  const photoFile = document.getElementById('editSpPhoto').files[0];
  if (photoFile) fd.append('photo', photoFile);

  const data = await apiFetch(`/api/admin/speakers/${id}`, { method: 'PUT', body: fd, isFormData: true });
  setBtnLoading(btn, false);
  if (data?.success) {
    toast('Speaker mis à jour', 'success');
    closeModal('modalEditSpeaker');
    loadSpeakers(_spPage);
  } else toast(data?.message || 'Erreur', 'error');
});

async function deleteSpeaker(id, name) {
  if (!confirm(`Supprimer le speaker "${name}" ?\nIl sera retiré de toutes les sessions.`)) return;
  const data = await apiFetch(`/api/admin/speakers/${id}`, { method: 'DELETE' });
  if (data?.success) { toast('Speaker supprimé', 'success'); loadSpeakers(_spPage); }
  else toast(data?.message || 'Erreur', 'error');
}

/* ══════════════════════ AGENDA ══════════════════════ */
let _agendaEventId    = null;
let _agendaEventTitle = null;
let _allSpeakers      = [];  // cache pour le picker

async function openAgendaModal(eventId, eventTitle) {
  _agendaEventId    = eventId;
  _agendaEventTitle = eventTitle;
  document.getElementById('agendaEventTitle').textContent = eventTitle;
  openModal('modalAgenda');
  await loadAgenda();
}

async function loadAgenda() {
  const container = document.getElementById('agendaSessionsList');
  const countEl   = document.getElementById('agendaSessionCount');
  container.innerHTML = `<div class="empty-state"><i class="bi bi-hourglass-split"></i>Chargement…</div>`;

  const data = await apiFetch(`/api/admin/events/${_agendaEventId}/sessions`);
  if (!data?.success) {
    container.innerHTML = `<div class="empty-state" style="color:#f87171"><i class="bi bi-exclamation-triangle"></i>Erreur de chargement</div>`;
    return;
  }

  const sessions = data.data;
  countEl.textContent = `${sessions.length} session(s)`;

  if (!sessions.length) {
    container.innerHTML = `<div class="empty-state"><i class="bi bi-calendar3"></i>Aucune session — ajoutez-en une !</div>`;
    return;
  }

  const typeLabels = { keynote:'Keynote', conference:'Conférence', workshop:'Atelier', panel:'Table ronde', networking:'Networking', break:'Pause', other:'Autre' };

  container.innerHTML = sessions.map(s => {
    const start = s.start_time ? new Date(s.start_time) : null;
    const end   = s.end_time   ? new Date(s.end_time)   : null;
    const timeStr = start
      ? `${start.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}${end ? ' – '+end.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : ''}`
      : '—';
    const dateStr = start ? start.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'}) : '';

    const speakersHtml = (s.speakers||[]).map(sp =>
      `<span class="session-speaker-chip">${sp.photo ? `<img src="${sp.photo}" alt="${sp.name}">` : `<span style="width:20px;height:20px;border-radius:50%;background:var(--dj-surface2);display:inline-flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:700">${avatar(sp.name)}</span>`}${sp.name}${sp.role && sp.role !== 'speaker' ? ` <em style="color:var(--dj-muted)">(${sp.role})</em>` : ''}</span>`
    ).join('');

    return `
    <div class="session-card">
      <div class="session-time">
        <strong>${timeStr}</strong>
        ${dateStr}
      </div>
      <div class="session-body">
        <div class="session-title">
          <span class="sess-type ${s.type}">${typeLabels[s.type]||s.type}</span>
          ${s.is_visible ? '' : '<span class="badge" style="background:rgba(239,68,68,.1);color:#f87171;font-size:.7rem">Masquée</span>'}
          <span style="margin-left:.4rem">${s.title}</span>
        </div>
        <div class="session-meta">
          ${s.room ? `<span><i class="bi bi-geo-alt"></i>${s.room}</span>` : ''}
          ${s.capacity ? `<span><i class="bi bi-people"></i>${s.registered||0}/${s.capacity}</span>` : (s.registered ? `<span><i class="bi bi-people"></i>${s.registered} inscrits</span>` : '')}
          ${s.access_conditions ? `<span title="${s.access_conditions}"><i class="bi bi-lock"></i>Conditions d'accès</span>` : ''}
        </div>
        ${s.description ? `<div style="font-size:.8rem;color:var(--dj-muted);margin-bottom:.35rem;max-width:500px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.description}</div>` : ''}
        ${speakersHtml ? `<div class="session-speakers">${speakersHtml}</div>` : ''}
      </div>
      <div class="session-actions">
        <button class="btn-dj ghost sm" title="Modifier" onclick="openEditSessionModal('${s.id}')"><i class="bi bi-pencil"></i></button>
        <button class="btn-dj danger sm" title="Supprimer" onclick="deleteSession('${s.id}','${(s.title||'').replace(/'/g,"\\'")}')"><i class="bi bi-trash"></i></button>
      </div>
    </div>`;
  }).join('');
}

async function loadSpeakerPickerInto(containerId, selectedIds = []) {
  // On charge les speakers de l'organisateur, on met à jour le cache
  if (!_allSpeakers.length) {
    const data = await apiFetch('/api/admin/speakers?limit=200');
    _allSpeakers = data?.data || [];
  }
  const container = document.getElementById(containerId);
  if (!_allSpeakers.length) {
    container.innerHTML = `<div style="color:var(--dj-muted);font-size:.82rem;padding:.5rem">Aucun speaker disponible. Créez-en d'abord dans la section Speakers.</div>`;
    return;
  }
  container.innerHTML = _allSpeakers.map(sp => {
    const checked   = selectedIds.includes(sp.id) ? 'checked' : '';
    const photoHtml = sp.photo ? `<img src="${sp.photo}" style="width:24px;height:24px;border-radius:50%;object-fit:cover">` : `<div class="sp-avatar" style="width:24px;height:24px;font-size:.65rem">${avatar(sp.name)}</div>`;
    return `
    <label class="speaker-pick-item">
      <input type="checkbox" name="sp_pick" value="${sp.id}" data-role="speaker" ${checked}>
      ${photoHtml}
      <span style="font-size:.82rem"><strong>${sp.name}</strong>${sp.job_title ? ` <span style="color:var(--dj-muted)">— ${sp.job_title}</span>` : ''}</span>
      <span class="sp-pick-role">
        <select onchange="this.closest('label').querySelector('input').dataset.role=this.value">
          <option value="speaker">Speaker</option>
          <option value="moderator">Modérateur</option>
          <option value="panelist">Panéliste</option>
          <option value="facilitator">Facilitateur</option>
        </select>
      </span>
    </label>`;
  }).join('');
  // Remettre les rôles existants si édition
}

function toggleQuickSpeaker(formId) {
  const el = document.getElementById(formId);
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

async function quickAddSpeaker(pickerId, nameId, titleId, companyId, formId) {
  const name = document.getElementById(nameId).value.trim();
  if (!name) { toast('Le nom du speaker est requis', 'error'); return; }
  const fd = new FormData();
  fd.append('name', name);
  const title   = document.getElementById(titleId).value.trim();
  const company = document.getElementById(companyId).value.trim();
  if (title)   fd.append('job_title', title);
  if (company) fd.append('company', company);

  const data = await apiFetch('/api/admin/speakers', { method: 'POST', body: fd });
  if (!data?.success) { toast(data?.message || 'Erreur lors de la création', 'error'); return; }

  const sp = data.data;
  // Ajouter au cache global
  _allSpeakers.push(sp);
  // Récupérer les sélections actuelles avant de re-rendre
  const currentChecked = Array.from(document.querySelectorAll(`#${pickerId} input[type=checkbox]:checked`)).map(i => i.value);
  // Re-rendre le picker avec le nouveau speaker sélectionné
  await loadSpeakerPickerInto(pickerId, [...currentChecked, sp.id]);
  // Vider et fermer le mini-form
  document.getElementById(nameId).value    = '';
  document.getElementById(titleId).value   = '';
  document.getElementById(companyId).value = '';
  document.getElementById(formId).style.display = 'none';
  toast(`${sp.name} ajouté et sélectionné`, 'success');
}

function getPickedSpeakers(containerId) {
  const checks = document.querySelectorAll(`#${containerId} input[type=checkbox]:checked`);
  return Array.from(checks).map(c => ({ speaker_id: c.value, role: c.dataset.role || 'speaker' }));
}

function openCreateSessionModal() {
  document.getElementById('formCreateSession').reset();
  _allSpeakers = []; // forcer le rechargement
  loadSpeakerPickerInto('newSessSpeakerPicker', []);
  openModal('modalCreateSession');
}

async function openEditSessionModal(id) {
  openModal('modalEditSession');
  document.getElementById('editSessId').value = id;
  const data = await apiFetch(`/api/admin/sessions/${id}`);
  if (!data?.success) { toast('Impossible de charger la session', 'error'); return; }
  const s = data.data;
  document.getElementById('editSessTitle').value    = s.title || '';
  document.getElementById('editSessType').value     = s.type  || 'conference';
  document.getElementById('editSessRoom').value     = s.room  || '';
  document.getElementById('editSessStart').value    = toDatetimeLocal(s.start_time);
  document.getElementById('editSessEnd').value      = toDatetimeLocal(s.end_time);
  document.getElementById('editSessCapacity').value = s.capacity || '';
  document.getElementById('editSessOrder').value    = s.order_index ?? 0;
  document.getElementById('editSessVisible').value  = s.is_visible ? '1' : '0';
  document.getElementById('editSessDesc').value     = s.description || '';
  document.getElementById('editSessAccess').value   = s.access_conditions || '';

  const selectedIds = (s.speakers || []).map(sp => sp.id);
  _allSpeakers = []; // forcer rechargement
  await loadSpeakerPickerInto('editSessSpeakerPicker', selectedIds);

  // Remettre les rôles sélectionnés
  (s.speakers || []).forEach(sp => {
    const input = document.querySelector(`#editSessSpeakerPicker input[value="${sp.id}"]`);
    if (input) {
      const sel = input.closest('label').querySelector('select');
      if (sel) sel.value = sp.role || 'speaker';
      input.dataset.role = sp.role || 'speaker';
    }
  });
}

document.getElementById('formCreateSession').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btnCreateSession');
  setBtnLoading(btn, true);
  const body = {
    title:             document.getElementById('newSessTitle').value,
    type:              document.getElementById('newSessType').value,
    room:              document.getElementById('newSessRoom').value,
    start_time:        document.getElementById('newSessStart').value,
    end_time:          document.getElementById('newSessEnd').value || null,
    capacity:          document.getElementById('newSessCapacity').value || null,
    order_index:       parseInt(document.getElementById('newSessOrder').value) || 0,
    is_visible:        parseInt(document.getElementById('newSessVisible').value),
    description:       document.getElementById('newSessDesc').value,
    access_conditions: document.getElementById('newSessAccess').value,
    speakers:          getPickedSpeakers('newSessSpeakerPicker'),
  };
  const data = await apiFetch(`/api/admin/events/${_agendaEventId}/sessions`, { method: 'POST', body: JSON.stringify(body) });
  setBtnLoading(btn, false);
  if (data?.success) {
    toast('Session créée', 'success');
    closeModal('modalCreateSession');
    loadAgenda();
  } else toast(data?.message || 'Erreur', 'error');
});

document.getElementById('formEditSession').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btnEditSession');
  setBtnLoading(btn, true);
  const id = document.getElementById('editSessId').value;
  const body = {
    title:             document.getElementById('editSessTitle').value,
    type:              document.getElementById('editSessType').value,
    room:              document.getElementById('editSessRoom').value,
    start_time:        document.getElementById('editSessStart').value,
    end_time:          document.getElementById('editSessEnd').value || null,
    capacity:          document.getElementById('editSessCapacity').value || null,
    order_index:       parseInt(document.getElementById('editSessOrder').value) || 0,
    is_visible:        parseInt(document.getElementById('editSessVisible').value),
    description:       document.getElementById('editSessDesc').value,
    access_conditions: document.getElementById('editSessAccess').value,
    speakers:          getPickedSpeakers('editSessSpeakerPicker'),
  };
  const data = await apiFetch(`/api/admin/sessions/${id}`, { method: 'PUT', body: JSON.stringify(body) });
  setBtnLoading(btn, false);
  if (data?.success) {
    toast('Session mise à jour', 'success');
    closeModal('modalEditSession');
    loadAgenda();
  } else toast(data?.message || 'Erreur', 'error');
});

async function deleteSession(id, title) {
  if (!confirm(`Supprimer la session "${title}" ?\nLes réservations associées seront perdues.`)) return;
  const data = await apiFetch(`/api/admin/sessions/${id}`, { method: 'DELETE' });
  if (data?.success) { toast('Session supprimée', 'success'); loadAgenda(); }
  else toast(data?.message || 'Erreur', 'error');
}

/* ── Logout ── */
document.getElementById('btnLogout').addEventListener('click', async () => {
  await apiFetch('/api/auth/logout', { method:'POST' });
  logout();
});

/* ── Start ── */
const VALID_SECTIONS = ['dashboard','organizers','users','events','tickets','payments','scanlogs','categories','speakers'];
const savedSection = localStorage.getItem('djhina_admin_section');
navigate(VALID_SECTIONS.includes(savedSection) ? savedSection : 'dashboard');

/* ── Auto-hide admin-only items for organizer ── */
if (ME.role !== 'admin') {
  document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
}
