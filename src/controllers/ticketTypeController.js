const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');

// helper — vérifier propriété de l'événement
async function assertOwner(req, res) {
  const [[event]] = await pool.execute(
    'SELECT id, organizer_id FROM events WHERE id = ?', [req.params.eventId]
  );
  if (!event) { res.status(404).json({ success: false, message: 'Événement introuvable.' }); return null; }
  if (req.user.role !== 'admin' && event.organizer_id !== req.user.id) {
    res.status(403).json({ success: false, message: 'Accès refusé.' }); return null;
  }
  return event;
}

// ── GET /api/events/:eventId/ticket-types ────────────────────
exports.list = async (req, res) => {
  const [types] = await pool.execute(
    `SELECT tt.*,
       (SELECT COUNT(*) FROM tickets t WHERE t.ticket_type_id = tt.id AND t.status != 'cancelled') AS tickets_sold_count
     FROM ticket_types tt
     WHERE tt.event_id = ?
     ORDER BY tt.price ASC`,
    [req.params.eventId]
  );
  return res.json({ success: true, data: types });
};

// ── GET /api/events/:eventId/ticket-types/:id ────────────────
exports.getOne = async (req, res) => {
  const [[tt]] = await pool.execute(
    'SELECT * FROM ticket_types WHERE id = ? AND event_id = ?',
    [req.params.id, req.params.eventId]
  );
  if (!tt) return res.status(404).json({ success: false, message: 'Type de billet introuvable.' });
  return res.json({ success: true, data: tt });
};

// ── POST /api/events/:eventId/ticket-types ───────────────────
exports.create = async (req, res) => {
  const event = await assertOwner(req, res);
  if (!event) return;

  const {
    name, description, price = 0, currency = 'XAF',
    quantity_available, benefits = [], color = '#0000FF',
    sale_start, sale_end,
  } = req.body;

  if (!name) return res.status(400).json({ success: false, message: 'Le nom est requis.' });

  const id = uuidv4();
  await pool.execute(
    `INSERT INTO ticket_types
       (id, event_id, name, description, price, currency, quantity_available, benefits, color, sale_start, sale_end)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, req.params.eventId, name, description || null,
      parseFloat(price), currency,
      parseInt(quantity_available) || 0,
      JSON.stringify(Array.isArray(benefits) ? benefits : []),
      color,
      sale_start || null, sale_end || null,
    ]
  );

  const [[created]] = await pool.execute('SELECT * FROM ticket_types WHERE id = ?', [id]);
  return res.status(201).json({ success: true, message: 'Type de billet créé.', data: created });
};

// ── PUT /api/events/:eventId/ticket-types/:id ────────────────
exports.update = async (req, res) => {
  const event = await assertOwner(req, res);
  if (!event) return;

  const [[tt]] = await pool.execute(
    'SELECT id FROM ticket_types WHERE id = ? AND event_id = ?',
    [req.params.id, req.params.eventId]
  );
  if (!tt) return res.status(404).json({ success: false, message: 'Type de billet introuvable.' });

  const {
    name, description, price, currency,
    quantity_available, benefits, color,
    sale_start, sale_end, is_active,
  } = req.body;

  const fields = [];
  const values = [];

  if (name !== undefined)               { fields.push('name = ?');               values.push(name); }
  if (description !== undefined)        { fields.push('description = ?');        values.push(description); }
  if (price !== undefined)              { fields.push('price = ?');               values.push(parseFloat(price)); }
  if (currency !== undefined)           { fields.push('currency = ?');            values.push(currency); }
  if (quantity_available !== undefined) { fields.push('quantity_available = ?');  values.push(parseInt(quantity_available)); }
  if (benefits !== undefined)           { fields.push('benefits = ?');            values.push(JSON.stringify(benefits)); }
  if (color !== undefined)              { fields.push('color = ?');               values.push(color); }
  if (sale_start !== undefined)         { fields.push('sale_start = ?');          values.push(sale_start); }
  if (sale_end !== undefined)           { fields.push('sale_end = ?');            values.push(sale_end); }
  if (is_active !== undefined)          { fields.push('is_active = ?');           values.push(is_active ? 1 : 0); }

  if (!fields.length) return res.status(400).json({ success: false, message: 'Aucun champ à modifier.' });

  values.push(req.params.id);
  await pool.execute(`UPDATE ticket_types SET ${fields.join(', ')} WHERE id = ?`, values);

  const [[updated]] = await pool.execute('SELECT * FROM ticket_types WHERE id = ?', [req.params.id]);
  return res.json({ success: true, message: 'Type de billet mis à jour.', data: updated });
};

// ── DELETE /api/events/:eventId/ticket-types/:id ─────────────
exports.remove = async (req, res) => {
  const event = await assertOwner(req, res);
  if (!event) return;

  const [[tt]] = await pool.execute(
    'SELECT id FROM ticket_types WHERE id = ? AND event_id = ?',
    [req.params.id, req.params.eventId]
  );
  if (!tt) return res.status(404).json({ success: false, message: 'Type de billet introuvable.' });

  // Vérifier s'il y a des tickets actifs
  const [[{ count }]] = await pool.execute(
    "SELECT COUNT(*) AS count FROM tickets WHERE ticket_type_id = ? AND status IN ('active','used')",
    [req.params.id]
  );
  if (count > 0) {
    return res.status(409).json({
      success: false,
      message: `Impossible de supprimer : ${count} billet(s) actif(s) associé(s). Désactivez-le à la place.`,
    });
  }

  await pool.execute('DELETE FROM ticket_types WHERE id = ?', [req.params.id]);
  return res.json({ success: true, message: 'Type de billet supprimé.' });
};

// ── PUT /api/events/:eventId/ticket-types/:id/toggle ─────────
exports.toggle = async (req, res) => {
  const event = await assertOwner(req, res);
  if (!event) return;

  const [[tt]] = await pool.execute(
    'SELECT id, is_active FROM ticket_types WHERE id = ? AND event_id = ?',
    [req.params.id, req.params.eventId]
  );
  if (!tt) return res.status(404).json({ success: false, message: 'Type de billet introuvable.' });

  const newVal = tt.is_active ? 0 : 1;
  await pool.execute('UPDATE ticket_types SET is_active = ? WHERE id = ?', [newVal, req.params.id]);
  return res.json({ success: true, data: { is_active: !!newVal } });
};
