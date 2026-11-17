const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { requireAuth } = require('../config/firebase');
const Order = require('../models/order');
const Service = require('../models/service');
const ProviderProfile = require('../models/providerProfile');
const User = require('../models/user');

// Máquina de estados do pedido. "por" indica quem pode executar a ação.
const TRANSICOES = {
  aceitar: { de: ['Submetido'], para: 'Aceite', por: 'prestador' },
  recusar: { de: ['Submetido'], para: 'Recusado', por: 'prestador' },
  iniciar: { de: ['Aceite'], para: 'Em execução', por: 'prestador' },
  concluir: { de: ['Em execução'], para: 'Aguarda confirmação', por: 'prestador' },
  confirmar: { de: ['Aguarda confirmação'], para: 'Concluído', por: 'cliente' },
  cancelar: { de: ['Submetido', 'Aceite'], para: 'Cancelado', por: 'ambos' },
};

const POPULATE_SERVICO = {
  path: 'servicoId',
  select: 'titulo zona preco categoriaId',
  populate: { path: 'categoriaId', select: 'nome slug icone' },
};

// Junta nomes e dados públicos do serviço/prestador a cada pedido.
async function hidratar(pedidos) {
  const uids = [...new Set(pedidos.flatMap((p) => [p.clienteId, p.prestadorId]).filter(Boolean))];

  const [utilizadores, perfis] = await Promise.all([
    User.find({ uid: { $in: uids } }).select('uid name').lean(),
    ProviderProfile.find({ userId: { $in: uids } }).lean(),
  ]);

  const nomePorUid = new Map(utilizadores.map((u) => [u.uid, u.name]));
  const perfilPorUid = new Map(perfis.map((p) => [p.userId, p]));

  return pedidos.map((pedido) => {
    const servico = pedido.servicoId && typeof pedido.servicoId === 'object' ? pedido.servicoId : null;
    const categoria = servico?.categoriaId && typeof servico.categoriaId === 'object' ? servico.categoriaId : null;
    const perfil = perfilPorUid.get(pedido.prestadorId);

    return {
      ...pedido,
      servicoId: servico?._id || pedido.servicoId,
      servico: servico
        ? {
            _id: servico._id,
            titulo: servico.titulo,
            zona: servico.zona,
            preco: servico.preco,
            categoria,
          }
        : null,
      cliente: {
        uid: pedido.clienteId,
        nome: nomePorUid.get(pedido.clienteId) || 'Cliente',
      },
      prestador: {
        uid: pedido.prestadorId,
        nome: nomePorUid.get(pedido.prestadorId) || 'Prestador',
        mediaAvaliacoes: perfil?.mediaAvaliacoes || 0,
        totalAvaliacoes: perfil?.totalAvaliacoes || 0,
      },
    };
  });
}

async function pedidoHidratado(id) {
  const pedido = await Order.findById(id).populate(POPULATE_SERVICO).lean();
  if (!pedido) return null;
  const [hidratado] = await hidratar([pedido]);
  return hidratado;
}

async function eAdmin(uid) {
  const utilizador = await User.findOne({ uid }).select('role').lean();
  return utilizador?.role === 'admin';
}

// GET /api/orders - Pedidos em que o utilizador é cliente ou prestador.
// ?papel=cliente|prestador filtra a lista.
router.get('/', requireAuth, async (req, res) => {
  try {
    let filtro = { $or: [{ clienteId: req.user.uid }, { prestadorId: req.user.uid }] };

    if (req.query.papel === 'cliente') filtro = { clienteId: req.user.uid };
    if (req.query.papel === 'prestador') filtro = { prestadorId: req.user.uid };

    const pedidos = await Order.find(filtro)
      .sort({ createdAt: -1 })
      .limit(200)
      .populate(POPULATE_SERVICO)
      .lean();

    res.json(await hidratar(pedidos));
  } catch (error) {
    console.error('Erro ao listar pedidos:', error.message);
    res.status(500).json({ error: 'Erro ao buscar pedidos' });
  }
});

// GET /api/orders/:id - Detalhe com histórico. Só participantes ou admin.
router.get('/:id', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    const pedido = await pedidoHidratado(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });

    const participa = pedido.clienteId === req.user.uid || pedido.prestadorId === req.user.uid;

    if (!participa && !(await eAdmin(req.user.uid))) {
      return res.status(403).json({ error: 'Não tens acesso a este pedido' });
    }

    res.json(pedido);
  } catch (error) {
    console.error('Erro ao buscar pedido:', error.message);
    res.status(500).json({ error: 'Erro ao buscar pedido' });
  }
});

