const router = require('express').Router();
const auth = require('../middleware/auth.middleware');
const {
  createAgent,
  listAgents,
  getAgent,
  updateAgent,
  deleteAgent,
  runAgent,
} = require('../controllers/agent.controller');

router.use(auth);

router.post('/', createAgent);
router.get('/', listAgents);
router.get('/:id', getAgent);
router.put('/:id', updateAgent);
router.delete('/:id', deleteAgent);
router.post('/:id/run', runAgent); // NEW - playground endpoint

module.exports = router;
