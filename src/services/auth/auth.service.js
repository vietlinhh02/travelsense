const jwtUtils = require('../../utils/jwt');
const User = require('../../models/users/user.model');
const { BlacklistToken } = require('../../models/auth');

class AuthService {
  /**
   * Refresh access token using valid refresh token
   * @param {string} refreshToken - The refresh token
   * @returns {Promise<Object>} New tokens and user data
   */
  async refreshToken(refreshToken) {
    try {
      // Verify token signature and expiration
      const decoded = jwtUtils.verifyToken(refreshToken, 'refresh');

      // Check token blacklist
      const isBlacklisted = await jwtUtils.isTokenBlacklisted(decoded.tokenId);
      if (isBlacklisted) {
        throw new Error('REFRESH_TOKEN_REVOKED');
      }

      // Retrieve user
      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      // Generate new tokens
      const { accessToken, refreshToken: newRefreshToken, tokenId } = jwtUtils.generateTokens(user);

      // Blacklist old token
      await jwtUtils.blacklistToken(decoded.tokenId, decoded.userId);

      return {
        accessToken,
        refreshToken: newRefreshToken,
        user: {
          id: user._id,
          email: user.email,
          role: user.role
        }
      };
    } catch (error) {
      if (error.message === 'USER_NOT_FOUND') {
        throw new Error('USER_NOT_FOUND');
      }
      if (error.message === 'REFRESH_TOKEN_REVOKED') {
        throw new Error('REFRESH_TOKEN_REVOKED');
      }
      if (error.message.includes('Token verification failed') || error.name === 'JsonWebTokenError') {
        throw new Error('INVALID_REFRESH_TOKEN');
      }
      throw error;
    }
  }

  /**
   * Revoke refresh token
   * @param {string} refreshToken - The refresh token to revoke
   * @returns {Promise<void>}
   */
  async revokeToken(refreshToken) {
    try {
      // Verify token signature (not expiration for revocation)
      const decoded = jwtUtils.verifyToken(refreshToken, 'refresh');

      // Retrieve user to validate token
      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new Error('TOKEN_NOT_FOUND');
      }

      // Blacklist the token
      await jwtUtils.blacklistToken(decoded.tokenId, decoded.userId);
    } catch (error) {
      if (error.message === 'TOKEN_NOT_FOUND') {
        throw new Error('TOKEN_NOT_FOUND');
      }
      if (error.message.includes('Token verification failed') || error.name === 'JsonWebTokenError') {
        throw new Error('INVALID_REFRESH_TOKEN');
      }
      throw error;
    }
  }

  /**
   * Validate session with access token
   * @param {string} accessToken - The access token to validate
   * @returns {Promise<Object>} User data if valid
   */
  async validateSession(accessToken) {
    try {
      // Verify token signature and expiration
      const decoded = jwtUtils.verifyToken(accessToken, 'access');

      // Retrieve user
      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      return {
        valid: true,
        user: {
          id: user._id,
          email: user.email,
          role: user.role
        }
      };
    } catch (error) {
      if (error.message === 'USER_NOT_FOUND') {
        throw new Error('USER_NOT_FOUND');
      }
      if (error.message.includes('Token verification failed') || error.name === 'JsonWebTokenError') {
        throw new Error('INVALID_ACCESS_TOKEN');
      }
      throw error;
    }
  }

  /**
   * Validate token format and presence
   * @param {string} bodyToken - Token from request body
   * @param {string} cookieToken - Token from cookie
   * @returns {string} Validated token
   */
  validateTokens(bodyToken, cookieToken) {
    if (!bodyToken || !cookieToken) {
      throw new Error('TOKENS_REQUIRED');
    }

    if (bodyToken !== cookieToken) {
      throw new Error('TOKEN_MISMATCH');
    }

    return bodyToken;
  }
}

module.exports = new AuthService();