require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Service = require('../models/service');
const Order = require('../models/order');
const REGRAS = require('../data/regras-tempo.json');

// Atualiza documentos existentes sem apagar nada. Pode ser executado várias vezes.
async function main() {
  await connectDB();

  const servicos = await Service.find({}, { titulo: 1 }).lean();
  let servicosAtualizados = 0;
  let servicosJaTinham = 0;

  for (const servico of servicos) {
    if (servico.regras_tempo) {
      servicosJaTinham += 1;
      continue;
    }
    const regras = REGRAS[servico.titulo] || REGRAS.padrao;
    await Service.updateOne({ _id: servico._id }, { $set: { regras_tempo: regras } });
    servicosAtualizados += 1;
  }

  const pedidos = await Order.updateMany(
    { tempo_total_calculado: { $exists: false } },
    { $set: { tempo_total_calculado: 60, parametros_tempo: {}, inicio: null, fim: null } }
  );

  console.log(`serviços: ${servicosAtualizados} atualizados, ${servicosJaTinham} já tinham regras.`);
  console.log(`pedidos antigos com duração preenchida: ${pedidos.modifiedCount}.`);

  await mongoose.disconnect();
}

main().catch(async (erro) => {
  console.error('Erro:', erro.message);
  process.exitCode = 1;
  await mongoose.disconnect();
});
