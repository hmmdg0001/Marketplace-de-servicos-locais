const express = require('express');
const router = express.Router();
const { requireAuth } = require('../config/firebase');
const User = require('../models/user');

// PUT /api/profile - Editar perfil do utilizador
router.put('/', requireAuth, async (req, res) => {
  try {
    const { name, email } = req.body;
    const uid = req.user.uid;

    if (!name && !email) {
      return res.status(400).json({ error: 'Pelo menos um campo (name ou email) é obrigatório' });
    }

    // 1. Atualizar no Firebase Auth
    const admin = require('../config/firebase').admin;
    const updateData = {};
    if (name) updateData.displayName = name;
    if (email) updateData.email = email;

    await admin.auth().updateUser(uid, updateData);

    // 2. Atualizar no MongoDB
    let user = await User.findOne({ uid });

    if (user) {
      if (name) user.name = name;
      if (email) user.email = email;
      await user.save();
    } else {
      user = await User.create({ uid, name, email });
    }

    res.json({
      message: 'Perfil atualizado com sucesso',
      user: { id: user._id, uid: user.uid, email: user.email, name: user.name },
    });
  } catch (error) {
    console.error('Erro ao atualizar perfil:', error.message);
    res.status(500).json({ error: 'Erro ao atualizar perfil' });
  }
});

module.exports = router;