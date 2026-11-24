const express = require('express');
const router = express.Router();
const { requireAuth } = require('../config/firebase');
const Notification = require('../models/notification');

// GET /api/notificacoes - Últimos avisos do utilizador autenticado.
router.get('/', requireAuth, async (req, res) => {
  try {
    const itens = await Notification.find({ userId: req.user.uid })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    res.json(itens);
  } catch (error) {
    console.error('Erro ao listar notificações:', error.message);
    res.status(500).json({ error: 'Erro ao buscar notificações' });
  }
});

// PATCH /api/notificacoes/:id/lida - Marcar uma como lida.
router.patch('/:id/lida', requireAuth, async (req, res) => {
  try {
    const item = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.uid },
      { $set: { lida: true } },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Notificação não encontrada' });
    res.json(item);
  } catch (error) {
    console.error('Erro ao marcar notificação:', error.message);
    res.status(500).json({ error: 'Erro ao marcar notificação' });
  }
});

// POST /api/notificacoes/ler-todas - Marcar todas como lidas.
router.post('/ler-todas', requireAuth, async (req, res) => {
  try {
    const resultado = await Notification.updateMany({ userId: req.user.uid, lida: false }, { $set: { lida: true } });
    res.json({ alteradas: resultado.modifiedCount });
  } catch (error) {
    console.error('Erro ao marcar notificações:', error.message);
    res.status(500).json({ error: 'Erro ao marcar notificações' });
  }
});

module.exports = router;
