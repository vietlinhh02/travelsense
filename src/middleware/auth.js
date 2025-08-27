const jwt = require('jsonwebtoken');
const config = require('../config/config');

/**
 * Authentication middleware
 * @param {string|string[]} requiredRoles - Required roles to access the route
 */
const auth = (requiredRoles = []) => {
  return async (req, res, next) => {
    try {
      // Get token from header
      const token = req.header('Authorization')?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Access denied. No token provided.'
        });
      }

      // Verify token
      const decoded = jwt.verify(token, config.jwt.accessTokenSecret);
      req.user = decoded;

      // Check role if required
      if (requiredRoles.length > 0) {
        const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
        const hasRequiredRole = requiredRoles.some(role => userRoles.includes(role));

        if (!hasRequiredRole) {
          return res.status(403).json({
            success: false,
            message: 'Access denied. Insufficient permissions.'
          });
        }
      }

      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      } else if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      } else {
        return res.status(500).json({
          success: false,
          message: 'Authentication error',
          error: error.message
        });
      }
    }
  };
};

module.exports = auth;
