const express = require('express');
const router = express.Router();
const Category = require('../models/category');
const Service = require('../models/service');

// GET /api/categories - Categorias ativas, com o número de serviços publicados.
router.get('/', async (req, res) => {
  try {
    const categorias = await Category.find({ ativa: true }).sort({ ordem: 1, nome: 1 }).lean();

    const contagens = await Service.aggregate([
      { $match: { ativo: true, categoriaId: { $ne: null } } },
      { $group: { _id: '$categoriaId', total: { $sum: 1 } } },
    ]);

    const porCategoria = new Map(contagens.map((c) => [String(c._id), c.total]));

    res.json(
      categorias.map((categoria) => ({
        ...categoria,
        totalServicos: porCategoria.get(String(categoria._id)) || 0,
      }))
    );
  } catch (error) {
    console.error('Erro ao listar categorias:', error.message);
    res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
});

module.exports = router;
