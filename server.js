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

app.get('/', (req, res) => {
  res.json({ message: 'Marketplace de Serviços Locais API' });
});

app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});