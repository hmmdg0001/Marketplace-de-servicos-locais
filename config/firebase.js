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

module.exports = { initializeFirebase, verifyIdToken, admin };