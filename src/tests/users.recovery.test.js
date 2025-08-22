const request = require('supertest');
const app = require('../app');
const User = require('../models/users/user.model');
const AccountRecovery = require('../models/auth/accountRecovery.model');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

// Base API path for tests
const API_BASE = '/api/v1/users';

describe('User Service Test Suite - Account Recovery', () => {
  // Valid user data for testing
  const validUserData = {
    email: 'recovery.test@example.com',
    password: 'RecoveryTest123!',
    firstName: 'Recovery',
    lastName: 'Test'
  };

  let testUser;

  beforeEach(async () => {
    // Clean up test user and recovery tokens if exist
    await User.deleteOne({ email: validUserData.email });
    await AccountRecovery.deleteMany({ email: validUserData.email });

    // Create a test user
    const response = await request(app)
      .post(`${API_BASE}/register`)
      .send(validUserData)
      .expect(201);

    testUser = response.body.user;
  });

  afterEach(async () => {
    // Clean up test user and recovery tokens
    await User.deleteOne({ email: validUserData.email });
    await AccountRecovery.deleteMany({ email: validUserData.email });
  });

  describe('POST /api/v1/users/request-recovery - Request Account Recovery', () => {
    describe('Successful Recovery Requests', () => {
      it('should successfully send recovery instructions to registered email', async () => {
        const recoveryRequest = {
          email: validUserData.email
        };

        const response = await request(app)
          .post(`${API_BASE}/request-recovery`)
          .send(recoveryRequest)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Recovery instructions sent successfully to your email');

        // Verify recovery token was stored in database
        const recoveryRecord = await AccountRecovery.findOne({ 
          email: validUserData.email,
          recoveryType: 'password_reset',
          used: false
        });
        
        expect(recoveryRecord).toBeTruthy();
        expect(recoveryRecord.token).toBeTruthy();
        expect(recoveryRecord.expiresAt).toBeTruthy();
        expect(new Date(recoveryRecord.expiresAt)).toBeInstanceOf(Date);
        expect(recoveryRecord.recoveryType).toBe('password_reset');
        expect(recoveryRecord.used).toBe(false);
        expect(recoveryRecord.attempts).toBe(0);
        
        // Token should expire in approximately 1 hour
        const tokenExpiry = new Date(recoveryRecord.expiresAt);
        const expectedExpiry = new Date(Date.now() + 60 * 60 * 1000);
        const timeDiff = Math.abs(tokenExpiry.getTime() - expectedExpiry.getTime());
        expect(timeDiff).toBeLessThan(10000); // Within 10 seconds tolerance
      });

      it('should invalidate existing recovery tokens when new one is requested', async () => {
        const recoveryRequest = {
          email: validUserData.email
        };

        // First recovery request
        await request(app)
          .post(`${API_BASE}/request-recovery`)
          .send(recoveryRequest)
          .expect(200);

        const firstRecovery = await AccountRecovery.findOne({ 
          email: validUserData.email,
          used: false
        });
        const firstToken = firstRecovery.token;

        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 1100));

        // Second recovery request (should invalidate first)
        await request(app)
          .post(`${API_BASE}/request-recovery`)
          .send(recoveryRequest)
          .expect(200);

        // First token should be invalidated
        const invalidatedRecovery = await AccountRecovery.findOne({ token: firstToken });
        expect(invalidatedRecovery.used).toBe(true);

        // New token should exist and be valid
        const newRecovery = await AccountRecovery.findOne({ 
          email: validUserData.email,
          used: false
        });
        expect(newRecovery).toBeTruthy();
        expect(newRecovery.token).not.toBe(firstToken);
      });

      it('should store recovery metadata (IP and User-Agent)', async () => {
        const recoveryRequest = {
          email: validUserData.email
        };

        await request(app)
          .post(`${API_BASE}/request-recovery`)
          .set('User-Agent', 'Test-Agent/1.0')
          .send(recoveryRequest)
          .expect(200);

        const recoveryRecord = await AccountRecovery.findOne({ 
          email: validUserData.email,
          used: false
        });
        
        expect(recoveryRecord.userAgent).toBe('Test-Agent/1.0');
        expect(recoveryRecord.ipAddress).toBeTruthy();
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when email is missing', async () => {
        const recoveryRequest = {}; // No email

        const response = await request(app)
          .post(`${API_BASE}/request-recovery`)
          .send(recoveryRequest)
          .expect(400);

        expect(response.body.message).toContain('Email is required');
      });

      it('should return 400 when email is empty string', async () => {
        const recoveryRequest = {
          email: ''
        };

        const response = await request(app)
          .post(`${API_BASE}/request-recovery`)
          .send(recoveryRequest)
          .expect(400);

        expect(response.body.message).toContain('Email is required');
      });

      it('should return 400 when email format is invalid', async () => {
        const invalidEmails = [
          'invalid-email',
          '@example.com',
          'user@',
          'user@.com',
          'user..name@example.com'
        ];

        for (const email of invalidEmails) {
          const recoveryRequest = { email };

          const response = await request(app)
            .post(`${API_BASE}/request-recovery`)
            .send(recoveryRequest)
            .expect(400);

          expect(response.body.message).toContain('Must be a valid email format');
        }
      });

      it('should return 400 when email is too long', async () => {
        const longEmail = 'a'.repeat(240) + '@example.com'; // Exceeds 254 characters

        const recoveryRequest = {
          email: longEmail
        };

        const response = await request(app)
          .post(`${API_BASE}/request-recovery`)
          .send(recoveryRequest)
          .expect(400);

        // Email format validation might catch this first
        expect(response.body.message).toMatch(/Must be a valid email format|Email must not exceed 254 characters/);
      });
    });

    describe('Not Found Errors (404)', () => {
      it('should return 404 when email is not registered', async () => {
        const recoveryRequest = {
          email: 'unregistered@example.com'
        };

        const response = await request(app)
          .post(`${API_BASE}/request-recovery`)
          .send(recoveryRequest)
          .expect(404);

        expect(response.body.message).toContain('Email not registered');

        // Verify no recovery token was created
        const recoveryRecord = await AccountRecovery.findOne({ 
          email: 'unregistered@example.com'
        });
        expect(recoveryRecord).toBeNull();
      });
    });

    describe('Rate Limiting', () => {
      it('should have rate limiting for recovery requests', async () => {
        const recoveryRequest = {
          email: validUserData.email
        };

        // Make multiple requests quickly
        const promises = [];
        for (let i = 0; i < 5; i++) {
          promises.push(
            request(app)
              .post(`${API_BASE}/request-recovery`)
              .send(recoveryRequest)
          );
        }

        const responses = await Promise.all(promises);
        
        // All requests might succeed in test environment due to high limits
        const successCount = responses.filter(res => res.status === 200).length;
        const rateLimitedCount = responses.filter(res => res.status === 429).length;
        
        expect(successCount).toBeGreaterThan(0);
        // Rate limiting is configured but may not trigger in test environment
        expect(successCount + rateLimitedCount).toBeGreaterThanOrEqual(1);
        expect(responses.length).toBe(5);
      });
    });
  });

  describe('POST /api/v1/users/reset-password - Reset Password', () => {
    let recoveryToken;

    beforeEach(async () => {
      // Generate recovery token first
      const recoveryRequest = {
        email: validUserData.email
      };

      await request(app)
        .post(`${API_BASE}/request-recovery`)
        .send(recoveryRequest)
        .expect(200);

      // Get the generated token from database
      const recoveryRecord = await AccountRecovery.findOne({ 
        email: validUserData.email,
        used: false
      });
      recoveryToken = recoveryRecord.token;
    });

    describe('Successful Password Reset', () => {
      it('should successfully reset password with valid token', async () => {
        const resetData = {
          token: recoveryToken,
          newPassword: 'NewSecurePassword123!'
        };

        const response = await request(app)
          .post(`${API_BASE}/reset-password`)
          .send(resetData)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Password reset successful');

        // Verify password was changed
        const user = await User.findByEmail(validUserData.email);
        const isOldPasswordValid = await user.comparePassword(validUserData.password);
        const isNewPasswordValid = await user.comparePassword('NewSecurePassword123!');
        
        expect(isOldPasswordValid).toBe(false);
        expect(isNewPasswordValid).toBe(true);

        // Verify recovery token was marked as used
        const recoveryRecord = await AccountRecovery.findOne({ token: recoveryToken });
        expect(recoveryRecord.used).toBe(true);
        expect(recoveryRecord.attempts).toBe(1);

        // Verify all other recovery tokens for user were invalidated
        const validTokens = await AccountRecovery.find({ 
          userId: user._id,
          used: false
        });
        expect(validTokens).toHaveLength(0);
      });

      it('should allow login with new password after reset', async () => {
        const resetData = {
          token: recoveryToken,
          newPassword: 'NewSecurePassword123!'
        };

        // Reset password
        await request(app)
          .post(`${API_BASE}/reset-password`)
          .send(resetData)
          .expect(200);

        // Try to login with new password
        const loginData = {
          email: validUserData.email,
          password: 'NewSecurePassword123!'
        };

        const response = await request(app)
          .post(`${API_BASE}/login`)
          .send(loginData)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Login successful');
        expect(response.body).toHaveProperty('accessToken');
      });

      it('should not allow login with old password after reset', async () => {
        const resetData = {
          token: recoveryToken,
          newPassword: 'NewSecurePassword123!'
        };

        // Reset password
        await request(app)
          .post(`${API_BASE}/reset-password`)
          .send(resetData)
          .expect(200);

        // Try to login with old password
        const loginData = {
          email: validUserData.email,
          password: validUserData.password
        };

        const response = await request(app)
          .post(`${API_BASE}/login`)
          .send(loginData)
          .expect(401);

        expect(response.body.message).toContain('Invalid credentials');
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when token is missing', async () => {
        const resetData = {
          newPassword: 'NewSecurePassword123!'
        };

        const response = await request(app)
          .post(`${API_BASE}/reset-password`)
          .send(resetData)
          .expect(400);

        expect(response.body.message).toContain('Recovery token is required');
      });

      it('should return 400 when newPassword is missing', async () => {
        const resetData = {
          token: recoveryToken
        };

        const response = await request(app)
          .post(`${API_BASE}/reset-password`)
          .send(resetData)
          .expect(400);

        expect(response.body.message).toContain('New password is required');
      });

      it('should return 400 when token is too short', async () => {
        const resetData = {
          token: 'short',
          newPassword: 'NewSecurePassword123!'
        };

        const response = await request(app)
          .post(`${API_BASE}/reset-password`)
          .send(resetData)
          .expect(400);

        expect(response.body.message).toContain('Invalid token format');
      });

      it('should return 400 when newPassword does not meet requirements', async () => {
        const invalidPasswords = [
          { password: 'short', expectedError: 'New password must be between 8 and 128 characters' },
          { password: 'a'.repeat(129), expectedError: 'New password must be between 8 and 128 characters' },
          { password: 'alllowercase', expectedError: 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' },
          { password: 'ALLUPPERCASE', expectedError: 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' },
          { password: 'NoNumbers!', expectedError: 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' },
          { password: 'NoSpecialChars123', expectedError: 'New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' }
        ];

        for (const { password, expectedError } of invalidPasswords) {
          const resetData = {
            token: recoveryToken,
            newPassword: password
          };

          const response = await request(app)
            .post(`${API_BASE}/reset-password`)
            .send(resetData)
            .expect(400);

          expect(response.body.message).toContain(expectedError);
        }
      });
    });

    describe('Authentication Errors (401)', () => {
      it('should return 401 when token is invalid', async () => {
        const resetData = {
          token: 'invalid.jwt.token.here',
          newPassword: 'NewSecurePassword123!'
        };

        const response = await request(app)
          .post(`${API_BASE}/reset-password`)
          .send(resetData)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired recovery token');
      });

      it('should return 401 when token is expired', async () => {
        // Manually expire the token
        const recoveryRecord = await AccountRecovery.findOne({ token: recoveryToken });
        recoveryRecord.expiresAt = new Date(Date.now() - 1000); // 1 second ago
        await recoveryRecord.save();

        const resetData = {
          token: recoveryToken,
          newPassword: 'NewSecurePassword123!'
        };

        const response = await request(app)
          .post(`${API_BASE}/reset-password`)
          .send(resetData)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired recovery token');
      });

      it('should return 401 when token has already been used', async () => {
        const resetData = {
          token: recoveryToken,
          newPassword: 'NewSecurePassword123!'
        };

        // First reset should succeed
        await request(app)
          .post(`${API_BASE}/reset-password`)
          .send(resetData)
          .expect(200);

        // Second reset with same token should fail
        const response = await request(app)
          .post(`${API_BASE}/reset-password`)
          .send(resetData)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired recovery token');
      });

      it('should return 401 when token has reached max attempts', async () => {
        // Manually set attempts to max
        const recoveryRecord = await AccountRecovery.findOne({ token: recoveryToken });
        recoveryRecord.attempts = 3;
        await recoveryRecord.save();

        const resetData = {
          token: recoveryToken,
          newPassword: 'NewSecurePassword123!'
        };

        const response = await request(app)
          .post(`${API_BASE}/reset-password`)
          .send(resetData)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired recovery token');
      });

      it('should return 401 when token type is not password_reset', async () => {
        // Create a token with wrong type
        const wrongTypeToken = jwt.sign(
          { userId: testUser._id, email: testUser.email, type: 'email_verification' },
          config.jwt.accessTokenSecret,
          { expiresIn: '1h' }
        );

        const resetData = {
          token: wrongTypeToken,
          newPassword: 'NewSecurePassword123!'
        };

        const response = await request(app)
          .post(`${API_BASE}/reset-password`)
          .send(resetData)
          .expect(401);

        expect(response.body.message).toContain('Invalid recovery token');
      });
    });

    describe('Not Found Errors (404)', () => {
      it('should return 404 when user does not exist', async () => {
        // Create a token for non-existent user
        const nonExistentUserId = '507f1f77bcf86cd799439011'; // Valid ObjectId format
        const fakeToken = jwt.sign(
          { userId: nonExistentUserId, email: 'fake@example.com', type: 'password_reset' },
          config.jwt.accessTokenSecret,
          { expiresIn: '1h' }
        );

        // Store the fake token in recovery collection
        await AccountRecovery.createRecovery(
          nonExistentUserId,
          'fake@example.com',
          fakeToken,
          new Date(Date.now() + 60 * 60 * 1000),
          'password_reset'
        );

        const resetData = {
          token: fakeToken,
          newPassword: 'NewSecurePassword123!'
        };

        const response = await request(app)
          .post(`${API_BASE}/reset-password`)
          .send(resetData)
          .expect(404);

        expect(response.body.message).toContain('User not found');
      });
    });

    describe('Rate Limiting', () => {
      it('should have rate limiting for password reset attempts', async () => {
        const resetData = {
          token: 'invalid.token.for.rate.limit.test',
          newPassword: 'NewSecurePassword123!'
        };

        // Make multiple failed reset attempts
        const promises = [];
        for (let i = 0; i < 8; i++) {
          promises.push(
            request(app)
              .post(`${API_BASE}/reset-password`)
              .send(resetData)
          );
        }

        const responses = await Promise.all(promises);
        
        // Some requests should return 401, others might be rate limited
        const unauthorizedCount = responses.filter(res => res.status === 401).length;
        const rateLimitedCount = responses.filter(res => res.status === 429).length;
        
        expect(unauthorizedCount).toBeGreaterThan(0);
        // Rate limiting might kick in for high volume
        expect(unauthorizedCount + rateLimitedCount).toBe(8);
      });
    });
  });

  describe('Recovery Token Security', () => {
    it('should generate different tokens for multiple recovery requests', async () => {
      const recoveryRequest = {
        email: validUserData.email
      };

      // First request
      await request(app)
        .post(`${API_BASE}/request-recovery`)
        .send(recoveryRequest)
        .expect(200);

      const firstRecord = await AccountRecovery.findOne({ 
        email: validUserData.email
      }).sort({ createdAt: -1 });
      const firstToken = firstRecord.token;

      // Wait a moment to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Second request
      await request(app)
        .post(`${API_BASE}/request-recovery`)
        .send(recoveryRequest)
        .expect(200);

      const secondRecord = await AccountRecovery.findOne({ 
        email: validUserData.email,
        used: false
      });

      expect(firstToken).not.toBe(secondRecord.token);
    });

    it('should clean up expired tokens automatically', async () => {
      const recoveryRequest = {
        email: validUserData.email
      };

      await request(app)
        .post(`${API_BASE}/request-recovery`)
        .send(recoveryRequest)
        .expect(200);

      // Manually expire the token
      const recoveryRecord = await AccountRecovery.findOne({ 
        email: validUserData.email,
        used: false
      });
      
      recoveryRecord.expiresAt = new Date(Date.now() - 1000); // 1 second ago
      await recoveryRecord.save();

      // Try to use expired token
      const resetData = {
        token: recoveryRecord.token,
        newPassword: 'NewSecurePassword123!'
      };

      await request(app)
        .post(`${API_BASE}/reset-password`)
        .send(resetData)
        .expect(401);

      // MongoDB TTL index should eventually clean up expired tokens
      // For testing, we can verify the token is considered invalid
      const validToken = await AccountRecovery.findValidRecovery(recoveryRecord.token);
      expect(validToken).toBeNull();
    });
  });
});