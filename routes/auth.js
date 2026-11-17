const express = require('express');
const router = express.Router();
const { verifyIdToken } = require('../config/firebase');
const User = require('../models/user');

// POST /api/auth/register - Registar com Firebase + guardar no MongoDB
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // 1. Criar usuário no Firebase Auth
    const admin = require('../config/firebase').admin;
    const userRecord = await admin.auth().createUser({ email, password });

    // 2. Guardar dados básicos no MongoDB
    const userDoc = await User.create({
      uid: userRecord.uid,
      email: userRecord.email,
      name,
    });

    res.status(201).json({
      message: 'Conta criada com sucesso',
      user: { id: userDoc._id, uid: userDoc.uid, email: userDoc.email, name: userDoc.name },
    });
  } catch (error) {
    console.error('Erro no registo:', error.message);
    res.status(400).json({ error: error.message || 'Erro ao registar utilizador' });
  }
});

// POST /api/auth/login - Login (verificar token Firebase)
router.post('/login', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Token obrigatório' });

    // Verificar token com Firebase Admin
    const decoded = await verifyIdToken(idToken);

    // Buscar ou criar utilizador no MongoDB
    let user = await User.findOne({ uid: decoded.uid });

    if (!user) {
      user = await User.create({
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name || '',
      });
    }

    res.json({
      message: 'Login bem-sucedido',
      user: { id: user._id, uid: user.uid, email: user.email, name: user.name },
    });
  } catch (error) {
    console.error('Erro no login:', error.message);
    res.status(401).json({ error: 'Token inválido' });
  }
});

module.exports = router;