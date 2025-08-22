const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config/config');
const routes = require('./routes');
const logger = require('./config/logger');
const { swaggerSetup } = require('./config/swagger');

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'X-Total-Count'],
  maxAge: 86400 // 24 hours
}));

// Request logging
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Body parsing middleware with error handling
app.use(express.json({
  limit: '10mb'
}));
app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));

// Cookie parser
app.use(cookieParser());

// Connect to MongoDB with improved error handling (only if not in test environment)
if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(config.mongoose.url, {
    ...config.mongoose.options,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
    minPoolSize: 5,
    maxIdleTimeMS: 30000
  })
    .then(() => {
      logger.info(`Connected to MongoDB at ${config.mongoose.url}`);
      logger.info(`MongoDB connection state: ${mongoose.connection.readyState}`);
    })
    .catch((error) => {
      logger.error('MongoDB connection error:', {
        error: error.message,
        stack: error.stack,
        url: config.mongoose.url
      });
    });

  // Handle MongoDB connection events
  mongoose.connection.on('connected', () => {
    logger.info('MongoDB connected successfully');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', {
      error: err.message,
      stack: err.stack
    });
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
}

// Swagger Documentation Setup
swaggerSetup(app);

// Routes
app.use('/api', routes);

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  // Log detailed error information
  logger.error('Request Error:', {
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    headers: {
      'user-agent': req.get('User-Agent'),
      'content-type': req.get('Content-Type'),
      'authorization': req.get('Authorization') ? '[REDACTED]' : undefined
    },
    error: {
      message: err.message,
      stack: err.stack,
      code: err.code,
      status: err.status
    },
    timestamp: new Date().toISOString(),
    requestId: req.headers['x-request-id'] || 'unknown'
  });

  // Handle specific error types
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      message: 'Invalid JSON format in request body',
      error: 'MALFORMED_JSON',
      timestamp: new Date().toISOString()
    });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      message: 'Request payload too large',
      error: 'PAYLOAD_TOO_LARGE',
      timestamp: new Date().toISOString()
    });
  }

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      error: 'VALIDATION_ERROR',
      details: err.errors,
      timestamp: new Date().toISOString()
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized access',
      error: 'UNAUTHORIZED',
      timestamp: new Date().toISOString()
    });
  }

  // Default error response
  const statusCode = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    success: false,
    message: isProduction && statusCode === 500 ? 'Internal Server Error' : err.message,
    error: err.code || 'INTERNAL_ERROR',
    ...(isProduction ? {} : { stack: err.stack }),
    timestamp: new Date().toISOString()
  });
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`, {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString()
  });

  res.status(404).json({
    success: false,
    message: 'Route not found',
    error: 'NOT_FOUND',
    availableEndpoints: {
      docs: '/api-docs',
      health: '/health'
    },
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    mongodb: {
      connected: mongoose.connection.readyState === 1,
      state: mongoose.connection.readyState
    }
  });
});

module.exports = app;