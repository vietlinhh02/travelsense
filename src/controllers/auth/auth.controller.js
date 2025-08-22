const { authService } = require('../../services/auth');
const { validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

// Rate limiter configuration
const refreshLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' ? 1000 : 5, // Higher limit for testing
  message: { message: 'Too many refresh requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false
});

const refreshToken = async (req, res) => {
  // Apply rate limiting
  refreshLimiter(req, res, async () => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        const firstError = errors.array()[0];
        return res.status(400).json({ message: firstError.msg });
      }

      const { refreshToken: bodyToken } = req.body;
      const cookieToken = req.cookies.refreshToken;

      try {
        // Validate tokens
        const validToken = authService.validateTokens(bodyToken, cookieToken);

        // Refresh token using service
        const result = await authService.refreshToken(validToken);

        // Set new refresh token in HTTP-only cookie
        res.cookie('refreshToken', result.refreshToken, {
          httpOnly: true,
          secure: true,
          sameSite: 'Strict',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Return new access token and user info
        res.status(200).json({
          accessToken: result.accessToken,
          user: result.user
        });
      } catch (serviceError) {
        switch (serviceError.message) {
          case 'TOKENS_REQUIRED':
            return res.status(400).json({ message: 'Refresh token required in both body and cookie' });
          case 'TOKEN_MISMATCH':
            return res.status(400).json({ message: 'Token mismatch between body and cookie' });
          case 'INVALID_REFRESH_TOKEN':
            return res.status(401).json({ message: 'Invalid or expired refresh token' });
          case 'REFRESH_TOKEN_REVOKED':
            return res.status(401).json({ message: 'Refresh token revoked' });
          case 'USER_NOT_FOUND':
            return res.status(404).json({ message: 'User not found' });
          default:
            throw serviceError;
        }
      }
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  });
};

const revokeToken = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return res.status(400).json({ message: firstError.msg });
    }

    const { refreshToken: bodyToken } = req.body;
    const cookieToken = req.cookies.refreshToken;

    try {
      // Validate tokens
      const validToken = authService.validateTokens(bodyToken, cookieToken);

      // Revoke token using service
      await authService.revokeToken(validToken);

      // Clear refresh token cookie
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict'
      });

      // Return 204 No Content
      res.status(204).end();
    } catch (serviceError) {
      switch (serviceError.message) {
        case 'TOKENS_REQUIRED':
          return res.status(400).json({ message: 'Refresh token required in both body and cookie' });
        case 'TOKEN_MISMATCH':
          return res.status(400).json({ message: 'Token mismatch between body and cookie' });
        case 'INVALID_REFRESH_TOKEN':
          return res.status(401).json({ message: 'Invalid refresh token' });
        case 'TOKEN_NOT_FOUND':
          return res.status(404).json({ message: 'Refresh token not found' });
        default:
          throw serviceError;
      }
    }
  } catch (error) {
    console.error('Revoke token error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

const validateSession = async (req, res) => {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ message: 'Access token required' });
    }

    // Check Bearer format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ message: 'Invalid token format' });
    }

    const accessToken = parts[1];

    try {
      // Validate session using service
      const result = await authService.validateSession(accessToken);

      res.status(200).json(result);
    } catch (serviceError) {
      switch (serviceError.message) {
        case 'INVALID_ACCESS_TOKEN':
          return res.status(401).json({ message: 'Invalid or expired access token' });
        case 'USER_NOT_FOUND':
          return res.status(401).json({ message: 'User not found' });
        default:
          throw serviceError;
      }
    }
  } catch (error) {
    console.error('Validate session error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  refreshToken,
  revokeToken,
  validateSession
};