const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Regras que permitem calcular a duração de um serviço no momento da marcação.
const regrasTempoSchema = new Schema(
  {
    tipo: { type: String, enum: ['fixo', 'por_m2', 'opcoes'], default: 'fixo' },
    tempo_base: { type: Number, min: 0, required: true },
    fator: { type: Number, min: 0 }, // minutos por m², em `por_m2`
    opcoes: { type: Map, of: Number }, // nome da opção → minutos extra
  },
  { _id: false }
);

regrasTempoSchema.pre('validate', function () {
  if (this.tipo === 'por_m2' && (this.fator === undefined || this.fator === null)) {
    this.invalidate('fator', 'O fator é obrigatório em regras por_m2');
  }
  if (this.tipo === 'opcoes') {
    const total = this.opcoes instanceof Map ? this.opcoes.size : Object.keys(this.opcoes || {}).length;
    if (total === 0) this.invalidate('opcoes', 'É preciso pelo menos uma opção');
  }
});

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
    regras_tempo: {
      type: regrasTempoSchema,
      default: () => ({ tipo: 'fixo', tempo_base: 60 }),
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);
