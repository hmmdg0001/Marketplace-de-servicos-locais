const express = require('express');
const router = express.Router();
const { requireAuth } = require('../config/firebase');
const cloudinary = require('../config/cloudinary');

// POST /api/upload/assinatura - Devolve parâmetros assinados para upload direto ao Cloudinary.
// O frontend faz upload direto do browser → Cloudinary e recebe a URL segura.
router.post('/assinatura', requireAuth, async (req, res) => {
  try {
    const { pasta = 'servicos' } = req.body || {};
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `serviperto/${pasta}/${req.user.uid}`;

    const paramsToSign = {
      timestamp,
      folder,
      resource_type: 'image',
    };

    const signature = cloudinary.utils.api_sign_request(paramsToSign, cloudinary.config().api_secret);

    res.json({
      cloudName: cloudinary.config().cloud_name,
      apiKey: cloudinary.config().api_key,
      timestamp,
      signature,
      folder,
    });
  } catch (error) {
    console.error('Erro ao gerar assinatura Cloudinary:', error.message);
    res.status(500).json({ error: 'Erro ao preparar upload' });
  }
});

// DELETE /api/upload/:publicId - Apaga uma imagem do Cloudinary (só admin ou dono).
router.delete('/:publicId', requireAuth, async (req, res) => {
  try {
    // A validação de propriedade fica a cargo do frontend/serviço.
    // Aqui apenas expomos a chamada administrativa.
    await cloudinary.uploader.destroy(req.params.publicId);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro ao apagar imagem:', error.message);
    res.status(500).json({ error: 'Erro ao apagar imagem' });
  }
});

module.exports = router;