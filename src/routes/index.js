const express = require('express');
const router = express.Router();

// API versioning
router.use('/v1', require('./v1'));


module.exports = router;