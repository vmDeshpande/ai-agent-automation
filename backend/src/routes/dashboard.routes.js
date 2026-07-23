const router = require('express').Router();
const auth = require('../middleware/auth.middleware');
const {
  getDashboardStats,
  getExecutionTrend,
  getLiveWorkflowStatus,
} = require('../controllers/dashboard.controller');
const { globalLimiter, dashboardLimiter } = require('../middleware/rateLimit.middleware');

router.use(auth);
router.get('/stats', dashboardLimiter, getDashboardStats);
router.get('/execution-trend', dashboardLimiter, getExecutionTrend);
router.get('/live-status', dashboardLimiter, getLiveWorkflowStatus);

module.exports = router;
