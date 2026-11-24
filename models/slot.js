const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Cada bloco de 15 minutos reservado por um pedido. O índice único garante
// que dois pedidos não consigam ocupar o mesmo bloco do mesmo prestador.
const slotSchema = new Schema(
  {
    prestadorId: { type: String, required: true, index: true },
    inicio: { type: Date, required: true },
    fim: { type: Date, required: true },
    pedidoId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
  },
  { timestamps: true }
);

slotSchema.index({ prestadorId: 1, inicio: 1 }, { unique: true });

module.exports = mongoose.model('Slot', slotSchema);
