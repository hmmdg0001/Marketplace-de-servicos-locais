const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const categorySchema = new Schema(
  {
    nome: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    descricao: { type: String, default: '' },
    icone: { type: String, default: '•' },
    ordem: { type: Number, default: 0 },
    ativa: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Category', categorySchema);
