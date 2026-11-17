const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Perfil do prestador (Figura 2 do relatório).
// A existência deste documento é o que faz de um utilizador prestador:
// qualquer conta pode ativar o modo prestador e publicar serviços.
const providerProfileSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    bio: { type: String, default: '' },
    zona: { type: String, default: '' },
    mediaAvaliacoes: { type: Number, default: 0, min: 0, max: 5 },
    totalAvaliacoes: { type: Number, default: 0, min: 0 },
    isDemo: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ProviderProfile', providerProfileSchema);
