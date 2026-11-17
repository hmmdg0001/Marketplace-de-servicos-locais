const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const serviceSchema = new Schema(
  {
    prestadorId: { type: String, required: true, index: true },
    categoriaId: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    titulo: { type: String, required: true },
    descricao: { type: String, default: '' },
    preco: { type: Number, default: 0, min: 0 },
    zona: { type: String, default: '', index: true },
    ativo: { type: Boolean, default: true, index: true },
    imagens: { type: [String], default: [] },
    isSeed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);
