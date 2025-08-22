const { body } = require('express-validator');

// Validation for token refresh endpoint
const refreshTokenValidation = [
  body('refreshToken')
    .notEmpty().withMessage('Refresh token required')
    .isLength({ max: 2048 }).withMessage('Token too long')
];

// Validation for token revoke endpoint
const revokeTokenValidation = [
  body('refreshToken')
    .notEmpty().withMessage('Refresh token required')
    .isLength({ max: 2048 }).withMessage('Token too long')
];

// Custom validation for Authorization header (for validate endpoint)
const validateAuthHeader = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({ 
      message: 'Access token required'
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ 
      message: 'Invalid token format'
    });
  }

  if (!parts[1] || parts[1].length === 0) {
    return res.status(401).json({ 
      message: 'Access token is required'
    });
  }

  if (parts[1].length > 2048) {
    return res.status(401).json({ 
      message: 'Token too long'
    });
  }

  next();
};

module.exports = {
  refreshTokenValidation,
  revokeTokenValidation,
  validateAuthHeader
};