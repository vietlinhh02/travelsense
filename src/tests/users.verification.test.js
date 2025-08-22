const request = require('supertest');
const app = require('../app');
const User = require('../models/users/user.model');

// Base API path for tests
const API_BASE = '/api/v1/users';

describe('User Service Test Suite - Email and Phone Verification', () => {
  // Valid user data for testing
  const validUserData = {
    email: 'verification.test@example.com',
    password: 'VerifyTest123!',
    firstName: 'Verify',
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

  describe('POST /api/v1/users/send-email-verification - Send Email Verification', () => {
    describe('Successful Email Verification Requests', () => {
      it('should successfully send email verification to unverified email', async () => {
        const verificationRequest = {
          email: validUserData.email
        };

        const response = await request(app)
          .post(`${API_BASE}/send-email-verification`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(verificationRequest)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Verification email sent successfully');

        // Verify token was stored in database
        const user = await User.findById(userId);
        expect(user.emailVerificationToken).toBeTruthy();
        expect(user.emailVerificationToken.token).toBeTruthy();
        expect(user.emailVerificationToken.expiresAt).toBeTruthy();
        expect(new Date(user.emailVerificationToken.expiresAt)).toBeInstanceOf(Date);
      });

      it('should generate different tokens for multiple requests', async () => {
        const verificationRequest = {
          email: validUserData.email
        };

        // First request
        await request(app)
          .post(`${API_BASE}/send-email-verification`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(verificationRequest)
          .expect(200);

        const firstUser = await User.findById(userId);
        const firstToken = firstUser.emailVerificationToken.token;

        // Wait longer to ensure different timestamps in JWT
        await new Promise(resolve => setTimeout(resolve, 1100));

        // Second request (should overwrite first)
        await request(app)
          .post(`${API_BASE}/send-email-verification`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(verificationRequest)
          .expect(200);

        const secondUser = await User.findById(userId);
        const secondToken = secondUser.emailVerificationToken.token;

        // JWT tokens should be different due to different iat (issued at) timestamps
        expect(firstToken).not.toBe(secondToken);
      });

      it('should set token expiration to 24 hours in the future', async () => {
        const verificationRequest = {
          email: validUserData.email
        };

        const beforeRequest = new Date();
        
        await request(app)
          .post(`${API_BASE}/send-email-verification`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(verificationRequest)
          .expect(200);

        const afterRequest = new Date();
        const user = await User.findById(userId);
        const tokenExpiry = new Date(user.emailVerificationToken.expiresAt);

        // Check expiry is approximately 24 hours from now (with some tolerance)
        const expectedExpiry = new Date(beforeRequest.getTime() + 24 * 60 * 60 * 1000);
        const timeDiff = Math.abs(tokenExpiry.getTime() - expectedExpiry.getTime());
        expect(timeDiff).toBeLessThan(10000); // Within 10 seconds tolerance
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when email is missing', async () => {
        const verificationRequest = {}; // No email

        const response = await request(app)
          .post(`${API_BASE}/send-email-verification`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(verificationRequest)
          .expect(400);

        expect(response.body.message).toContain('Email is required');
      });

      it('should return 400 when email format is invalid', async () => {
        const invalidEmails = [
          'invalid-email',
          '@example.com',
          'user@',
          'user@.com'
        ];

        for (const email of invalidEmails) {
          const verificationRequest = { email };

          const response = await request(app)
            .post(`${API_BASE}/send-email-verification`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(verificationRequest)
            .expect(400);

          expect(response.body.message).toContain('Must be a valid email format');
        }
      });
    });

    describe('Authentication Errors (401)', () => {
      it('should return 401 when Authorization header is missing', async () => {
        const verificationRequest = { email: validUserData.email };

        const response = await request(app)
          .post(`${API_BASE}/send-email-verification`)
          .send(verificationRequest)
          .expect(401);

        expect(response.body.message).toContain('Access token required');
      });

      it('should return 401 when token is invalid', async () => {
        const verificationRequest = { email: validUserData.email };
        const invalidToken = 'invalid.jwt.token';

        const response = await request(app)
          .post(`${API_BASE}/send-email-verification`)
          .set('Authorization', `Bearer ${invalidToken}`)
          .send(verificationRequest)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired access token');
      });
    });

    describe('Conflict Errors (409)', () => {
      it('should return 409 when email is already verified', async () => {
        // Mark email as verified
        const user = await User.findById(userId);
        user.emailVerified = true;
        await user.save();

        const verificationRequest = { email: validUserData.email };

        const response = await request(app)
          .post(`${API_BASE}/send-email-verification`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(verificationRequest)
          .expect(409);

        expect(response.body.message).toContain('Email already verified');
      });
    });
  });

  describe('POST /api/v1/users/verify-email - Verify Email', () => {
    let verificationToken;

    beforeEach(async () => {
      // Generate verification token
      const verificationRequest = { email: validUserData.email };

      await request(app)
        .post(`${API_BASE}/send-email-verification`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(verificationRequest)
        .expect(200);

      // Get the generated token from database
      const user = await User.findById(userId);
      verificationToken = user.emailVerificationToken.token;
    });

    describe('Successful Email Verification', () => {
      it('should successfully verify email with valid token', async () => {
        const verifyRequest = {
          token: verificationToken
        };

        const response = await request(app)
          .post(`${API_BASE}/verify-email`)
          .send(verifyRequest)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Email verified successfully');

        // Verify email is marked as verified in database
        const user = await User.findById(userId);
        expect(user.emailVerified).toBe(true);

        // Verify token was cleared from database
        expect(user.emailVerificationToken.token).toBeNull();
        expect(user.emailVerificationToken.expiresAt).toBeNull();
      });

      it('should not allow reuse of verification token', async () => {
        const verifyRequest = {
          token: verificationToken
        };

        // First verification should succeed
        await request(app)
          .post(`${API_BASE}/verify-email`)
          .send(verifyRequest)
          .expect(200);

        // Second verification with same token should fail
        const response = await request(app)
          .post(`${API_BASE}/verify-email`)
          .send(verifyRequest)
          .expect(409);

        expect(response.body.message).toContain('Email already verified');
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when token is missing', async () => {
        const verifyRequest = {}; // No token

        const response = await request(app)
          .post(`${API_BASE}/verify-email`)
          .send(verifyRequest)
          .expect(400);

        expect(response.body.message).toContain('Verification token is required');
      });

      it('should return 400 when token is too short', async () => {
        const verifyRequest = {
          token: 'short'
        };

        const response = await request(app)
          .post(`${API_BASE}/verify-email`)
          .send(verifyRequest)
          .expect(400);

        expect(response.body.message).toContain('Invalid token format');
      });
    });

    describe('Authentication Errors (401)', () => {
      it('should return 401 when token is invalid', async () => {
        const verifyRequest = {
          token: 'invalid.jwt.token.here'
        };

        const response = await request(app)
          .post(`${API_BASE}/verify-email`)
          .send(verifyRequest)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired verification token');
      });

      it('should return 401 when token is expired', async () => {
        // Manually expire the token
        const user = await User.findById(userId);
        user.emailVerificationToken.expiresAt = new Date(Date.now() - 1000); // 1 second ago
        await user.save();

        const verifyRequest = {
          token: verificationToken
        };

        const response = await request(app)
          .post(`${API_BASE}/verify-email`)
          .send(verifyRequest)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired verification token');
      });
    });
  });

  describe('POST /api/v1/users/send-phone-verification - Send Phone Verification', () => {
    describe('Successful Phone Verification Requests', () => {
      it('should successfully send phone verification code to valid phone number', async () => {
        const phoneRequest = {
          phoneNumber: '+1234567890'
        };

        const response = await request(app)
          .post(`${API_BASE}/send-phone-verification`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(phoneRequest)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Verification code sent successfully to your phone');

        // Verify code was stored and phone number updated in database
        const user = await User.findById(userId);
        expect(user.phoneNumber).toBe(phoneRequest.phoneNumber);
        expect(user.phoneVerificationCode).toBeTruthy();
        expect(user.phoneVerificationCode.code).toBeTruthy();
        expect(user.phoneVerificationCode.code).toMatch(/^\d{6}$/); // 6 digits
        expect(user.phoneVerificationCode.expiresAt).toBeTruthy();
        expect(new Date(user.phoneVerificationCode.expiresAt)).toBeInstanceOf(Date);
      });

      it('should set code expiration to 10 minutes in the future', async () => {
        const phoneRequest = {
          phoneNumber: '+1234567890'
        };

        const beforeRequest = new Date();
        
        await request(app)
          .post(`${API_BASE}/send-phone-verification`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(phoneRequest)
          .expect(200);

        const afterRequest = new Date();
        const user = await User.findById(userId);
        const codeExpiry = new Date(user.phoneVerificationCode.expiresAt);

        // Check expiry is approximately 10 minutes from now (with some tolerance)
        const expectedExpiry = new Date(beforeRequest.getTime() + 10 * 60 * 1000);
        const timeDiff = Math.abs(codeExpiry.getTime() - expectedExpiry.getTime());
        expect(timeDiff).toBeLessThan(5000); // Within 5 seconds tolerance
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when phone number is missing', async () => {
        const phoneRequest = {}; // No phone number

        const response = await request(app)
          .post(`${API_BASE}/send-phone-verification`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(phoneRequest)
          .expect(400);

        expect(response.body.message).toContain('Phone number is required');
      });

      it('should return 400 when phone number format is invalid', async () => {
        const invalidPhones = [
          '123',          // Too short
          'abcdefghij',   // Not numbers
          '0123456789',   // Starting with 0
          '+1234567890123456789012345' // Too long
        ];

        for (const phoneNumber of invalidPhones) {
          const phoneRequest = { phoneNumber };

          const response = await request(app)
            .post(`${API_BASE}/send-phone-verification`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(phoneRequest)
            .expect(400);

          expect(response.body.message).toMatch(/Invalid phone number format|Phone number must be between/);
        }
      });
    });

    describe('Conflict Errors (409)', () => {
      it('should return 409 when phone number is already verified', async () => {
        // Mark phone as verified
        const user = await User.findById(userId);
        user.phoneVerified = true;
        await user.save();

        const phoneRequest = { phoneNumber: '+1234567890' };

        const response = await request(app)
          .post(`${API_BASE}/send-phone-verification`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(phoneRequest)
          .expect(409);

        expect(response.body.message).toContain('Phone number already verified');
      });
    });
  });

  describe('POST /api/v1/users/verify-phone - Verify Phone', () => {
    const testPhoneNumber = '+1234567890';
    let verificationCode;

    beforeEach(async () => {
      // Generate phone verification code
      const phoneRequest = { phoneNumber: testPhoneNumber };

      await request(app)
        .post(`${API_BASE}/send-phone-verification`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(phoneRequest)
        .expect(200);

      // Get the generated code from database
      const user = await User.findById(userId);
      verificationCode = user.phoneVerificationCode.code;
    });

    describe('Successful Phone Verification', () => {
      it('should successfully verify phone with valid code', async () => {
        const verifyRequest = {
          phoneNumber: testPhoneNumber,
          code: verificationCode
        };

        const response = await request(app)
          .post(`${API_BASE}/verify-phone`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(verifyRequest)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Phone number verified successfully');

        // Verify phone is marked as verified in database
        const user = await User.findById(userId);
        expect(user.phoneVerified).toBe(true);

        // Verify code was cleared from database
        expect(user.phoneVerificationCode.code).toBeNull();
        expect(user.phoneVerificationCode.expiresAt).toBeNull();
      });

      it('should not allow reuse of verification code', async () => {
        const verifyRequest = {
          phoneNumber: testPhoneNumber,
          code: verificationCode
        };

        // First verification should succeed
        await request(app)
          .post(`${API_BASE}/verify-phone`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(verifyRequest)
          .expect(200);

        // Second verification with same code should fail
        const response = await request(app)
          .post(`${API_BASE}/verify-phone`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(verifyRequest)
          .expect(409);

        expect(response.body.message).toContain('Phone number already verified');
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when phone number is missing', async () => {
        const verifyRequest = {
          code: verificationCode
        };

        const response = await request(app)
          .post(`${API_BASE}/verify-phone`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(verifyRequest)
          .expect(400);

        expect(response.body.message).toContain('Phone number is required');
      });

      it('should return 400 when verification code is missing', async () => {
        const verifyRequest = {
          phoneNumber: testPhoneNumber
        };

        const response = await request(app)
          .post(`${API_BASE}/verify-phone`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(verifyRequest)
          .expect(400);

        expect(response.body.message).toContain('Verification code is required');
      });

      it('should return 400 when phone number does not match', async () => {
        const verifyRequest = {
          phoneNumber: '+9876543210', // Different phone number
          code: verificationCode
        };

        const response = await request(app)
          .post(`${API_BASE}/verify-phone`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(verifyRequest)
          .expect(400);

        expect(response.body.message).toContain('Phone number does not match');
      });

      it('should return 400 when verification code is not 6 digits', async () => {
        const invalidCodes = [
          '12345',      // Too short
          '1234567',    // Too long
          'abcdef',     // Not digits
          '12345a',     // Mixed
          ''            // Empty
        ];

        for (const code of invalidCodes) {
          const verifyRequest = {
            phoneNumber: testPhoneNumber,
            code: code
          };

          const response = await request(app)
            .post(`${API_BASE}/verify-phone`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(verifyRequest)
            .expect(400);

          expect(response.body.message).toMatch(/Verification code must be exactly 6 digits|Verification code must contain only digits|Verification code is required/);
        }
      });
    });

    describe('Authentication Errors (401)', () => {
      it('should return 401 when verification code is incorrect', async () => {
        const verifyRequest = {
          phoneNumber: testPhoneNumber,
          code: '999999' // Wrong code
        };

        const response = await request(app)
          .post(`${API_BASE}/verify-phone`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(verifyRequest)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired verification code');

        // Verify code is still in database (not cleared)
        const user = await User.findById(userId);
        expect(user.phoneVerificationCode.code).toBe(verificationCode);
      });

      it('should return 401 when verification code is expired', async () => {
        // Manually expire the code
        const user = await User.findById(userId);
        user.phoneVerificationCode.expiresAt = new Date(Date.now() - 1000); // 1 second ago
        await user.save();

        const verifyRequest = {
          phoneNumber: testPhoneNumber,
          code: verificationCode
        };

        const response = await request(app)
          .post(`${API_BASE}/verify-phone`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(verifyRequest)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired verification code');
      });
    });
  });
});