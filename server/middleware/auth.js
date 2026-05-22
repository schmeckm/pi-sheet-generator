const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');
const { User } = require('../models');

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, jwtSecret);
    const user = await User.findByPk(payload.sub, {
      attributes: ['id', 'email', 'name', 'role', 'preferred_locale'],
    });
    if (!user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = user.toJSON();
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authMiddleware };
