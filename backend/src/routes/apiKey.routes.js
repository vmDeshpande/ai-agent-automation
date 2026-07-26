const router = require('express').Router();
const authMiddleware = require('../middleware/auth.middleware');
const { listApiKeys, createApiKey, revokeApiKey } = require('../controllers/apiKey.controller');

router.use(authMiddleware);

router.get('/', listApiKeys);
router.post('/', createApiKey);
router.delete('/:id', revokeApiKey);

module.exports = router;
