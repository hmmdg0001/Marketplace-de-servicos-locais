require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Service = require('../models/service');
const Order = require('../models/order');
const Review = require('../models/review');
const ProviderProfile = require('../models/providerProfile');
const User = require('../models/user');

// Padrão equilibrado: bons, médios e maus — média global perto de 3,7.
const PADRAO_NOTAS = [5, 4, 4, 3, 5, 2, 4, 5, 3, 4, 1, 5, 3, 4, 2, 5, 4, 3, 5, 2, 4];

const COMENTARIOS = {
  5: [
    'Excelente profissional, pontual e muito competente.',
    'Superou as expectativas. Recomendo vivamente!',
    'Trabalho impecável e comunicação constante.',
  ],
  4: [
    'Muito bom trabalho, com pequenos detalhes a melhorar.',
    'Serviço bem feito e dentro do prazo combinado.',
    'Profissional simpático; voltaria a contratar.',
  ],
  3: [
    'Correu bem, mas demorou mais do que o esperado.',
    'Resultado aceitável; a comunicação podia ser melhor.',
    'Cumpriu o combinado, sem mais.',
  ],
  2: [
    'Chegou atrasado e o resultado ficou aquém do esperado.',
    'Faltou cuidado no acabamento final.',
    'Demasiada demora e pouca clareza no orçamento.',
  ],
  1: [
    'Não compareceu ao horário combinado.',
    'O serviço não foi concluído como combinado.',
    'Má experiência; não recomendo.',
  ],
};

function passo(data, horas) {
  return new Date(data.getTime() + horas * 60 * 60 * 1000);
}

// Cria uma avaliação verificada para cada serviço ativo que ainda não tem nenhuma.
async function main() {
  await connectDB();

  const [servicos, utilizadores] = await Promise.all([
    Service.find({ ativo: true }).sort({ createdAt: 1 }).lean(),
    User.find({}).select('uid name').lean(),
  ]);

  const prestadores = [...new Set(servicos.map((s) => s.prestadorId))];
  const clientes = utilizadores.map((u) => u.uid);
  let criados = 0;
  let ignorados = 0;
  const distribuicao = {};

  for (let i = 0; i < servicos.length; i += 1) {
    const servico = servicos[i];
    const jaTem = await Review.exists({ servicoId: servico._id });
    if (jaTem) {
      ignorados += 1;
      continue;
    }

    const candidatos = clientes.filter((uid) => uid !== servico.prestadorId);
    const clienteId = candidatos[(i + 3) % candidatos.length];
    if (!clienteId) continue;

    const offset = prestadores.indexOf(servico.prestadorId) * 2;
    const classificacao = PADRAO_NOTAS[(i + offset) % PADRAO_NOTAS.length];
    const lista = COMENTARIOS[classificacao];
    const comentario = lista[(i + offset) % lista.length];

    const diasAtras = 1 + ((i * 3) % 75);
    const data = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000);

    const pedido = await Order.create({
      servicoId: servico._id,
      clienteId,
      prestadorId: servico.prestadorId,
      descricao: servico.descricao || 'Serviço de demonstração.',
      dataDesejada: passo(data, 24),
      morada: 'Morada de demonstração',
      preco: servico.preco || 0,
      estado: 'Concluído',
      createdAt: data,
      updatedAt: data,
      historico: [
        { para: 'Submetido', autorId: clienteId, data: passo(data, 0) },
        { de: 'Submetido', para: 'Aceite', autorId: servico.prestadorId, data: passo(data, 2) },
        { de: 'Aceite', para: 'Em execução', autorId: servico.prestadorId, data: passo(data, 5) },
        { de: 'Em execução', para: 'Aguarda confirmação', autorId: servico.prestadorId, data: passo(data, 8) },
        { de: 'Aguarda confirmação', para: 'Concluído', autorId: clienteId, data: passo(data, 10) },
      ],
    });

    await Review.create({
      pedidoId: pedido._id,
      servicoId: servico._id,
      clienteId,
      prestadorId: servico.prestadorId,
      classificacao,
      comentario,
      createdAt: passo(data, 11),
      updatedAt: passo(data, 11),
    });

    distribuicao[classificacao] = (distribuicao[classificacao] || 0) + 1;
    criados += 1;
  }

  const estatisticas = await Review.aggregate([
    { $group: { _id: '$prestadorId', media: { $avg: '$classificacao' }, total: { $sum: 1 } } },
  ]);
  const porPrestador = new Map(estatisticas.map((e) => [e._id, e]));
  const perfis = await ProviderProfile.find({}).select('userId').lean();
  for (const perfil of perfis) {
    const estatistica = porPrestador.get(perfil.userId);
    await ProviderProfile.updateOne(
      { userId: perfil.userId },
      {
        $set: {
          mediaAvaliacoes: estatistica ? Math.round(estatistica.media * 10) / 10 : 0,
          totalAvaliacoes: estatistica ? estatistica.total : 0,
        },
      }
    );
  }

  const mediaGeral = await Review.aggregate([
    { $group: { _id: null, media: { $avg: '$classificacao' }, total: { $sum: 1 } } },
  ]);

  console.log(`${criados} avaliação(ões) criada(s); ${ignorados} serviço(s) já tinham.`);
  console.log('distribuição:', JSON.stringify(distribuicao));
  console.log(
    'global:',
    mediaGeral[0] ? `${mediaGeral[0].media.toFixed(2)}/5 em ${mediaGeral[0].total} avaliações` : 'sem avaliações'
  );

  await mongoose.disconnect();
}

main().catch(async (erro) => {
  console.error('Erro:', erro.message);
  process.exitCode = 1;
  await mongoose.disconnect();
});
