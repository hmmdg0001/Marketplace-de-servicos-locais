require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/user');
const Category = require('../models/category');
const ProviderProfile = require('../models/providerProfile');
const Service = require('../models/service');
const { categories, providers, services } = require('../data/catalog');
const imagensCatalogo = require('../data/catalog-images.json');

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || 'henriquemmarinho66@gmail.com';

async function migrateLegacyServices() {
  // Serviços antigos só tinham userId. Passam a ter prestadorId.
  await Service.collection.updateMany(
    { prestadorId: { $exists: false }, userId: { $exists: true } },
    [{ $set: { prestadorId: '$userId' } }]
  );

  // Serviços antigos sem categoria ficam inativos (não aparecem no catálogo).
  const legacy = await Service.updateMany(
    { categoriaId: null },
    { $set: { ativo: false, preco: 0 } }
  );

  if (legacy.modifiedCount > 0) {
    console.log(`${legacy.modifiedCount} serviço(s) antigo(s) marcado(s) como inativo(s).`);
  }
}

async function seedCategories() {
  const map = new Map();

  for (const category of categories) {
    const doc = await Category.findOneAndUpdate(
      { slug: category.slug },
      { $set: { ...category, ativa: true } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    map.set(category.slug, doc._id);
  }

  console.log(`${map.size} categorias sincronizadas.`);
  return map;
}

async function seedProviders() {
  for (const provider of providers) {
    await User.findOneAndUpdate(
      { uid: provider.id },
      {
        $set: {
          email: `${provider.id}@demo.serviperto.pt`,
          name: provider.nome,
          role: 'user',
          isDemo: true,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await ProviderProfile.findOneAndUpdate(
      { userId: provider.id },
      {
        $set: {
          bio: provider.bio,
          zona: provider.zona,
          isDemo: true,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }

  console.log(`${providers.length} prestadores de demonstração sincronizados.`);
}

async function seedAdminProvider() {
  const admin = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });

  if (!admin) {
    console.log(`Aviso: não encontrei a conta ${ADMIN_EMAIL}.`);
    console.log('Os serviços da conta de administração não foram criados.');
    return null;
  }

  await ProviderProfile.findOneAndUpdate(
    { userId: admin.uid },
    {
      $set: {
        bio: 'Conta de demonstração do administrador. Também pode publicar serviços.',
        zona: 'Fafe',
        isDemo: false,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  console.log(`Perfil de prestador ativado para ${admin.email}.`);
  return admin;
}

async function seedServices(categoryMap, admin) {
  const providerZones = new Map(providers.map((p) => [p.id, p.zona]));
  const removed = await Service.deleteMany({ isSeed: true });

  const docs = services
    .map((service) => {
      const isAdmin = service.prestador === 'admin';
      const prestadorId = isAdmin ? admin?.uid : service.prestador;

      if (!prestadorId) return null;

      return {
        prestadorId,
        categoriaId: categoryMap.get(service.categoria) || null,
        titulo: service.titulo,
        descricao: service.descricao,
        preco: service.preco,
        zona: isAdmin ? 'Fafe' : providerZones.get(service.prestador) || '',
        ativo: true,
        imagens: imagensCatalogo[service.chave] ? [imagensCatalogo[service.chave].url] : [],
        isSeed: true,
      };
    })
    .filter(Boolean);

  await Service.insertMany(docs);

  console.log(`${removed.deletedCount} serviço(s) seed removido(s) e ${docs.length} criado(s).`);
}

async function main() {
  await connectDB();
  await migrateLegacyServices();

  const categoryMap = await seedCategories();
  await seedProviders();
  const admin = await seedAdminProvider();
  await seedServices(categoryMap, admin);

  console.log('Catálogo pronto.');
}

main()
  .catch((error) => {
    console.error('Erro no seed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
