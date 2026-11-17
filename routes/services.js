const express = require('express');
const router = express.Router();
const { requireAuth } = require('../config/firebase');
const { requireAdminOrOwner } = require('../middleware/roles');
const Service = require('../models/service');

// GET /api/services - Listar serviços (opcionalmente filtrar por ?userId=)
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.userId) filter.userId = req.query.userId;

    const services = await Service.find(filter).sort({ createdAt: -1 });
    res.json(services);
  } catch (error) {
    console.error('Erro ao listar serviços:', error.message);
    res.status(500).json({ error: 'Erro ao buscar serviços' });
  }
});

// POST /api/services - Criar novo serviço (protegido)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { title, description, location } = req.body;
    const userId = req.user.uid;

    if (!title) return res.status(400).json({ error: 'Título obrigatório' });
    if (!location) return res.status(400).json({ error: 'Localização obrigatória' });

    const serviceDoc = await Service.create({
      title,
      description: description || '',
      location,
      userId,
    });

    res.status(201).json(serviceDoc);
  } catch (error) {
    console.error('Erro ao criar serviço:', error.message);
    res.status(500).json({ error: 'Erro ao criar serviço' });
  }
});

// DELETE /api/services/:id - Apagar serviço (dono ou admin)
router.delete(
  '/:id',
  requireAuth,
  requireAdminOrOwner(async (req) => {
    const service = await Service.findById(req.params.id).select('userId');
    return service?.userId || null;
  }),
  async (req, res) => {
    try {
      const deleted = await Service.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'Serviço não encontrado' });
      res.json({ message: 'Serviço apagado', id: deleted._id });
    } catch (error) {
      console.error('Erro ao apagar serviço:', error.message);
      res.status(500).json({ error: 'Erro ao apagar serviço' });
    }
  }
);

module.exports = router;
