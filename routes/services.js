const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { requireAuth } = require('../config/firebase');
const { requireAdminOrOwner } = require('../middleware/roles');
const Service = require('../models/service');
const Category = require('../models/category');
const ProviderProfile = require('../models/providerProfile');
const Review = require('../models/review');
const User = require('../models/user');

const MAX_LIMIT = 48;

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function numero(valor, fallback = 0) {
  const parsed = Number(valor);
  return Number.isFinite(parsed) ? parsed : fallback;
}

// Junta a categoria e o prestador a cada serviço, para o frontend não ter
// de fazer pedidos extra por cada cartão.
async function comPrestador(servicos) {
  const uids = [...new Set(servicos.map((s) => s.prestadorId).filter(Boolean))];

  const [perfis, utilizadores] = await Promise.all([
    ProviderProfile.find({ userId: { $in: uids } }).lean(),
    User.find({ uid: { $in: uids } }).select('uid name isDemo').lean(),
  ]);

  const perfilPorUid = new Map(perfis.map((p) => [p.userId, p]));
  const nomePorUid = new Map(utilizadores.map((u) => [u.uid, u.name]));

  return servicos.map((servico) => {
    const categoria = servico.categoriaId && typeof servico.categoriaId === 'object'
      ? servico.categoriaId
      : null;
    const perfil = perfilPorUid.get(servico.prestadorId);

    return {
      ...servico,
      categoriaId: categoria?._id || servico.categoriaId || null,
      categoria,
      prestador: {
        uid: servico.prestadorId,
        nome: nomePorUid.get(servico.prestadorId) || 'Prestador',
        zona: perfil?.zona || servico.zona || '',
        bio: perfil?.bio || '',
        mediaAvaliacoes: perfil?.mediaAvaliacoes || 0,
        totalAvaliacoes: perfil?.totalAvaliacoes || 0,
      },
    };
  });
}

async function resolverCategoria(valor) {
  if (!valor) return null;

  if (mongoose.isValidObjectId(valor)) {
    return Category.findById(valor);
  }

  return Category.findOne({ slug: String(valor).toLowerCase() });
}

// GET /api/services
// - Com ?page= devolve { items, page, pages, total, limit } (catálogo).
// - Sem ?page= devolve um array (compatível com "os meus serviços").
// Filtros: q, categoria (slug ou id), zona, precoMax, userId, ativo, sort
router.get('/', async (req, res) => {
  try {
    const paginado = req.query.page !== undefined || req.query.limit !== undefined;
    const filter = {};

    if (req.query.userId) {
      filter.prestadorId = req.query.userId;
      if (req.query.ativo === 'true') filter.ativo = true;
      if (req.query.ativo === 'false') filter.ativo = false;
    } else {
      filter.ativo = true;
      filter.categoriaId = { $ne: null };

      if (req.query.prestadorId) filter.prestadorId = req.query.prestadorId;
    }

    if (req.query.categoria) {
      const categoria = await resolverCategoria(req.query.categoria);
      if (!categoria) return res.json(paginado ? { items: [], page: 1, pages: 0, total: 0, limit: 0 } : []);
      filter.categoriaId = categoria._id;
    }

    if (req.query.zona) {
      filter.zona = new RegExp(`^${escapeRegex(req.query.zona)}$`, 'i');
    }

    if (req.query.q) {
      const termo = new RegExp(escapeRegex(req.query.q), 'i');
      filter.$or = [{ titulo: termo }, { descricao: termo }];
    }

    if (req.query.precoMax !== undefined && req.query.precoMax !== '') {
      filter.preco = { $lte: numero(req.query.precoMax) };
    }

    const ordenacao = req.query.sort === 'preco_asc'
      ? { preco: 1 }
      : req.query.sort === 'preco_desc'
        ? { preco: -1 }
        : { createdAt: -1 };

    if (!paginado) {
      const servicos = await Service.find(filter)
        .sort(ordenacao)
        .limit(200)
        .populate('categoriaId', 'nome slug icone')
        .lean();

      return res.json(await comPrestador(servicos));
    }

    const page = Math.max(1, Math.trunc(numero(req.query.page, 1)));
    const limit = Math.min(MAX_LIMIT, Math.max(1, Math.trunc(numero(req.query.limit, 12))));

    const [total, servicos] = await Promise.all([
      Service.countDocuments(filter),
      Service.find(filter)
        .sort(ordenacao)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('categoriaId', 'nome slug icone')
        .lean(),
    ]);

    res.json({
      items: await comPrestador(servicos),
      page,
      pages: Math.ceil(total / limit),
      total,
      limit,
    });
  } catch (error) {
    console.error('Erro ao listar serviços:', error.message);
    res.status(500).json({ error: 'Erro ao buscar serviços' });
  }
});

// GET /api/services/:id - Detalhe do serviço com categoria e prestador.
router.get('/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }

    const servico = await Service.findById(req.params.id)
      .populate('categoriaId', 'nome slug icone descricao')
      .lean();

    if (!servico) return res.status(404).json({ error: 'Serviço não encontrado' });

    const [detalhe] = await comPrestador([servico]);
    res.json(detalhe);
  } catch (error) {
    console.error('Erro ao buscar serviço:', error.message);
    res.status(500).json({ error: 'Erro ao buscar serviço' });
  }
});

