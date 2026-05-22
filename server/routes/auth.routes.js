const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { User } = require('../models');
const { jwtSecret, jwtExpiresIn } = require('../config/auth');
const { authMiddleware } = require('../middleware/auth');
const { roles } = require('../middleware/roles');

const router = express.Router();

const emailRule = Joi.string().email({ tlds: { allow: false } });

const loginSchema = Joi.object({
  email: emailRule.required(),
  password: Joi.string().required(),
});

const registerSchema = Joi.object({
  email: emailRule.required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().min(1).required(),
  role: Joi.string().valid('admin', 'operator', 'prompt_editor').default('operator'),
  preferred_locale: Joi.string().valid('de', 'en').default('de'),
});

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, jwtSecret, { expiresIn: jwtExpiresIn });
}

function publicUser(user) {
  const locale = user.preferred_locale === 'en' ? 'en' : 'de';
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    preferred_locale: locale,
  };
}

const profileSchema = Joi.object({
  preferred_locale: Joi.string().valid('de', 'en').required(),
});

router.post('/login', async (req, res, next) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const user = await User.findOne({ where: { email: value.email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(value.password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post('/register', authMiddleware, roles('admin'), async (req, res, next) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const existing = await User.findOne({ where: { email: value.email } });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(value.password, 10);
    const user = await User.create({
      email: value.email,
      password_hash,
      name: value.name,
      role: value.role,
      preferred_locale: value.preferred_locale,
    });

    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.patch('/me', authMiddleware, async (req, res, next) => {
  try {
    const { error, value } = profileSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    await user.update({ preferred_locale: value.preferred_locale });
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
