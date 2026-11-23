require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Service = require('../models/service');
const Order = require('../models/order');
const Review = require('../models/review');
const ProviderProfile = require('../models/providerProfile');

const CLIENTES = ['vmr4UA74t5P3TbvqJ1n2dS63Bvv1', 'Qs1uYfX91ZSVc4yY5jcrEOOZdDu2'];
const COMENTARIOS = [
  'Muito pontual e profissional. Recomendo!',
  'Trabalho bem feito, com atenção ao detalhe.',
  'Excelente comunicação e resultado final.',
  'Chegou a tempo e resolveu tudo sem complicações.',
  'Simpático, cuidadoso e competente. Voltarei a pedir.',
];

// Cria pedidos concluídos e avaliações verificadas para os prestadores de
// demonstração, para dar conteúdo às páginas públicas de perfil.
async function main() {
  await connectDB();

  const perfis = await ProviderProfile.find({ isDemo: true }).lean();
  let criados = 0;

  for (let i = 0; i < perfis.length; i += 1) {
    const perfil = perfis[i];
    const servico = await Service.findOne({ prestadorId: perfil.userId, ativo: true }).lean();
    if (!servico) {
      console.log(`${perfil.userId}: sem serviços, ignorei.`);
      continue;
    }

    const clienteId = CLIENTES[i % CLIENTES.length];
    const existente = await Review.findOne({ clienteId, prestadorId: perfil.userId });
    if (existente) {
      console.log(`${perfil.userId}: já tem avaliação deste cliente, ignorei.`);
      continue;
    }

    const diasAtras = (i + 1) * 4;
    const data = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000);
    const passo = (horas) => new Date(data.getTime() + horas * 60 * 60 * 1000);

    const pedido = await Order.create({
      servicoId: servico._id,
      clienteId,
      prestadorId: perfil.userId,
      descricao: servico.descricao || 'Serviço de demonstração.',
      dataDesejada: passo(24),
      morada: 'Morada de demonstração',
      preco: servico.preco || 0,
      estado: 'Concluído',
      createdAt: data,
      updatedAt: data,
      historico: [
        { para: 'Submetido', autorId: clienteId, data: passo(0) },
        { de: 'Submetido', para: 'Aceite', autorId: perfil.userId, data: passo(2) },
        { de: 'Aceite', para: 'Em execução', autorId: perfil.userId, data: passo(5) },
        { de: 'Em execução', para: 'Aguarda confirmação', autorId: perfil.userId, data: passo(8) },
        { de: 'Aguarda confirmação', para: 'Concluído', autorId: clienteId, data: passo(10) },
      ],
    });

    await Review.create({
      pedidoId: pedido._id,
      servicoId: servico._id,
      clienteId,
      prestadorId: perfil.userId,
      classificacao: i % 3 === 0 ? 5 : 4,
      comentario: COMENTARIOS[i % COMENTARIOS.length],
      createdAt: passo(11),
      updatedAt: passo(11),
    });
    criados += 1;
  }

  const estatisticas = await Review.aggregate([
    {
      $group: {
        _id: '$prestadorId',
        media: { $avg: '$classificacao' },
        total: { $sum: 1 },
      },
    },
  ]);
  for (const estatistica of estatisticas) {
    await ProviderProfile.updateOne(
      { userId: estatistica._id },
      {
        $set: {
          mediaAvaliacoes: Math.round(estatistica.media * 10) / 10,
          totalAvaliacoes: estatistica.total,
        },
      }
    );
  }

  console.log(`${criados} avaliação(ões) criada(s) e estatísticas atualizadas.`);
  await mongoose.disconnect();
}

main().catch(async (erro) => {
  console.error('Erro:', erro.message);
  process.exitCode = 1;
  await mongoose.disconnect();
});
