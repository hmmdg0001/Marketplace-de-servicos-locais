const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { requireAuth } = require('../config/firebase');
const { requireAdmin } = require('../middleware/roles');
const User = require('../models/user');
const Service = require('../models/service');
const Category = require('../models/category');
const Order = require('../models/order');
const Review = require('../models/review');

// Todas as rotas deste ficheiro exigem sessão iniciada e papel de administrador.
router.use(requireAuth, requireAdmin);

function slugify(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// GET /api/admin/resumo - Números gerais do marketplace.
router.get('/resumo', async (req, res) => {
  try {
    const [utilizadores, servicos, servicosAtivos, pedidos, avaliacoes, categorias] = await Promise.all([
      User.countDocuments(),
      Service.countDocuments(),
      Service.countDocuments({ ativo: true }),
      Order.countDocuments(),
      Review.countDocuments(),
      Category.countDocuments(),
    ]);

    const porEstado = await Order.aggregate([
      { $group: { _id: '$estado', total: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      utilizadores,
      servicos,
      servicosAtivos,
      pedidos,
      avaliacoes,
      categorias,
      porEstado: Object.fromEntries(porEstado.map((e) => [e._id, e.total])),
    });
  } catch (error) {
    console.error('Erro no resumo admin:', error.message);
    res.status(500).json({ error: 'Erro ao buscar resumo' });
  }
});

// GET /api/admin/categorias - Todas, incluindo desativadas.
router.get('/categorias', async (req, res) => {
  try {
    const categorias = await Category.find({}).sort({ ordem: 1, nome: 1 }).lean();
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
    console.error('Erro ao listar categorias admin:', error.message);
    res.status(500).json({ error: 'Erro ao buscar categorias' });
  }
});

// POST /api/admin/categorias - Criar categoria.
router.post('/categorias', async (req, res) => {
  try {
    const nome = String(req.body?.nome ?? '').trim();
    const slug = slugify(req.body?.slug || nome);
    if (!nome) return res.status(400).json({ error: 'O nome é obrigatório' });
    if (!slug) return res.status(400).json({ error: 'O slug não pode ficar vazio' });

    if (await Category.findOne({ $or: [{ nome }, { slug }] })) {
      return res.status(400).json({ error: 'Já existe uma categoria com esse nome ou slug' });
    }

    const categoria = await Category.create({
      nome,
      slug,
      descricao: String(req.body?.descricao ?? '').trim(),
      icone: String(req.body?.icone ?? '•').trim() || '•',
      ordem: Number(req.body?.ordem ?? 0) || 0,
      ativa: req.body?.ativa !== false,
    });
    res.status(201).json(categoria);
  } catch (error) {
    console.error('Erro ao criar categoria:', error.message);
    res.status(500).json({ error: 'Erro ao criar categoria' });
  }
});

// PUT /api/admin/categorias/:id - Editar categoria (inclui ativar/desativar).
router.put('/categorias/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }

    const atualizacoes = {};
    if (req.body?.nome !== undefined) {
      const nome = String(req.body.nome).trim();
      if (!nome) return res.status(400).json({ error: 'O nome não pode ficar vazio' });
      atualizacoes.nome = nome;
    }
    if (req.body?.slug !== undefined) {
      const slug = slugify(req.body.slug);
      if (!slug) return res.status(400).json({ error: 'O slug não pode ficar vazio' });
      atualizacoes.slug = slug;
    }
    if (req.body?.descricao !== undefined) atualizacoes.descricao = String(req.body.descricao).trim();
    if (req.body?.icone !== undefined) atualizacoes.icone = String(req.body.icone).trim() || '•';
    if (req.body?.ordem !== undefined) atualizacoes.ordem = Number(req.body.ordem) || 0;
    if (req.body?.ativa !== undefined) atualizacoes.ativa = Boolean(req.body.ativa);

    const conflito = await Category.findOne({
      _id: { $ne: req.params.id },
      $or: [
        ...(atualizacoes.nome ? [{ nome: atualizacoes.nome }] : []),
        ...(atualizacoes.slug ? [{ slug: atualizacoes.slug }] : []),
      ],
    });
    if (conflito) return res.status(400).json({ error: 'Já existe outra categoria com esse nome ou slug' });

    const categoria = await Category.findByIdAndUpdate(req.params.id, atualizacoes, {
      new: true,
      runValidators: true,
    });
    if (!categoria) return res.status(404).json({ error: 'Categoria não encontrada' });
    res.json(categoria);
  } catch (error) {
    console.error('Erro ao editar categoria:', error.message);
    res.status(500).json({ error: 'Erro ao editar categoria' });
  }
});

// DELETE /api/admin/categorias/:id - Apagar categoria sem serviços.
router.delete('/categorias/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Categoria não encontrada' });
    }
    const total = await Service.countDocuments({ categoriaId: req.params.id });
    if (total > 0) {
      return res.status(400).json({ error: 'Não é possível apagar uma categoria com serviços' });
    }
    const removida = await Category.findByIdAndDelete(req.params.id);
    if (!removida) return res.status(404).json({ error: 'Categoria não encontrada' });
    res.json({ message: 'Categoria apagada', id: removida._id });
  } catch (error) {
    console.error('Erro ao apagar categoria:', error.message);
    res.status(500).json({ error: 'Erro ao apagar categoria' });
  }
});

