const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB ligado: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Erro na ligação ao MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;