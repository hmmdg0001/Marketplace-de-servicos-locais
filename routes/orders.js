const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { requireAuth } = require('../config/firebase');
const Order = require('../models/order');
const Service = require('../models/service');
const ProviderProfile = require('../models/providerProfile');
const Review = require('../models/review');
const User = require('../models/user');
const Message = require('../models/message');
const Notification = require('../models/notification');

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

  const pedidoIds = pedidos.map((p) => p._id);

  const [utilizadores, perfis, avaliacoes] = await Promise.all([
    User.find({ uid: { $in: uids } }).select('uid name').lean(),
    ProviderProfile.find({ userId: { $in: uids } }).lean(),
    Review.find({ pedidoId: { $in: pedidoIds } }).lean(),
  ]);

  const nomePorUid = new Map(utilizadores.map((u) => [u.uid, u.name]));
  const perfilPorUid = new Map(perfis.map((p) => [p.userId, p]));
  const avaliacaoPorPedido = new Map(avaliacoes.map((a) => [String(a.pedidoId), a]));

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
      avaliacao: avaliacaoPorPedido.get(String(pedido._id)) || null,
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

// Participantes que devem receber um aviso (o remetente nunca recebe o dele).
async function destinatariosAviso(pedido, remetenteUid) {
  const uids = new Set([pedido.clienteId, pedido.prestadorId].filter(Boolean));
  uids.delete(remetenteUid);
  const admins = await User.find({ role: 'admin' }).select('uid').lean();
  admins.forEach((admin) => uids.add(admin.uid));
  return [...uids];
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
    const admin = !participa && (await eAdmin(req.user.uid));

    if (!participa && !admin) {
      return res.status(403).json({ error: 'Não tens acesso a este pedido' });
    }

    pedido.papel = admin ? 'admin' : pedido.prestadorId === req.user.uid ? 'prestador' : 'cliente';
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

    await Notification.insertMany(
      (await destinatariosAviso(pedido, req.user.uid)).map((uid) => ({
        userId: uid,
        tipo: 'pedido',
        titulo: 'Novo pedido de serviço',
        texto: `${autor?.name || 'Um cliente'} pediu “${servico.titulo}”.`,
        pedidoId: pedido._id,
      }))
    );

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

// POST /api/orders/:id/avaliacao - Avaliação verificada.
// Só o cliente do pedido, só depois de Concluído e no máximo uma vez.
router.post('/:id/avaliacao', requireAuth, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Pedido não encontrado' });
    }

    const pedido = await Order.findById(req.params.id);
    if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado' });

    if (pedido.clienteId !== req.user.uid) {
      return res.status(403).json({ error: 'Só o cliente do pedido pode avaliar' });
    }

    if (pedido.estado !== 'Concluído') {
      return res.status(400).json({ error: 'Só podes avaliar pedidos concluídos' });
    }

    const classificacao = Number(req.body.classificacao);

    if (!Number.isInteger(classificacao) || classificacao < 1 || classificacao > 5) {
      return res.status(400).json({ error: 'A classificação tem de ser um número de 1 a 5' });
    }

    const comentario = String(req.body.comentario || '').trim().slice(0, 1000);

    const existente = await Review.findOne({ pedidoId: pedido._id });
    if (existente) {
      return res.status(409).json({ error: 'Este pedido já foi avaliado' });
    }

    try {
      await Review.create({
        pedidoId: pedido._id,
        servicoId: pedido.servicoId,
        clienteId: pedido.clienteId,
        prestadorId: pedido.prestadorId,
        classificacao,
        comentario,
      });
    } catch (error) {
      // O índice único em pedidoId é a última defesa contra dois cliques.
      if (error.code === 11000) {
        return res.status(409).json({ error: 'Este pedido já foi avaliado' });
      }
      throw error;
    }

    // Recalcula a média do prestador a partir de todas as avaliações.
    const [estatisticas] = await Review.aggregate([
      { $match: { prestadorId: pedido.prestadorId } },
      { $group: { _id: null, media: { $avg: '$classificacao' }, total: { $sum: 1 } } },
    ]);

    await ProviderProfile.findOneAndUpdate(
      { userId: pedido.prestadorId },
      {
        $set: {
          mediaAvaliacoes: Math.round((estatisticas?.media || 0) * 10) / 10,
          totalAvaliacoes: estatisticas?.total || 0,
        },
        $setOnInsert: { bio: '', zona: '' },
      },
      { upsert: true, setDefaultsOnInsert: true }
    );

    res.status(201).json(await pedidoHidratado(pedido._id));
  } catch (error) {
    console.error('Erro ao avaliar pedido:', error.message);
    res.status(500).json({ error: 'Erro ao avaliar pedido' });
  }
});

