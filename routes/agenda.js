const express = require('express');
const router = express.Router();
const Order = require('../models/order');
const Slot = require('../models/slot');
const { ESTADOS_BLOQUEIO, iniciosPossiveis } = require('../utils/agenda');

// GET /api/agenda/slots?prestadorId=&data=YYYY-MM-DD&duracao=75
// Devolve os inícios disponíveis para a duração pedida, dentro da janela 09–18h.
router.get('/slots', async (req, res) => {
  try {
    const { prestadorId, data } = req.query;
    const duracao = Number(req.query.duracao);

    if (!prestadorId || !data) {
      return res.status(400).json({ error: 'prestadorId e data são obrigatórios' });
    }
    if (!Number.isFinite(duracao) || duracao <= 0) {
      return res.status(400).json({ error: 'Duração inválida' });
    }

    const candidatos = iniciosPossiveis(data, duracao);
    if (candidatos.length === 0) {
      return res.json({ data, duracao, slots: [] });
    }

    const primeiro = candidatos[0];
    const ultimo = candidatos[candidatos.length - 1];
    const fimJanela = new Date(ultimo.getTime() + duracao * 60 * 1000);

    const [pedidos, bloqueios] = await Promise.all([
      Order.find({
        prestadorId,
        estado: { $in: ESTADOS_BLOQUEIO },
        inicio: { $ne: null },
        $or: [{ inicio: { $lt: fimJanela }, fim: { $gt: primeiro } }],
      })
        .select('inicio fim')
        .lean(),
      Slot.find({
        prestadorId,
        inicio: { $lt: fimJanela },
        fim: { $gt: primeiro },
      })
        .select('inicio fim')
        .lean(),
    ]);

    const ocupados = [...pedidos, ...bloqueios];
    const disponiveis = candidatos.filter((inicio) => {
      const fim = new Date(inicio.getTime() + duracao * 60 * 1000);
      return !ocupados.some((o) => o.inicio && o.fim && inicio < o.fim && fim > o.inicio);
    });

    res.json({
      data,
      duracao,
      slots: disponiveis.map((inicio) => ({
        inicio: inicio.toISOString(),
        fim: new Date(inicio.getTime() + duracao * 60 * 1000).toISOString(),
      })),
    });
  } catch (erro) {
    console.error('Erro ao calcular slots:', erro.message);
    res.status(500).json({ error: 'Erro ao calcular horários' });
  }
});

module.exports = router;
