const express = require('express');
const router = express.Router();

// AI Provider Management
router.use('/ai-provider', require('./aiProvider'));

module.exports = router;
