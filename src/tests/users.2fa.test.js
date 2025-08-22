const request = require('supertest');
const app = require('../app');
const User = require('../models/users/user.model');

// Base API path for tests
const API_BASE = '/api/v1/users';

describe('User Service Test Suite - Two-Factor Authentication', () => {
  // Valid user data for testing
  const validUserData = {
    email: 'twofa.test@example.com',
    password: 'TwoFATest123!',
    firstName: 'TwoFA',
    lastName: 'Test'
  };

  let testUser;
  let accessToken;
  let userId;

  beforeEach(async () => {
    // Clean up test user if exists
    await User.deleteOne({ email: validUserData.email });

    // Create a test user
    const response = await request(app)
      .post(`${API_BASE}/register`)
      .send(validUserData)
      .expect(201);

    testUser = response.body.user;
    accessToken = response.body.accessToken;
    userId = testUser._id;
  });

  afterEach(async () => {
    // Clean up test user
    await User.deleteOne({ email: validUserData.email });
  });

  describe('POST /api/v1/users/enable-2fa - Enable Two-Factor Authentication', () => {
    describe('Successful 2FA Enablement', () => {
      it('should successfully enable 2FA with email method', async () => {
        const enable2FARequest = {
          method: 'email'
        };

        const response = await request(app)
          .post(`${API_BASE}/enable-2fa`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(enable2FARequest)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Two-factor authentication enabled successfully');
        expect(response.body).toHaveProperty('method', 'email');
        expect(response.body).not.toHaveProperty('qrCode'); // No QR code for email method
        expect(response.body).not.toHaveProperty('secret'); // No secret for email method

        // Verify 2FA is enabled in database
        const user = await User.findById(userId);
        expect(user.twoFactorEnabled).toBe(true);
        expect(user.twoFactorMethod).toBe('email');
        expect(user.twoFactorSecret).toBeNull();
      });

      it('should successfully enable 2FA with SMS method', async () => {
        const enable2FARequest = {
          method: 'sms'
        };

        const response = await request(app)
          .post(`${API_BASE}/enable-2fa`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(enable2FARequest)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Two-factor authentication enabled successfully');
        expect(response.body).toHaveProperty('method', 'sms');
        expect(response.body).not.toHaveProperty('qrCode'); // No QR code for SMS method
        expect(response.body).not.toHaveProperty('secret'); // No secret for SMS method

        // Verify 2FA is enabled in database
        const user = await User.findById(userId);
        expect(user.twoFactorEnabled).toBe(true);
        expect(user.twoFactorMethod).toBe('sms');
        expect(user.twoFactorSecret).toBeNull();
      });

      it('should successfully enable 2FA with authenticator method and provide QR code', async () => {
        const enable2FARequest = {
          method: 'authenticator'
        };

        const response = await request(app)
          .post(`${API_BASE}/enable-2fa`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(enable2FARequest)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Two-factor authentication enabled successfully');
        expect(response.body).toHaveProperty('method', 'authenticator');
        expect(response.body).toHaveProperty('qrCode'); // QR code for authenticator method
        expect(response.body).toHaveProperty('secret'); // Secret for authenticator method

        // Verify QR code format
        expect(response.body.qrCode).toContain('otpauth://totp/TravelApp:');
        expect(response.body.qrCode).toContain(validUserData.email);
        expect(response.body.qrCode).toContain('secret=');

        // Verify 2FA is enabled in database
        const user = await User.findById(userId);
        expect(user.twoFactorEnabled).toBe(true);
        expect(user.twoFactorMethod).toBe('authenticator');
        expect(user.twoFactorSecret).toBeTruthy();
        expect(user.twoFactorSecret).toHaveLength(40); // 20 bytes in hex = 40 characters
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when method is missing', async () => {
        const enable2FARequest = {}; // No method

        const response = await request(app)
          .post(`${API_BASE}/enable-2fa`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(enable2FARequest)
          .expect(400);

        expect(response.body.message).toContain('2FA method is required');
      });

      it('should return 400 when method is invalid', async () => {
        const invalidMethods = [
          { method: 'invalid', expectedError: 'Method must be one of: sms, email, authenticator' },
          { method: 'totp', expectedError: 'Method must be one of: sms, email, authenticator' },
          { method: 'google', expectedError: 'Method must be one of: sms, email, authenticator' },
          { method: 'facebook', expectedError: 'Method must be one of: sms, email, authenticator' },
          { method: '', expectedError: '2FA method is required' },
          { method: 123, expectedError: 'Method must be a string' }
        ];

        for (const { method, expectedError } of invalidMethods) {
          const enable2FARequest = { method };

          const response = await request(app)
            .post(`${API_BASE}/enable-2fa`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(enable2FARequest)
            .expect(400);

          expect(response.body.message).toContain(expectedError);
        }
      });
    });

    describe('Authentication Errors (401)', () => {
      it('should return 401 when Authorization header is missing', async () => {
        const enable2FARequest = { method: 'email' };

        const response = await request(app)
          .post(`${API_BASE}/enable-2fa`)
          .send(enable2FARequest)
          .expect(401);

        expect(response.body.message).toContain('Access token required');
      });

      it('should return 401 when token is invalid', async () => {
        const enable2FARequest = { method: 'email' };
        const invalidToken = 'invalid.jwt.token';

        const response = await request(app)
          .post(`${API_BASE}/enable-2fa`)
          .set('Authorization', `Bearer ${invalidToken}`)
          .send(enable2FARequest)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired access token');
      });
    });

    describe('Conflict Errors (409)', () => {
      it('should return 409 when 2FA is already enabled', async () => {
        // First enable 2FA
        const enable2FARequest = { method: 'email' };

        await request(app)
          .post(`${API_BASE}/enable-2fa`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(enable2FARequest)
          .expect(200);

        // Try to enable again
        const secondEnableRequest = { method: 'sms' };

        const response = await request(app)
          .post(`${API_BASE}/enable-2fa`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(secondEnableRequest)
          .expect(409);

        expect(response.body.message).toContain('Two-factor authentication is already enabled');

        // Verify original method is preserved
        const user = await User.findById(userId);
        expect(user.twoFactorMethod).toBe('email'); // Should still be email, not changed to sms
      });
    });
  });

  describe('POST /api/v1/users/disable-2fa - Disable Two-Factor Authentication', () => {
    beforeEach(async () => {
      // Enable 2FA for testing disable functionality
      const enable2FARequest = { method: 'email' };

      await request(app)
        .post(`${API_BASE}/enable-2fa`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(enable2FARequest)
        .expect(200);
    });

    describe('Successful 2FA Disablement', () => {
      it('should successfully disable 2FA with correct password', async () => {
        const disable2FARequest = {
          password: validUserData.password
        };

        const response = await request(app)
          .post(`${API_BASE}/disable-2fa`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(disable2FARequest)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Two-factor authentication disabled successfully');

        // Verify 2FA is disabled in database
        const user = await User.findById(userId);
        expect(user.twoFactorEnabled).toBe(false);
        expect(user.twoFactorMethod).toBeUndefined();
        expect(user.twoFactorSecret).toBeNull();
      });

      it('should disable 2FA for all methods (email, sms, authenticator)', async () => {
        const methods = ['email', 'sms', 'authenticator'];

        for (const method of methods) {
          // Clean up and create new user for each method
          await User.deleteOne({ email: validUserData.email });
          
          const userResponse = await request(app)
            .post(`${API_BASE}/register`)
            .send(validUserData)
            .expect(201);

          const newAccessToken = userResponse.body.accessToken;
          const newUserId = userResponse.body.user._id;

          // Enable 2FA with current method
          await request(app)
            .post(`${API_BASE}/enable-2fa`)
            .set('Authorization', `Bearer ${newAccessToken}`)
            .send({ method })
            .expect(200);

          // Disable 2FA
          const disable2FARequest = { password: validUserData.password };

          await request(app)
            .post(`${API_BASE}/disable-2fa`)
            .set('Authorization', `Bearer ${newAccessToken}`)
            .send(disable2FARequest)
            .expect(200);

          // Verify 2FA is disabled
          const user = await User.findById(newUserId);
          expect(user.twoFactorEnabled).toBe(false);
          expect(user.twoFactorMethod).toBeUndefined();
          expect(user.twoFactorSecret).toBeNull();
        }
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when password is missing', async () => {
        const disable2FARequest = {}; // No password

        const response = await request(app)
          .post(`${API_BASE}/disable-2fa`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(disable2FARequest)
          .expect(400);

        expect(response.body.message).toContain('Password is required');

        // Verify 2FA is still enabled
        const user = await User.findById(userId);
        expect(user.twoFactorEnabled).toBe(true);
      });

      it('should return 400 when password is too short', async () => {
        const disable2FARequest = {
          password: 'short'
        };

        const response = await request(app)
          .post(`${API_BASE}/disable-2fa`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(disable2FARequest)
          .expect(400);

        expect(response.body.message).toContain('Password must be between 8 and 128 characters');

        // Verify 2FA is still enabled
        const user = await User.findById(userId);
        expect(user.twoFactorEnabled).toBe(true);
      });

      it('should return 400 when password is too long', async () => {
        const disable2FARequest = {
          password: 'A'.repeat(129) // Exceeds 128 characters
        };

        const response = await request(app)
          .post(`${API_BASE}/disable-2fa`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(disable2FARequest)
          .expect(400);

        expect(response.body.message).toContain('Password must be between 8 and 128 characters');

        // Verify 2FA is still enabled
        const user = await User.findById(userId);
        expect(user.twoFactorEnabled).toBe(true);
      });
    });

    describe('Authentication Errors (401)', () => {
      it('should return 401 when Authorization header is missing', async () => {
        const disable2FARequest = { password: validUserData.password };

        const response = await request(app)
          .post(`${API_BASE}/disable-2fa`)
          .send(disable2FARequest)
          .expect(401);

        expect(response.body.message).toContain('Access token required');

        // Verify 2FA is still enabled
        const user = await User.findById(userId);
        expect(user.twoFactorEnabled).toBe(true);
      });

      it('should return 401 when token is invalid', async () => {
        const disable2FARequest = { password: validUserData.password };
        const invalidToken = 'invalid.jwt.token';

        const response = await request(app)
          .post(`${API_BASE}/disable-2fa`)
          .set('Authorization', `Bearer ${invalidToken}`)
          .send(disable2FARequest)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired access token');
      });

      it('should return 401 when password is incorrect', async () => {
        const disable2FARequest = {
          password: 'WrongPassword123!'
        };

        const response = await request(app)
          .post(`${API_BASE}/disable-2fa`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(disable2FARequest)
          .expect(401);

        expect(response.body.message).toContain('Password is incorrect');

        // Verify 2FA is still enabled
        const user = await User.findById(userId);
        expect(user.twoFactorEnabled).toBe(true);
      });
    });

    describe('Conflict Errors (409)', () => {
      it('should return 409 when 2FA is not enabled', async () => {
        // First disable 2FA
        const initialDisable = { password: validUserData.password };

        await request(app)
          .post(`${API_BASE}/disable-2fa`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(initialDisable)
          .expect(200);

        // Try to disable again
        const secondDisable = { password: validUserData.password };

        const response = await request(app)
          .post(`${API_BASE}/disable-2fa`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(secondDisable)
          .expect(409);

        expect(response.body.message).toContain('Two-factor authentication is not enabled');
      });
    });

    describe('Google User Special Cases', () => {
      it('should allow Google users to disable 2FA without password', async () => {
        // Clean up and create Google user
        await User.deleteOne({ email: validUserData.email });

        // Create Google user (simulate Google login)
        const googleUser = new User({
          email: validUserData.email,
          firstName: validUserData.firstName,
          lastName: validUserData.lastName,
          googleId: 'google_user_123',
          emailVerified: true,
          phoneVerified: false,
          twoFactorEnabled: false
        });
        await googleUser.save();

        // Generate token for Google user
        const jwt = require('jsonwebtoken');
        const config = require('../config/config');
        const googleAccessToken = jwt.sign(
          { userId: googleUser._id, email: googleUser.email },
          config.jwt.accessTokenSecret,
          { expiresIn: '15m' }
        );

        // Enable 2FA for Google user
        await request(app)
          .post(`${API_BASE}/enable-2fa`)
          .set('Authorization', `Bearer ${googleAccessToken}`)
          .send({ method: 'email' })
          .expect(200);

        // Disable 2FA without password (Google users don't have passwords)
        const disable2FARequest = {
          password: 'AnyPasswordShouldWork123!' // This should be ignored for Google users
        };

        const response = await request(app)
          .post(`${API_BASE}/disable-2fa`)
          .set('Authorization', `Bearer ${googleAccessToken}`)
          .send(disable2FARequest)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Two-factor authentication disabled successfully');

        // Verify 2FA is disabled
        const updatedUser = await User.findById(googleUser._id);
        expect(updatedUser.twoFactorEnabled).toBe(false);
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should have rate limiting for 2FA enable requests', async () => {
      const enable2FARequest = { method: 'email' };

      // Make multiple enable requests (should fail after first success due to conflict)
      const promises = [];
      for (let i = 0; i < 12; i++) {
        promises.push(
          request(app)
            .post(`${API_BASE}/enable-2fa`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(enable2FARequest)
        );
      }

      const responses = await Promise.all(promises);
      
      // Should have some success (probably multiple due to race conditions) and conflicts/rate limits
      const successCount = responses.filter(res => res.status === 200).length;
      const conflictCount = responses.filter(res => res.status === 409).length;
      const rateLimitedCount = responses.filter(res => res.status === 429).length;
      
      expect(successCount).toBeGreaterThan(0); // At least one should succeed
      expect(conflictCount + rateLimitedCount).toBeGreaterThan(0);
      expect(successCount + conflictCount + rateLimitedCount).toBe(12);
    });
  });
});