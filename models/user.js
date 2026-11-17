const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  uid: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  telefone: { type: String, default: '' },
  cidade: { type: String, default: '' },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  isDemo: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('User', userSchema);