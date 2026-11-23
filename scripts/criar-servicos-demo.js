require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Category = require('../models/category');
const Service = require('../models/service');
const { services, providers } = require('../data/catalog');
const imagens = require('../data/catalog-images.json');

// Cria os anúncios dos prestadores de demonstração sem apagar os anúncios
// existentes (o seed completo continua disponível em seed-catalog.js).
async function main() {
  await connectDB();

  const categorias = await Category.find({}).lean();
  const porSlug = new Map(categorias.map((c) => [c.slug, c._id]));
  const zonas = new Map(providers.map((p) => [p.id, p.zona]));

  let criados = 0;
  let ignorados = 0;

  for (const servico of services.filter((s) => s.prestador !== 'admin')) {
    const existente = await Service.findOne({ prestadorId: servico.prestador, titulo: servico.titulo });
    if (existente) {
      ignorados += 1;
      continue;
    }

    const chaveImagem = servico.imagemChave || servico.chave;
    await Service.create({
      prestadorId: servico.prestador,
      categoriaId: porSlug.get(servico.categoria) || null,
      titulo: servico.titulo,
      descricao: servico.descricao,
      preco: servico.preco,
      zona: zonas.get(servico.prestador) || '',
      ativo: true,
      imagens: imagens[chaveImagem] ? [imagens[chaveImagem].url] : [],
      isSeed: true,
    });
    criados += 1;
  }

  console.log(`${criados} anúncio(s) de demonstração criado(s); ${ignorados} já existiam.`);
  await mongoose.disconnect();
}

main().catch(async (erro) => {
  console.error('Erro:', erro.message);
  process.exitCode = 1;
  await mongoose.disconnect();
});
