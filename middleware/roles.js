const User = require('../models/user');

// Tem de ser usado depois do requireAuth (que já validou o token e preencheu req.user).
// O papel fica no MongoDB, por isso uma promoção a admin aplica-se no pedido seguinte.
const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: 'Autenticação obrigatória' });
    }

    const dbUser = await User.findOne({ uid: req.user.uid });

    if (!dbUser || dbUser.role !== 'admin') {
      return res.status(403).json({ error: 'Apenas administradores podem fazer esta ação' });
    }

    req.dbUser = dbUser;
    next();
  } catch (error) {
    console.error('Erro a verificar permissões:', error.message);
    res.status(500).json({ error: 'Erro ao verificar permissões' });
  }
};

// Admin ou o próprio dono do recurso.
const requireAdminOrOwner = (getOwnerId) => async (req, res, next) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ error: 'Autenticação obrigatória' });
    }

    const ownerId = await getOwnerId(req);

    if (ownerId === req.user.uid) return next();

    const dbUser = await User.findOne({ uid: req.user.uid });
    if (dbUser?.role === 'admin') {
      req.dbUser = dbUser;
      return next();
    }

    return res.status(403).json({ error: 'Não tens permissão para fazer esta ação' });
  } catch (error) {
    console.error('Erro a verificar permissões:', error.message);
    res.status(500).json({ error: 'Erro ao verificar permissões' });
  }
};

module.exports = { requireAdmin, requireAdminOrOwner };
