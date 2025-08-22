const express = require('express');
const router = express.Router();

// Authentication routes
router.use('/auth', require('./auth'));

// User routes
router.use('/users', require('./users'));

// Trip routes
router.use('/trips', require('./trips'));

// AI routes
router.use('/ai', require('./ai'));

// Search routes
router.use('/search', require('./search'));

// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'TravelSense Backend API v1'
  });
});

module.exports = router;