// GET /api/services/:id/avaliacoes - Avaliações verificadas do serviço.
router.get('/:id/avaliacoes', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Serviço não encontrado' });
    }

    const servico = await Service.findById(req.params.id).select('_id').lean();
    if (!servico) return res.status(404).json({ error: 'Serviço não encontrado' });

    const avaliacoes = await Review.find({ servicoId: servico._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const clienteIds = [...new Set(avaliacoes.map((a) => a.clienteId))];
    const clientes = await User.find({ uid: { $in: clienteIds } }).select('uid name').lean();
    const nomePorUid = new Map(clientes.map((u) => [u.uid, u.name]));

    res.json(
      avaliacoes.map((avaliacao) => ({
        _id: avaliacao._id,
        classificacao: avaliacao.classificacao,
        comentario: avaliacao.comentario,
        createdAt: avaliacao.createdAt,
        cliente: {
          uid: avaliacao.clienteId,
          nome: nomePorUid.get(avaliacao.clienteId) || 'Cliente',
        },
      }))
    );
  } catch (error) {
    console.error('Erro ao listar avaliações:', error.message);
    res.status(500).json({ error: 'Erro ao buscar avaliações' });
  }
});

// POST /api/services - Publicar serviço.
// Publicar um serviço ativa automaticamente o perfil de prestador da conta.
router.post('/', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const titulo = String(body.titulo ?? body.title ?? '').trim();
    const descricao = String(body.descricao ?? body.description ?? '').trim();
    const zona = String(body.zona ?? body.location ?? '').trim();
    const preco = numero(body.preco ?? body.price, 0);

    if (!titulo) return res.status(400).json({ error: 'Título obrigatório' });
    if (!zona) return res.status(400).json({ error: 'Localização obrigatória' });
    if (preco < 0) return res.status(400).json({ error: 'O preço não pode ser negativo' });

    const categoria = await resolverCategoria(body.categoriaId ?? body.categoria);
    if ((body.categoriaId || body.categoria) && !categoria) {
      return res.status(400).json({ error: 'Categoria inválida' });
    }
    if (categoria && !categoria.ativa) {
      return res.status(400).json({ error: 'Essa categoria está desativada' });
    }

    await ProviderProfile.findOneAndUpdate(
      { userId: req.user.uid },
      { $setOnInsert: { bio: '', zona } },
      { upsert: true, setDefaultsOnInsert: true }
    );

    const servico = await Service.create({
      prestadorId: req.user.uid,
      categoriaId: categoria?._id || null,
      titulo,
      descricao,
      preco,
      zona,
      ativo: body.ativo !== false,
      imagens: Array.isArray(body.imagens) ? body.imagens.slice(0, 6) : [],
    });

    res.status(201).json(servico);
  } catch (error) {
    console.error('Erro ao criar serviço:', error.message);
    res.status(500).json({ error: 'Erro ao criar serviço' });
  }
});

// PUT /api/services/:id - Editar serviço (dono ou admin).
router.put(
  '/:id',
  requireAuth,
  requireAdminOrOwner(async (req) => {
    if (!mongoose.isValidObjectId(req.params.id)) return null;
    const servico = await Service.findById(req.params.id).select('prestadorId');
    return servico?.prestadorId || null;
  }),
  async (req, res) => {
    try {
      const body = req.body || {};
      const atualizacoes = {};

      if (body.titulo !== undefined || body.title !== undefined) {
        const titulo = String(body.titulo ?? body.title).trim();
        if (!titulo) return res.status(400).json({ error: 'Título obrigatório' });
        atualizacoes.titulo = titulo;
      }

      if (body.descricao !== undefined || body.description !== undefined) {
        atualizacoes.descricao = String(body.descricao ?? body.description).trim();
      }

      if (body.zona !== undefined || body.location !== undefined) {
        const zona = String(body.zona ?? body.location).trim();
        if (!zona) return res.status(400).json({ error: 'Localização obrigatória' });
        atualizacoes.zona = zona;
      }

      if (body.preco !== undefined || body.price !== undefined) {
        const preco = numero(body.preco ?? body.price, 0);
        if (preco < 0) return res.status(400).json({ error: 'O preço não pode ser negativo' });
        atualizacoes.preco = preco;
      }

      if (body.categoriaId !== undefined || body.categoria !== undefined) {
        const categoria = await resolverCategoria(body.categoriaId ?? body.categoria);
        if (!categoria) return res.status(400).json({ error: 'Categoria inválida' });
        if (!categoria.ativa) return res.status(400).json({ error: 'Essa categoria está desativada' });
        atualizacoes.categoriaId = categoria._id;
      }

      if (body.ativo !== undefined) atualizacoes.ativo = Boolean(body.ativo);

      if (Array.isArray(body.imagens)) atualizacoes.imagens = body.imagens.slice(0, 6);

      const servico = await Service.findByIdAndUpdate(req.params.id, atualizacoes, {
        new: true,
        runValidators: true,
      });

      if (!servico) return res.status(404).json({ error: 'Serviço não encontrado' });
      res.json(servico);
    } catch (error) {
      console.error('Erro ao editar serviço:', error.message);
      res.status(500).json({ error: 'Erro ao editar serviço' });
    }
  }
);

// DELETE /api/services/:id - Apagar serviço (dono ou admin).
router.delete(
  '/:id',
  requireAuth,
  requireAdminOrOwner(async (req) => {
    if (!mongoose.isValidObjectId(req.params.id)) return null;
    const servico = await Service.findById(req.params.id).select('prestadorId');
    return servico?.prestadorId || null;
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
