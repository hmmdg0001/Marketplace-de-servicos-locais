const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Mensagens trocadas entre o cliente e o prestador dentro de um pedido.
const messageSchema = new Schema(
  {
    pedidoId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    remetenteUid: { type: String, required: true, index: true },
    texto: { type: String, required: true, trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