// POST /api/orders - Criar pedido para um serviço publicado.
router.post('/', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const servicoId = body.servicoId;
    const descricao = String(body.descricao || '').trim();
    const morada = String(body.morada || '').trim();
    const dataDesejada = new Date(body.dataDesejada);

    if (!mongoose.isValidObjectId(servicoId)) {
      return res.status(400).json({ error: 'Serviço inválido' });
    }
    if (!descricao) return res.status(400).json({ error: 'Descreve o trabalho que precisas' });
    if (!morada) return res.status(400).json({ error: 'Indica a morada do serviço' });
    if (Number.isNaN(dataDesejada.getTime())) {
      return res.status(400).json({ error: 'Indica uma data válida' });
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    if (dataDesejada < hoje) {
      return res.status(400).json({ error: 'Escolhe uma data a partir de hoje' });
    }

    const servico = await Service.findById(servicoId).lean();
    if (!servico) return res.status(404).json({ error: 'Serviço não encontrado' });
    if (!servico.ativo) return res.status(400).json({ error: 'Este serviço está desativado' });
    if (servico.prestadorId === req.user.uid) {
      return res.status(400).json({ error: 'Não podes pedir o teu próprio serviço' });
    }

    const autor = await User.findOne({ uid: req.user.uid }).select('name').lean();

    const pedido = await Order.create({
      servicoId: servico._id,
      clienteId: req.user.uid,
      prestadorId: servico.prestadorId,
      descricao,
      morada,
      dataDesejada,
      preco: servico.preco || 0,
      estado: 'Submetido',
      historico: [
        {
          de: null,
          para: 'Submetido',
          autorId: req.user.uid,
          autorNome: autor?.name || 'Cliente',
          data: new Date(),
        },
      ],
    });

    res.status(201).json(await pedidoHidratado(pedido._id));
  } catch (error) {
    console.error('Erro ao criar pedido:', error.message);
    res.status(500).json({ error: 'Erro ao criar pedido' });
  }
});

// POST /api/orders/:id/transicoes - Aplicar uma ação da máquina de estados.
router.post('/:id/transicoes', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    const pedido = await Order.findById(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });

    const isCliente = pedido.clienteId === req.user.uid;
    const isPrestador = pedido.prestadorId === req.user.uid;

    if (!isCliente && !isPrestador) {
      return res.status(403).json({ error: 'Não tens acesso a este pedido' });
    }

    const acao = String(req.body.acao || '').trim();
    const transicao = TRANSICOES[acao];

    if (!transicao) {
      return res.status(400).json({ error: 'Ação inválida' });
    }

    const papel = isPrestador ? 'prestador' : 'cliente';

    if (transicao.por !== 'ambos' && transicao.por !== papel) {
      return res.status(403).json({
        error: transicao.por === 'prestador'
          ? 'Só o prestador pode fazer esta ação'
          : 'Só o cliente pode fazer esta ação',
      });
    }

    if (!transicao.de.includes(pedido.estado)) {
      return res.status(400).json({
        error: `Não é possível ${acao} um pedido no estado "${pedido.estado}"`,
      });
    }

    const nota = String(req.body.nota || '').trim();

    if (acao === 'cancelar' && papel === 'prestador' && !nota) {
      return res.status(400).json({ error: 'Indica o motivo do cancelamento' });
    }

    const autor = await User.findOne({ uid: req.user.uid }).select('name').lean();

    const entrada = {
      de: pedido.estado,
      para: transicao.para,
      autorId: req.user.uid,
      autorNome: autor?.name || (papel === 'prestador' ? 'Prestador' : 'Cliente'),
      nota,
      data: new Date(),
    };

    // O estado na condição evita que dois cliques ao mesmo tempo apliquem
    // a mesma transição duas vezes.
    const atualizado = await Order.findOneAndUpdate(
      { _id: pedido._id, estado: pedido.estado },
      { $set: { estado: transicao.para }, $push: { historico: entrada } },
      { new: true }
    );

    if (!atualizado) {
      return res.status(409).json({ error: 'O pedido mudou de estado entretanto. Atualiza a página.' });
    }

    res.json(await pedidoHidratado(atualizado._id));
  } catch (error) {
    console.error('Erro ao atualizar pedido:', error.message);
    res.status(500).json({ error: 'Erro ao atualizar pedido' });
  }
});

module.exports = router;
