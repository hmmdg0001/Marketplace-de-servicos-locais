const express = require('express');
const router = express.Router();
const { requireAuth, admin } = require('../config/firebase');
const User = require('../models/user');
const ProviderProfile = require('../models/providerProfile');
const Service = require('../models/service');
const Review = require('../models/review');

// Junta os dados do utilizador com o perfil de prestador (se existir)
// e com as estatísticas que aparecem na conta.
async function perfilCompleto(uid) {
  const [user, provider, totalServicos] = await Promise.all([
    User.findOne({ uid }).lean(),
    ProviderProfile.findOne({ userId: uid }).lean(),
    Service.countDocuments({ prestadorId: uid, ativo: true }),
  ]);

  if (!user) return null;

  return {
    user: {
      uid: user.uid,
      email: user.email,
      name: user.name,
      telefone: user.telefone || '',
      cidade: user.cidade || '',
      role: user.role,
      criadoEm: user.createdAt,
    },
    provider: provider
      ? {
          bio: provider.bio || '',
          zona: provider.zona || '',
          mediaAvaliacoes: provider.mediaAvaliacoes || 0,
          totalAvaliacoes: provider.totalAvaliacoes || 0,
          totalServicos,
        }
      : null,
  };
}

// GET /api/profile - Dados completos da conta autenticada.
router.get('/', requireAuth, async (req, res) => {
  try {
    const perfil = await perfilCompleto(req.user.uid);
    if (!perfil) return res.status(404).json({ error: 'Utilizador não encontrado' });
    res.json(perfil);
  } catch (error) {
    console.error('Erro ao buscar perfil:', error.message);
    res.status(500).json({ error: 'Erro ao buscar perfil' });
  }
});

// GET /api/profile/:uid - Perfil público de um prestador, sem dados privados.
router.get('/:uid', async (req, res) => {
  try {
    const uid = req.params.uid;
    const [user, provider, totalServicos, avaliacoes] = await Promise.all([
      User.findOne({ uid }).select('uid name cidade createdAt').lean(),
      ProviderProfile.findOne({ userId: uid }).lean(),
      Service.countDocuments({ prestadorId: uid, ativo: true }),
      Review.find({ prestadorId: uid }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    if (!user) return res.status(404).json({ error: 'Prestador não encontrado' });

    const clienteIds = [...new Set(avaliacoes.map((a) => a.clienteId))];
    const clientes = await User.find({ uid: { $in: clienteIds } }).select('uid name').lean();
    const nomePorUid = new Map(clientes.map((u) => [u.uid, u.name]));

    res.json({
      user: {
        uid: user.uid,
        nome: user.name,
        cidade: user.cidade || '',
        criadoEm: user.createdAt,
      },
      provider: provider
        ? {
            bio: provider.bio || '',
            zona: provider.zona || '',
            mediaAvaliacoes: provider.mediaAvaliacoes || 0,
            totalAvaliacoes: provider.totalAvaliacoes || 0,
            totalServicos,
          }
        : null,
      avaliacoes: avaliacoes.map((avaliacao) => ({
        _id: avaliacao._id,
        classificacao: avaliacao.classificacao,
        comentario: avaliacao.comentario,
        createdAt: avaliacao.createdAt,
        cliente: {
          uid: avaliacao.clienteId,
          nome: nomePorUid.get(avaliacao.clienteId) || 'Cliente',
        },
      })),
    });
  } catch (error) {
    console.error('Erro ao buscar perfil público:', error.message);
    res.status(500).json({ error: 'Erro ao buscar perfil público' });
  }
});

// PUT /api/profile - Editar dados pessoais e perfil de prestador.
// O email não é editável aqui de propósito: mudar o email no Firebase Admin
// volta a marcar a conta como "não verificada" e obriga a um novo fluxo de
// verificação. Para já o email fica fixo.
router.put('/', requireAuth, async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name ?? '').trim();
    const telefone = String(body.telefone ?? '').trim();
    const cidade = String(body.cidade ?? '').trim();

    if (!name) {
      return res.status(400).json({ error: 'O nome não pode ficar vazio' });
    }

    const atual = await User.findOne({ uid: req.user.uid });

    // Só mexe no Firebase quando o nome muda mesmo.
    if (atual?.name !== name) {
      await admin.auth().updateUser(req.user.uid, { displayName: name });
    }

    const user = await User.findOneAndUpdate(
      { uid: req.user.uid },
      {
        $set: { name, telefone, cidade },
        $setOnInsert: { email: req.user.email },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // O perfil de prestador só é criado quando há informação para mostrar.
    const bio = body.bio === undefined ? null : String(body.bio).trim();
    const zona = body.zona === undefined ? null : String(body.zona).trim();

    if (bio !== null || zona !== null) {
      const existente = await ProviderProfile.findOne({ userId: req.user.uid });

      if (existente) {
        const alteracoes = {};
        if (bio !== null) alteracoes.bio = bio;
        if (zona !== null) alteracoes.zona = zona;
        if (Object.keys(alteracoes).length > 0) {
          await ProviderProfile.updateOne({ userId: req.user.uid }, { $set: alteracoes });
        }
      } else if (bio) {
        // Só ativa o perfil de prestador quando a pessoa escreve a
        // apresentação. Publicar um serviço também o faz automaticamente.
        await ProviderProfile.create({
          userId: req.user.uid,
          bio,
          zona: zona || cidade,
        });
      }
    }

    const perfil = await perfilCompleto(req.user.uid);

    res.json({
      message: 'Perfil atualizado com sucesso',
      ...perfil,
    });
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error.message);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

module.exports = router;
