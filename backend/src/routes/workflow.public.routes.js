const router = require('express').Router();
const { receivePublicWorkflowCall } = require('../controllers/workflowApi.public.controller');

// Public endpoints, authorization is handled inside the controller if enabled on the workflow
router.post('/:idOrSlug', receivePublicWorkflowCall);

module.exports = router;
