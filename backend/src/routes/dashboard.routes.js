const router = require('express').Router();
const auth = require('../middleware/auth.middleware');
const {
  getDashboardStats,
  getExecutionTrend,
  getLiveWorkflowStatus,
  getTokenUsage,
} = require('../controllers/dashboard.controller');
const { globalLimiter, dashboardLimiter } = require('../middleware/rateLimit.middleware');

router.use(auth);
router.get('/stats', dashboardLimiter, getDashboardStats);
router.get('/execution-trend', dashboardLimiter, getExecutionTrend);
router.get('/live-status', dashboardLimiter, getLiveWorkflowStatus);
// Issue #281 — live AI token usage analytics. Shares the
// `dashboardLimiter` window with /live-status because the dashboard
// polls both endpoints on the same client-side cadence (30s) and we
// don't want them to fight each other for rate budget.
router.get('/token-usage', dashboardLimiter, getTokenUsage);

module.exports = router;
