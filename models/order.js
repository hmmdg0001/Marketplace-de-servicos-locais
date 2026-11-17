const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ESTADOS = [
  'Submetido',
  'Aceite',
  'Em execução',
  'Aguarda confirmação',
  'Concluído',
  'Recusado',
  'Cancelado',
];

// Cada mudança de estado fica registada com o estado anterior, o novo estado,
// o autor e a data (requisito não funcional do relatório).
const historicoSchema = new Schema(
  {
    de: { type: String, default: null },
    para: { type: String, required: true },
    autorId: { type: String, required: true },
    autorNome: { type: String, default: '' },
    nota: { type: String, default: '' },
    data: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new Schema(
  {
    servicoId: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    clienteId: { type: String, required: true, index: true },
    prestadorId: { type: String, required: true, index: true },
    descricao: { type: String, required: true },
    dataDesejada: { type: Date, required: true },
    morada: { type: String, required: true },
    preco: { type: Number, default: 0, min: 0 },
    estado: { type: String, enum: ESTADOS, default: 'Submetido', index: true },
    historico: { type: [historicoSchema], default: [] },
  },
  { timestamps: true }
);

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
module.exports.ESTADOS = ESTADOS;
