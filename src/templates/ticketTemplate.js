/**
 * Génère le HTML complet d'un ticket Djhina.
 * @param {Object} t  — données du ticket (join event + ticket_type)
 */
module.exports = function renderTicket(t) {
  const fmtDate = (d) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  };
  const fmtTime = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    return dt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };
  const fmtPrice = (p, c) => {
    if (!p || p == 0) return 'Gratuit';
    return `${Number(p).toLocaleString('fr-FR')} ${c || 'XAF'}`;
  };
  const statusLabel = { active: 'VALIDE', used: 'UTILISÉ', expired: 'EXPIRÉ', cancelled: 'ANNULÉ' };
  const statusColor = { active: '#00D68F', used: '#8B5CF6', expired: '#F59E0B', cancelled: '#EF4444' };

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Billet — ${t.event_title} | Djhina</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #00071A;
      font-family: 'Inter', sans-serif;
      min-height: 100vh;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 1.5rem;
      color: #e2e8f0;
    }

    .page-header {
      text-align: center; margin-bottom: 1.5rem;
    }
    .page-header .logo {
      font-size: 1.5rem; font-weight: 900;
      letter-spacing: 3px; color: #fff;
    }
    .page-header .logo span { color: #0000FF; }
    .page-header p { color: #7ea3ff; font-size: .8rem; margin-top: .25rem; }

    /* ── Ticket wrapper ── */
    .ticket-wrapper {
      width: 100%; max-width: 640px;
      filter: drop-shadow(0 25px 50px rgba(0,0,255,.3));
    }

    /* ── Ticket principal ── */
    .ticket {
      background: linear-gradient(135deg, #000F30 0%, #001247 50%, #000F30 100%);
      border: 1px solid rgba(0,0,255,.35);
      border-radius: 20px;
      overflow: hidden;
      position: relative;
    }

    /* Ligne déco bleue en haut */
    .ticket::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0; height: 4px;
      background: linear-gradient(90deg, #0000FF, #4D6FFF, #0000FF);
    }

    /* ── Event banner ── */
    .event-banner {
      position: relative;
      background: linear-gradient(135deg, #0000AA 0%, #000080 100%);
      padding: 1.5rem 1.75rem 1.25rem;
      display: flex; align-items: flex-start; gap: 1rem;
    }
    .event-banner::after {
      content: '';
      position: absolute; bottom: 0; left: 0; right: 0; height: 60px;
      background: linear-gradient(to bottom, transparent, #000F30);
    }
    .event-category {
      display: inline-flex; align-items: center; gap: .35rem;
      background: rgba(255,255,255,.15); backdrop-filter: blur(10px);
      color: #fff; font-size: .7rem; font-weight: 700;
      letter-spacing: 1.5px; text-transform: uppercase;
      padding: .3rem .75rem; border-radius: 20px;
      border: 1px solid rgba(255,255,255,.2);
      margin-bottom: .6rem; display: inline-block;
    }
    .event-title {
      font-size: 1.5rem; font-weight: 900;
      color: #fff; line-height: 1.2;
      text-shadow: 0 2px 10px rgba(0,0,0,.3);
    }
    .event-meta {
      display: flex; flex-wrap: wrap; gap: .5rem;
      margin-top: .75rem;
    }
    .meta-chip {
      display: inline-flex; align-items: center; gap: .35rem;
      background: rgba(0,0,0,.25); backdrop-filter: blur(8px);
      color: #c7d8ff; font-size: .75rem;
      padding: .3rem .7rem; border-radius: 20px;
      border: 1px solid rgba(255,255,255,.1);
    }
    .meta-chip svg { width: 14px; height: 14px; flex-shrink: 0; }

    /* ── Séparateur perforé ── */
    .perforation {
      display: flex; align-items: center;
      background: #00071A;
      padding: 0 .75rem;
    }
    .perf-line {
      flex: 1; border-top: 2px dashed rgba(0,0,255,.35);
    }
    .perf-circle {
      width: 28px; height: 28px; border-radius: 50%;
      background: #00071A; border: 2px dashed rgba(0,0,255,.35);
      flex-shrink: 0; margin: 0 .4rem;
      display: flex; align-items: center; justify-content: center;
      font-size: .65rem; color: #4D6FFF; font-weight: 700;
    }

    /* ── Corps du ticket ── */
    .ticket-body {
      padding: 1.25rem 1.75rem 1.5rem;
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 1.5rem;
      align-items: start;
    }

    /* ── Infos bénéficiaire ── */
    .ticket-fields { display: flex; flex-direction: column; gap: .85rem; }
    .field-row { display: grid; grid-template-columns: 1fr 1fr; gap: .75rem; }
    .field { display: flex; flex-direction: column; gap: .2rem; }
    .field .label {
      font-size: .65rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 1.5px;
      color: #4D6FFF;
    }
    .field .value {
      font-size: .88rem; font-weight: 600; color: #fff;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .field .value.mono {
      font-family: 'Space Mono', monospace;
      font-size: .78rem; color: #a5c0ff;
    }
    .field .value.price {
      font-size: 1.1rem; font-weight: 800; color: #00D68F;
    }
    .field .value.price.free { color: #34d399; }

    /* Statut badge */
    .status-badge {
      display: inline-flex; align-items: center; gap: .4rem;
      padding: .35rem .9rem; border-radius: 20px;
      font-size: .72rem; font-weight: 800;
      letter-spacing: 1.5px; text-transform: uppercase;
      border: 2px solid;
      margin-top: .25rem; align-self: flex-start;
    }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }

    /* ── QR code ── */
    .qr-section {
      display: flex; flex-direction: column; align-items: center; gap: .6rem;
      flex-shrink: 0;
    }
    .qr-frame {
      background: #fff; border-radius: 12px;
      padding: .6rem; width: 130px; height: 130px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 8px 24px rgba(0,0,255,.3);
    }
    .qr-frame img { width: 118px; height: 118px; display: block; }
    .qr-label {
      font-size: .65rem; font-weight: 700;
      text-transform: uppercase; letter-spacing: 1px;
      color: #4D6FFF; text-align: center;
    }
    .qr-note {
      font-size: .6rem; color: #7ea3ff; text-align: center;
      max-width: 130px; line-height: 1.4;
    }

    /* ── Footer ticket ── */
    .ticket-footer {
      border-top: 1px solid rgba(0,0,255,.2);
      padding: .85rem 1.75rem;
      display: flex; align-items: center; justify-content: space-between;
      gap: 1rem;
    }
    .ticket-number {
      font-family: 'Space Mono', monospace;
      font-size: .7rem; color: #7ea3ff; letter-spacing: 2px;
    }
    .ticket-branding {
      font-size: .72rem; font-weight: 700;
      color: #4D6FFF; letter-spacing: 2px;
    }
    .ticket-branding span { color: #fff; }

    /* ── Actions ── */
    .actions {
      display: flex; gap: .75rem; margin-top: 1.25rem;
      justify-content: center; flex-wrap: wrap;
    }
    .btn-action {
      display: inline-flex; align-items: center; gap: .5rem;
      padding: .65rem 1.4rem; border-radius: 10px;
      font-size: .82rem; font-weight: 600; cursor: pointer;
      border: none; text-decoration: none; transition: all .2s;
    }
    .btn-primary { background: #0000FF; color: #fff; }
    .btn-primary:hover { background: #0000CC; transform: translateY(-1px); }
    .btn-ghost   { background: rgba(0,0,255,.1); color: #7ea3ff; border: 1px solid rgba(0,0,255,.3); }
    .btn-ghost:hover { background: rgba(0,0,255,.2); }

    /* ── Watermark used/cancelled ── */
    .watermark {
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%,-50%) rotate(-30deg);
      font-size: 4.5rem; font-weight: 900;
      opacity: .06; pointer-events: none;
      white-space: nowrap; color: #fff;
      text-transform: uppercase; letter-spacing: 8px;
    }

    /* ── Responsive ── */
    @media (max-width: 520px) {
      .ticket-body { grid-template-columns: 1fr; }
      .qr-section { flex-direction: row; align-items: center; gap: 1rem; }
      .qr-frame { width: 100px; height: 100px; }
      .qr-frame img { width: 88px; height: 88px; }
      .field-row { grid-template-columns: 1fr; }
      .event-title { font-size: 1.2rem; }
    }

    /* ── Print ── */
    @media print {
      body { background: #fff; padding: 0; }
      .ticket { border: 2px solid #0000FF; }
      .actions { display: none; }
      .page-header p { display: none; }
    }
  </style>
</head>
<body>

  <div class="page-header">
    <div class="logo"><span>Djhina</span> — Billet Électronique</div>
    <p>Présentez ce billet à l'entrée de l'événement</p>
  </div>

  <div class="ticket-wrapper">
    <div class="ticket">

      ${t.status !== 'active' ? `<div class="watermark">${statusLabel[t.status] || t.status}</div>` : ''}

      <!-- ── BANNER ── -->
      <div class="event-banner">
        <div style="flex:1;position:relative;z-index:1">
          <div class="event-category">🎭 ${t.category_label || t.ticket_type_name || 'Événement'}</div>
          <h1 class="event-title">${t.event_title}</h1>
          <div class="event-meta">
            <span class="meta-chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              ${fmtDate(t.event_date)}
            </span>
            ${t.event_time ? `
            <span class="meta-chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              ${t.event_time}
            </span>` : ''}
            ${t.event_location ? `
            <span class="meta-chip">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${t.event_location}${t.event_city ? ', ' + t.event_city : ''}
            </span>` : ''}
          </div>
        </div>
      </div>

      <!-- ── PERFORATION ── -->
      <div class="perforation">
        <div class="perf-circle"></div>
        <div class="perf-line"></div>
        <div class="perf-circle">✂</div>
        <div class="perf-line"></div>
        <div class="perf-circle"></div>
      </div>

      <!-- ── CORPS ── -->
      <div class="ticket-body">

        <!-- Infos bénéficiaire + ticket -->
        <div class="ticket-fields">

          <div class="field-row">
            <div class="field">
              <span class="label">Nom du titulaire</span>
              <span class="value">${t.holder_name}</span>
            </div>
            <div class="field">
              <span class="label">Type de billet</span>
              <span class="value">${t.ticket_type_name || '—'}</span>
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <span class="label">Email</span>
              <span class="value" style="font-size:.78rem">${t.holder_email || '—'}</span>
            </div>
            <div class="field">
              <span class="label">Téléphone</span>
              <span class="value">${t.holder_phone || '—'}</span>
            </div>
          </div>

          <div class="field-row">
            <div class="field">
              <span class="label">Montant payé</span>
              <span class="value price ${!t.price_paid || t.price_paid == 0 ? 'free' : ''}">${fmtPrice(t.price_paid, t.currency)}</span>
            </div>
            ${t.seat_number ? `
            <div class="field">
              <span class="label">Siège / Place</span>
              <span class="value mono">${t.seat_number}</span>
            </div>` : `
            <div class="field">
              <span class="label">Date d'achat</span>
              <span class="value" style="font-size:.78rem">${fmtDate(t.created_at)}</span>
            </div>`}
          </div>

          <div class="field">
            <span class="label">Statut</span>
            <span class="status-badge" style="color:${statusColor[t.status] || '#7ea3ff'};border-color:${statusColor[t.status] || '#7ea3ff'}22;background:${statusColor[t.status] || '#7ea3ff'}15">
              <span class="status-dot"></span>
              ${statusLabel[t.status] || t.status}
            </span>
          </div>

        </div>

        <!-- QR Code -->
        <div class="qr-section">
          <div class="qr-frame">
            ${t.qr_image
              ? `<img src="${t.qr_image}" alt="QR Code">`
              : `<svg viewBox="0 0 100 100" width="100" height="100">
                  <text x="50" y="55" text-anchor="middle" font-size="10" fill="#0000FF">QR indisponible</text>
                </svg>`
            }
          </div>
          <div class="qr-label">Scanner à l'entrée</div>
          <div class="qr-note">Présenter à l'agent de contrôle d'accès</div>
        </div>

      </div>

      <!-- ── FOOTER ── -->
      <div class="ticket-footer">
        <span class="ticket-number">N° ${t.ticket_number}</span>
        <span class="ticket-branding"><span>Djhina</span> · Tchad 🇹🇩</span>
      </div>

    </div><!-- /.ticket -->

    <!-- Actions -->
    <div class="actions">
      <button class="btn-action btn-primary" onclick="window.print()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
        Imprimer / Sauvegarder PDF
      </button>
      <button class="btn-action btn-ghost" onclick="shareTicket()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
        Partager
      </button>
    </div>

  </div><!-- /.ticket-wrapper -->

  <div style="text-align:center;margin-top:1.5rem;font-size:.72rem;color:#4a6fa5">
    Ce billet est personnel et non-transférable · Djhina © ${new Date().getFullYear()}
  </div>

  <script>
    function shareTicket() {
      if (navigator.share) {
        navigator.share({
          title: 'Mon billet — ${t.event_title}',
          text:  'Billet Djhina : ${t.ticket_number}',
          url:   window.location.href,
        });
      } else {
        navigator.clipboard.writeText(window.location.href);
        alert('Lien copié dans le presse-papier !');
      }
    }
  </script>
</body>
</html>`;
};
