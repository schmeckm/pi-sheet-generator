/**
 * JWT configuration from environment variables.
 */
const jwtSecret = process.env.JWT_SECRET;
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';

if (!jwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set when NODE_ENV=production');
}

if (!jwtSecret) {
  console.warn('[auth] JWT_SECRET not set — using development fallback. Set JWT_SECRET in .env');
}

module.exports = {
  jwtSecret: jwtSecret || 'dev-secret-change-me',
  jwtExpiresIn,
};
