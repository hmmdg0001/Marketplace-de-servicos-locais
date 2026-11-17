require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const User = require('../models/user');

// Uso:
//   node scripts/make-admin.js --list
//   node scripts/make-admin.js ola@exemplo.pt
//   node scripts/make-admin.js ola@exemplo.pt --remove
//
// O utilizador tem de existir no MongoDB, ou seja, já se registou e entrou
// na aplicação pelo menos uma vez.

async function main() {
  await connectDB();

  const args = process.argv.slice(2);
  const remove = args.includes('--remove');
  const list = args.includes('--list');
  const email = args.find((arg) => !arg.startsWith('--'));

  if (list) {
    const users = await User.find().select('email name role').sort({ email: 1 });
    if (users.length === 0) {
      console.log('Ainda não há utilizadores no MongoDB.');
    } else {
      console.log('Utilizadores:');
      users.forEach((u) => console.log(`  ${u.email}  →  ${u.role || 'user'}  (${u.name})`));
    }
    return;
  }

  if (!email) {
    console.log('Uso:');
    console.log('  node scripts/make-admin.js --list');
    console.log('  node scripts/make-admin.js ola@exemplo.pt');
    console.log('  node scripts/make-admin.js ola@exemplo.pt --remove');
    process.exitCode = 1;
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    console.error(`Não encontrei nenhum utilizador com o email ${email}.`);
    console.error('Entra na aplicação com essa conta uma vez e volta a tentar.');
    process.exitCode = 1;
    return;
  }

  user.role = remove ? 'user' : 'admin';
  await user.save();

  console.log(`${user.email} agora tem o papel "${user.role}".`);
  console.log('O utilizador precisa de sair e entrar outra vez (ou recarregar a página) para ver o novo papel.');
}

main()
  .catch((error) => {
    console.error('Erro:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
