const express = require('express');
const validate = require('../../../middleware/validate');
const auth = require('../../../middleware/auth');
const { aiProviderController } = require('../../../controllers/ai');
const { aiProviderValidation } = require('../../../validations');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(auth('admin'));

/**
 * @route GET /api/v1/admin/ai-provider/status
 * @desc Get current AI provider status and configuration
 * @access Admin only
 */
router.get('/status', aiProviderController.getProviderStatus);

/**
 * @route POST /api/v1/admin/ai-provider/switch
 * @desc Switch AI provider at runtime
 * @access Admin only
 */
router.post('/switch', 
  validate(aiProviderValidation.switchProvider), 
  aiProviderController.switchProvider
);

/**
 * @route POST /api/v1/admin/ai-provider/test
 * @desc Test AI provider with simple request
 * @access Admin only
 */
router.post('/test', 
  validate(aiProviderValidation.testProvider), 
  aiProviderController.testProvider
);

/**
 * @route POST /api/v1/admin/ai-provider/test-structured
 * @desc Test structured output capabilities
 * @access Admin only
 */
router.post('/test-structured', aiProviderController.testStructuredOutput);

module.exports = router;
