const express = require('express');
const router = express.Router();
const { verifyIdToken, requireAuth } = require('../config/firebase');
const User = require('../models/user');

// POST /api/auth/login - Sincroniza o utilizador do Firebase com o MongoDB.
// O registo/login acontece no browser (SDK client). Depois o frontend envia
// o idToken para aqui, e o utilizador fica guardado no MongoDB.
router.post('/login', async (req, res) => {
  try {
    const { idToken, name } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Token obrigatório' });

    const decoded = await verifyIdToken(idToken);
    // Fallback: o token pode ainda não trazer o claim "name" (ex.: logo após
    // o updateProfile). Nesse caso usamos a parte antes do @ do email, para o
    // MongoDB nunca receber um nome vazio.
    const emailPrefix = String(decoded.email || 'utilizador').split('@')[0];
    const displayName = String(name || decoded.name || emailPrefix).trim() || emailPrefix;

    // Upsert atómico: o registo e o onAuthStateChanged podem sincronizar
    // ao mesmo tempo, e assim nunca há utilizadores duplicados.
    const user = await User.findOneAndUpdate(
      { uid: decoded.uid },
      { $setOnInsert: { uid: decoded.uid, email: decoded.email, name: displayName } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Se o nome ficou vazio (token emitido antes do updateProfile),
    // completa agora com o nome que veio do browser.
    if (!user.name && displayName) {
      user.name = displayName;
      await user.save();
    }

    res.json({
      message: 'Login bem-sucedido',
      user: { id: user._id, uid: user.uid, email: user.email, name: user.name, role: user.role },
    });
  } catch (error) {
    console.error('Erro no login:', error.message);
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
});

// POST /api/auth/send-verification - Gerar link de verificação de email
// Nota: o envio real do email é feito pelo SDK client no frontend (sendEmailVerification).
router.post('/send-verification', requireAuth, async (req, res) => {
  try {
    const admin = require('../config/firebase').admin;
    const link = await admin.auth().generateEmailVerificationLink(req.user.email);

    res.json({
      message: 'Link de verificação gerado.',
      verificationLink: link,
    });
  } catch (error) {
    console.error('Erro ao gerar link de verificação:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao gerar link de verificação' });
  }
});

// POST /api/auth/reset-password - Gerar link de reset de palavra-passe
// Nota: o envio real do email é feito pelo SDK client no frontend (sendPasswordResetEmail).
router.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email obrigatório' });

    const admin = require('../config/firebase').admin;
    const link = await admin.auth().generatePasswordResetLink(email);

    res.json({
      message: 'Link de reset de palavra-passe gerado.',
      resetLink: link,
    });
  } catch (error) {
    console.error('Erro ao gerar link de reset:', error.message);
    res.status(500).json({ error: error.message || 'Erro ao gerar link de reset' });
  }
});

module.exports = router;
