const express = require('express');
const router = express.Router();
const { requireAuth } = require('../config/firebase');
const User = require('../models/user');

// PUT /api/profile - Editar o nome do utilizador.
// O email não é editável aqui de propósito: mudar o email no Firebase Admin
// volta a marcar a conta como "não verificada" e obriga a um novo fluxo de
// verificação. Para já o email fica fixo.
router.put('/', requireAuth, async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();

    if (!name) {
      return res.status(400).json({ error: 'O nome não pode ficar vazio' });
    }

    const admin = require('../config/firebase').admin;
    await admin.auth().updateUser(req.user.uid, { displayName: name });

    const user = await User.findOneAndUpdate(
      { uid: req.user.uid },
      {
        $set: { name },
        $setOnInsert: { email: req.user.email },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({
      message: 'Perfil atualizado com sucesso',
      user: { id: user._id, uid: user.uid, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error.message);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

module.exports = router;
