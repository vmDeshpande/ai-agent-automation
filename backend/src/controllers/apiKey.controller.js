const ApiKey = require('../models/apiKey.model');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

/** List API keys for user */
async function listApiKeys(req, res) {
  try {
    const keys = await ApiKey.find({ userId: req.user._id, status: 'active' }).sort({
      createdAt: -1,
    });
    res.json({ ok: true, keys });
  } catch (err) {
    console.error('listApiKeys error', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
}

/** Create a new API key */
async function createApiKey(req, res) {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ ok: false, error: 'Key name is required' });
    }

    // Generate a secure API key string
    const rawKey = `aa_key_${crypto.randomBytes(24).toString('hex')}`;

    // Hash the key using bcrypt
    const salt = await bcrypt.genSalt(10);
    const keyHash = await bcrypt.hash(rawKey, salt);

    const apiKey = await ApiKey.create({
      keyHash,
      userId: req.user._id,
      name,
      status: 'active',
    });

    // We only return the rawKey ONCE here
    res.status(201).json({
      ok: true,
      apiKey: {
        _id: apiKey._id,
        name: apiKey.name,
        status: apiKey.status,
        createdAt: apiKey.createdAt,
      },
      rawKey,
    });
  } catch (err) {
    console.error('createApiKey error', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
}

/** Revoke API key (mark revoked) */
async function revokeApiKey(req, res) {
  try {
    const key = await ApiKey.findOne({ _id: req.params.id, userId: req.user._id });
    if (!key) {
      return res.status(404).json({ ok: false, error: 'Key not found' });
    }

    key.status = 'revoked';
    await key.save();

    res.json({ ok: true, message: 'key_revoked' });
  } catch (err) {
    console.error('revokeApiKey error', err);
    res.status(500).json({ ok: false, error: 'server_error' });
  }
}

module.exports = {
  listApiKeys,
  createApiKey,
  revokeApiKey,
};
