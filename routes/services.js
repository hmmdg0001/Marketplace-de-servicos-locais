const express = require('express');
const router = express.Router();
const { requireAuth } = require('../config/firebase');
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

    const serviceDoc = await Service.create({
      title,
      description: description || '',
      location: location || '',
      userId,
    });

    res.status(201).json(serviceDoc);
  } catch (error) {
    console.error('Erro ao criar serviço:', error.message);
    res.status(500).json({ error: 'Erro ao criar serviço' });
  }
});

module.exports = router;