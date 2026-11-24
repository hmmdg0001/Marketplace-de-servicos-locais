const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Avisos globais por utilizador (novos pedidos e mensagens de pedidos).
const notificationSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    tipo: { type: String, enum: ['pedido', 'mensagem'], required: true },
    titulo: { type: String, required: true },
    texto: { type: String, required: true },
    pedidoId: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    lida: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
