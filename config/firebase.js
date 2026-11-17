const admin = require('firebase-admin');

const initializeFirebase = () => {
  try {
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
      console.log('Firebase Admin SDK inicializado');
    }
    return admin;
  } catch (error) {
    console.error('Erro ao inicializar Firebase:', error.message);
    throw error;
  }
};

const verifyIdToken = async (idToken) => {
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Token inválido:', error.message);
    throw error;
  }
};

// Middleware Express para proteger rotas
const requireAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'Token de autenticação obrigatório' });
    }

    const decoded = await admin.auth().verifyIdToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Falha na autenticação:', error.message);
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

module.exports = { initializeFirebase, verifyIdToken, requireAuth, admin };