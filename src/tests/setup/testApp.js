const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const config = require('../../config/config');
const routes = require('../../routes');
const logger = require('../../config/logger');
const { swaggerSetup } = require('../../config/swagger');

const createTestApp = () => {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(cors(config.cors));

  // Swagger Documentation Setup (optional in tests)
  if (process.env.NODE_ENV !== 'test') {
    swaggerSetup(app);
  }

  // Routes
  app.use('/api', routes);

  // Error handling middleware
  app.use((err, req, res, next) => {
    logger.error(`[${req.method}] ${req.path} - ${err.message}`);
    res.status(err.status || 500).json({
      message: err.message || 'Internal Server Error',
    });
  });

  return app;
};

module.exports = createTestApp;