// GET /api/admin/servicos - Todos os anúncios, ativos ou não.
router.get('/servicos', async (req, res) => {
  try {
    const servicos = await Service.find({})
      .sort({ createdAt: -1 })
      .limit(300)
      .populate('categoriaId', 'nome icone')
      .lean();
    const uids = [...new Set(servicos.map((s) => s.prestadorId).filter(Boolean))];
    const utilizadores = await User.find({ uid: { $in: uids } }).select('uid name').lean();
    const nomePorUid = new Map(utilizadores.map((u) => [u.uid, u.name]));

    res.json(
      servicos.map((servico) => ({
        _id: servico._id,
        titulo: servico.titulo,
        zona: servico.zona,
        preco: servico.preco,
        ativo: servico.ativo,
        isSeed: Boolean(servico.isSeed),
        categoria: servico.categoriaId,
        prestadorUid: servico.prestadorId,
        prestadorNome: nomePorUid.get(servico.prestadorId) || 'Prestador',
      }))
    );
  } catch (error) {
    console.error('Erro ao listar serviços admin:', error.message);
    res.status(500).json({ error: 'Erro ao buscar serviços' });
  }
});

// PATCH /api/admin/servicos/:id/ativo - Ativar ou desativar um anúncio.
router.patch('/servicos/:id/ativo', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }
    const servico = await Service.findById(req.params.id);
    if (!servico) return res.status(404).json({ error: 'Serviço não encontrado' });

    servico.ativo = req.body?.ativo === undefined ? !servico.ativo : Boolean(req.body.ativo);
    await servico.save();
    res.json({ _id: servico._id, ativo: servico.ativo });
  } catch (error) {
    console.error('Erro ao alterar ativo do serviço:', error.message);
    res.status(500).json({ error: 'Erro ao alterar o serviço' });
  }
});

// GET /api/admin/pedidos - Todos os pedidos, para acompanhamento.
router.get('/pedidos', async (req, res) => {
  try {
    const pedidos = await Order.find({})
      .sort({ createdAt: -1 })
      .limit(300)
      .populate('servicoId', 'titulo')
      .lean();

    const uids = [...new Set(pedidos.flatMap((p) => [p.clienteId, p.prestadorId]).filter(Boolean))];
    const utilizadores = await User.find({ uid: { $in: uids } }).select('uid name').lean();
    const nomePorUid = new Map(utilizadores.map((u) => [u.uid, u.name]));

    res.json(
      pedidos.map((pedido) => ({
        _id: pedido._id,
        estado: pedido.estado,
        criadoEm: pedido.createdAt,
        servicoTitulo: pedido.servicoId?.titulo || 'Serviço',
        clienteNome: nomePorUid.get(pedido.clienteId) || 'Cliente',
        prestadorNome: nomePorUid.get(pedido.prestadorId) || 'Prestador',
      }))
    );
  } catch (error) {
    console.error('Erro ao listar pedidos admin:', error.message);
    res.status(500).json({ error: 'Erro ao buscar pedidos' });
  }
});

module.exports = router;
