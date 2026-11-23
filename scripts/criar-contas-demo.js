require('dotenv').config();
const { initializeFirebase, admin } = require('../config/firebase');
const { providers } = require('../data/catalog');

const SENHA_DEMO = 'Demo1234';

async function main() {
  initializeFirebase();

  for (const provider of providers) {
    const email = `${provider.id}@demo.serviperto.pt`;
    try {
      const existente = await admin.auth().getUserByEmail(email).catch(() => null);
      if (existente) {
        console.log(`${email} — já existe (uid ${existente.uid})`);
        continue;
      }

      const criado = await admin.auth().createUser({
        uid: provider.id,
        email,
        emailVerified: true,
        displayName: provider.nome,
        password: SENHA_DEMO,
      });
      console.log(`${email} — criado (uid ${criado.uid})`);
    } catch (erro) {
      console.error(`${email} — ERRO: ${erro.message}`);
    }
  }

  console.log(`\nPalavra-passe das contas de demonstração: ${SENHA_DEMO}`);
}

main().catch((erro) => {
  console.error('Erro:', erro.message);
  process.exitCode = 1;
});
