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

// POST /api/auth/send-verification - Enviar email de verificação
router.post('/send-verification', verifyIdToken, async (req, res) => {
  try {
    const uid = req.user.uid;
    const admin = require('../config/firebase').admin;

    await admin.auth().sendEmailVerification(uid);

    res.json({
      message: 'Email de verificação enviado. Verifica a tua caixa de entrada.',
    });
  } catch (error) {
    console.error('Erro ao enviar email de verificação:', error.message);
    res.status(500).json({ error: 'Erro ao enviar email de verificação' });
  }
});

// POST /api/auth/reset-password - Enviar email de reset de palavra-passe
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email obrigatório' });

    const admin = require('../config/firebase').admin;
    await admin.auth().sendPasswordResetEmail(email);

    res.json({
      message: 'Email de reset de palavra-passe enviado. Verifica a tua caixa de entrada.',
    });
  } catch (error) {
    console.error('Erro ao enviar reset de palavra-passe:', error.message);
    // Firebase retorna erro se o email não existir, mas respondemos sucesso por segurança
    res.status(500).json({ error: error.message || 'Erro ao enviar reset de palavra-passe' });
  }
});

module.exports = router;