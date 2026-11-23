require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const cloudinary = require('../config/cloudinary');
const Service = require('../models/service');
const { services } = require('../data/catalog');

// Fotos escolhidas no Pexels (pesquisa feita à mão, ver data/pexels-escolhas.json).
// O Pexels bloqueia a página de pesquisa a partir desta rede, mas o CDN
// images.pexels.com responde bem — por isso o upload é feito por URL,
// deixando o Cloudinary ir buscar o ficheiro.
const ESCOLHAS = require('../data/pexels-escolhas.json');

const DESTINO = path.join(__dirname, '..', 'data', 'catalog-images.json');
const PASTA = 'serviperto/catalogo';
const PARAMS = '?auto=compress&cs=tinysrgb&w=1400';
const CONCORRENCIA = 4;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function lerGuardado() {
  if (!fs.existsSync(DESTINO)) return {};
  try {
    return JSON.parse(fs.readFileSync(DESTINO, 'utf8'));
  } catch {
    return {};
  }
}

function escreverGuardado(guardado) {
  const ordenado = {};
  for (const servico of services) {
    if (guardado[servico.chave]) ordenado[servico.chave] = guardado[servico.chave];
  }
  fs.writeFileSync(DESTINO, JSON.stringify(ordenado, null, 2) + '\n');
}

function urlPexels(id, extensao = 'jpeg') {
  return `https://images.pexels.com/photos/${id}/pexels-photo-${id}.${extensao}${PARAMS}`;
}

async function enviarCloudinary(escolha, chave) {
  const opcoes = {
    folder: PASTA,
    public_id: chave,
    overwrite: true,
    invalidate: true,
    resource_type: 'image',
  };

  try {
    return await cloudinary.uploader.upload(urlPexels(escolha.id, 'jpeg'), opcoes);
  } catch (erro) {
    // Algumas fotos do Pexels são PNG.
    return cloudinary.uploader.upload(urlPexels(escolha.id, 'png'), opcoes);
  }
}

async function aplicarNaBase(guardado) {
  let atualizados = 0;
  const emFalta = [];

  for (const servico of services) {
    const entrada = guardado[servico.chave];
    if (!entrada) {
      emFalta.push(servico.chave);
      continue;
    }

    const resultado = await Service.updateOne(
      { isSeed: true, titulo: servico.titulo },
      { $set: { imagens: [entrada.url] } }
    );
    if (resultado.modifiedCount > 0) atualizados += 1;
  }

  console.log(`Base de dados: ${atualizados} serviço(s) atualizado(s).`);
  if (emFalta.length) console.log(`Sem imagem: ${emFalta.join(', ')}`);
}

async function main() {
  const args = process.argv.slice(2);
  const apenasBase = args.includes('--apenas-base');
  const forcar = args.includes('--forcar');
  const indiceLimite = args.indexOf('--limite');
  const limite = indiceLimite >= 0 ? Number(args[indiceLimite + 1]) : Infinity;
  const indiceChaves = args.indexOf('--chaves');
  const chaves =
    indiceChaves >= 0
      ? String(args[indiceChaves + 1] || '')
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
      : null;

  const guardado = lerGuardado();

  if (!apenasBase) {
    const pendentes = services.filter(
      (servico) =>
        ESCOLHAS[servico.chave] &&
        (forcar || !guardado[servico.chave]) &&
        (!chaves || chaves.includes(servico.chave))
    );

    console.log(
      `${services.length} anúncios, ${services.length - pendentes.length} já com imagem, ${pendentes.length} por enviar.`
    );

    const fila = pendentes.slice(0, Number.isFinite(limite) ? limite : pendentes.length);
    let feitos = 0;
    let falhas = 0;
    let indice = 0;

    async function trabalhador() {
      while (indice < fila.length) {
        const servico = fila[indice];
        indice += 1;

        try {
          const resultado = await enviarCloudinary(ESCOLHAS[servico.chave], servico.chave);
          guardado[servico.chave] = {
            url: resultado.secure_url,
            fonte: 'Pexels',
            pagina: `https://www.pexels.com/photo/${ESCOLHAS[servico.chave].id}/`,
            pexelsId: ESCOLHAS[servico.chave].id,
            consulta: ESCOLHAS[servico.chave].consulta,
          };
          feitos += 1;
          escreverGuardado(guardado);
          console.log(
            `[${feitos + falhas}/${fila.length}] ${servico.chave} -> ${resultado.width}x${resultado.height}`
          );
        } catch (erro) {
          falhas += 1;
          console.error(`[${feitos + falhas}/${fila.length}] ${servico.chave} FALHOU: ${erro.message}`);
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(CONCORRENCIA, fila.length) }, trabalhador));
    escreverGuardado(guardado);
    console.log(`\nEnviadas: ${feitos}/${fila.length} (falhas: ${falhas}).`);
    if (falhas) await esperar(500);
  }

  await connectDB();
  await aplicarNaBase(guardado);
}

main()
  .catch((erro) => {
    console.error('Erro:', erro.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
