const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const reviewSchema = new Schema(
  {
    pedidoId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, unique: true },
    servicoId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    clienteId: { type: String, required: true, index: true },
    prestadorId: { type: String, required: true, index: true },
    classificacao: { type: Number, required: true, min: 1, max: 5 },
    comentario: { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Review', reviewSchema);
