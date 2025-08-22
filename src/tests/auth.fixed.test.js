const request = require('supertest');
const mongoose = require('mongoose');
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

describe('Authentication Service Test Suite', () => {
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

  afterAll(async () => {
    // Close MongoDB connection to prevent Jest from hanging
    await mongoose.connection.close();
  });

  describe(`POST ${API_BASE}/refresh - Token Refresh Endpoint`, () => {
    describe('Successful Token Refresh', () => {
      it('should successfully refresh tokens with valid refresh token in both body and cookie', async () => {
        const response = await request(app)
          .post(`${API_BASE}/refresh`)
          .set('Cookie', `refreshToken=${validRefreshToken}`)
          .send({ refreshToken: validRefreshToken })
          .expect(200);

        // Verify response structure
        expect(response.body).toHaveProperty('accessToken', 'new.access.token');
        expect(response.body.user).toEqual({
          id: mockUser._id,
          email: mockUser.email,
          role: mockUser.role
        });

        // Verify new refresh token is set in cookie
        const setCookieHeader = response.headers['set-cookie'];
        expect(setCookieHeader).toBeDefined();
        expect(setCookieHeader[0]).toContain('refreshToken=new.refresh.token');
        expect(setCookieHeader[0]).toContain('HttpOnly');
        expect(setCookieHeader[0]).toContain('Secure');
        expect(setCookieHeader[0]).toContain('SameSite=Strict');

        // Verify token rotation occurred
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
  });

  describe(`POST ${API_BASE}/revoke - Token Revoke Endpoint`, () => {
    describe('Successful Token Revocation', () => {
      it('should successfully revoke refresh token and clear cookie', async () => {
        const response = await request(app)
          .post(`${API_BASE}/revoke`)
          .set('Cookie', `refreshToken=${validRefreshToken}`)
          .send({ refreshToken: validRefreshToken })
          .expect(204);

        // Should return no content
        expect(response.body).toEqual({});

        // Verify token was blacklisted
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
  });

  describe(`GET ${API_BASE}/validate - Session Validation Endpoint`, () => {
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
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('service', 'TravelSense Backend API v1');
    });
  });
});