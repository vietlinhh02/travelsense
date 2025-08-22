const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const config = require('./config/config');
const routes = require('./routes');
const logger = require('./config/logger');
const { swaggerSetup } = require('./config/swagger');

const app = express();

// Connect to MongoDB
mongoose.connect(config.mongoose.url, config.mongoose.options)
  .then(() => {
    logger.info('Connected to MongoDB');
  })
  .catch((error) => {
    logger.error('MongoDB connection error:', error);
  });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors(config.cors));

// Swagger Documentation Setup
swaggerSetup(app);

// Routes
app.use('/api', routes);

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(`[${req.method}] ${req.path} - ${err.message}`);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error',
  });
});

module.exports = app;