// Só o cliente e o prestador do pedido podem ler/escrever na conversa.
async function pedidoDoParticipante(req) {
  if (!mongoose.isValidObjectId(req.params.id)) return null;
  const pedido = await Order.findById(req.params.id).select('clienteId prestadorId').lean();
  if (!pedido) return null;
  const uid = req.user?.uid;
  if (uid !== pedido.clienteId && uid !== pedido.prestadorId && !(await eAdmin(uid))) return null;
  return pedido;
}

// GET /api/orders/:id/mensagens - Conversa do pedido.
router.get('/:id/mensagens', requireAuth, async (req, res) => {
  try {
    const pedido = await pedidoDoParticipante(req);
    if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado ou sem acesso' });

    const mensagens = await Message.find({ pedidoId: pedido._id })
      .sort({ createdAt: 1 })
      .limit(200)
      .lean();

    const uids = [...new Set(mensagens.map((m) => m.remetenteUid))];
    const utilizadores = await User.find({ uid: { $in: uids } }).select('uid name role').lean();
    const nomePorUid = new Map(
      utilizadores.map((u) => [
        u.uid,
        u.role === 'admin' ? 'Administração (suporte)' : u.name || 'Participante',
      ])
    );

    res.json(
      mensagens.map((mensagem) => ({
        _id: mensagem._id,
        texto: mensagem.texto,
        criadoEm: mensagem.createdAt,
        remetenteUid: mensagem.remetenteUid,
        remetenteNome: nomePorUid.get(mensagem.remetenteUid) || 'Participante',
      }))
    );
  } catch (error) {
    console.error('Erro ao ler mensagens:', error.message);
    res.status(500).json({ error: 'Erro ao ler mensagens' });
  }
});

// POST /api/orders/:id/mensagens - Enviar mensagem no pedido.
router.post('/:id/mensagens', requireAuth, async (req, res) => {
  try {
    const pedido = await pedidoDoParticipante(req);
    if (!pedido) return res.status(404).json({ error: 'Pedido não encontrado ou sem acesso' });

    const texto = String(req.body?.texto ?? '').trim();
    if (!texto) return res.status(400).json({ error: 'A mensagem não pode ficar vazia' });
    if (texto.length > 2000) return res.status(400).json({ error: 'A mensagem é demasiado longa' });

    const mensagem = await Message.create({
      pedidoId: pedido._id,
      remetenteUid: req.user.uid,
      texto,
    });

    const ehAdmin =
      req.user.uid !== pedido.clienteId &&
      req.user.uid !== pedido.prestadorId &&
      (await eAdmin(req.user.uid));

    const nomeRemetente = ehAdmin ? 'Administração (suporte)' : req.user.name || 'Participante';

    await Notification.insertMany(
      (await destinatariosAviso(pedido, req.user.uid)).map((uid) => ({
        userId: uid,
        tipo: 'mensagem',
        titulo: 'Nova mensagem no pedido',
        texto: `${nomeRemetente}: ${texto.slice(0, 120)}`,
        pedidoId: pedido._id,
      }))
    );

    res.status(201).json({
      _id: mensagem._id,
      texto: mensagem.texto,
      criadoEm: mensagem.createdAt,
      remetenteUid: mensagem.remetenteUid,
      remetenteNome: nomeRemetente,
    });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error.message);
    res.status(500).json({ error: 'Erro ao enviar mensagem' });
  }
});

module.exports = router;
