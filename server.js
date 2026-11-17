require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { initializeFirebase } = require('./config/firebase');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

connectDB();
initializeFirebase();

// Rotas da API
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/services', require('./routes/services'));

// Rota raiz
app.get('/', (req, res) => {
  res.json({ message: 'Marketplace de Serviços Locais API' });
});

app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});