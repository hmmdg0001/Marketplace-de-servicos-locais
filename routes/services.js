const express = require('express');
const router = express.Router();
const { verifyIdToken } = require('../config/firebase');
const Service = require('../models/service');

// GET /api/services - Listar todos os serviços
router.get('/', async (req, res) => {
  try {
    const services = await Service.find().sort({ createdAt: -1 });
    res.json(services);
  } catch (error) {
    console.error('Erro ao listar serviços:', error.message);
    res.status(500).json({ error: 'Erro ao buscar serviços' });
  }
});

// POST /api/services - Criar novo serviço (protegido)
router.post('/', verifyIdToken, async (req, res) => {
  try {
    const { title, description, location } = req.body;
    const userId = req.user.uid; // do verifyIdToken middleware

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