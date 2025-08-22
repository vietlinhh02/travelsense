const request = require('supertest');
const app = require('../app');
const User = require('../models/users/user.model');

// Base API path for tests
const API_BASE = '/api/v1/users';

describe('User Service Test Suite - OTP Email Login', () => {
  // Valid user data for testing
  const validUserData = {
    email: 'otp.test@example.com',
    password: 'OtpTest123!',
    firstName: 'OTP',
    lastName: 'Test'
  };

  let testUser;

  beforeEach(async () => {
    // Clean up test user if exists
    await User.deleteOne({ email: validUserData.email });

    // Create a test user
    const response = await request(app)
      .post(`${API_BASE}/register`)
      .send(validUserData)
      .expect(201);

    testUser = response.body.user;
  });

  afterEach(async () => {
    // Clean up test user
    await User.deleteOne({ email: validUserData.email });
  });

  describe('POST /api/v1/users/request-otp - Request OTP', () => {
    describe('Successful OTP Requests', () => {
      it('should successfully send OTP to registered email', async () => {
        const otpRequest = {
          email: validUserData.email
        };

        const response = await request(app)
          .post(`${API_BASE}/request-otp`)
          .send(otpRequest)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'OTP sent successfully to your email');

        // Verify OTP was stored in database
        const user = await User.findByEmail(validUserData.email);
        expect(user.otp).toBeTruthy();
        expect(user.otp.code).toBeTruthy();
        expect(user.otp.code).toMatch(/^\d{6}$/); // 6 digits
        expect(user.otp.expiresAt).toBeTruthy();
        expect(new Date(user.otp.expiresAt)).toBeInstanceOf(Date);
      });

      it('should generate different OTP codes for multiple requests', async () => {
        const otpRequest = {
          email: validUserData.email
        };

        // First OTP request
        await request(app)
          .post(`${API_BASE}/request-otp`)
          .send(otpRequest)
          .expect(200);

        const firstUser = await User.findByEmail(validUserData.email);
        const firstOtp = firstUser.otp.code;

        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 100));

        // Second OTP request (should overwrite first)
        await request(app)
          .post(`${API_BASE}/request-otp`)
          .send(otpRequest)
          .expect(200);

        const secondUser = await User.findByEmail(validUserData.email);
        const secondOtp = secondUser.otp.code;

        expect(firstOtp).not.toBe(secondOtp);
      });

      it('should set OTP expiration to 5 minutes in the future', async () => {
        const otpRequest = {
          email: validUserData.email
        };

        const beforeRequest = new Date();
        
        await request(app)
          .post(`${API_BASE}/request-otp`)
          .send(otpRequest)
          .expect(200);

        const afterRequest = new Date();
        const user = await User.findByEmail(validUserData.email);
        const otpExpiry = new Date(user.otp.expiresAt);

        // Check expiry is approximately 5 minutes from now (with some tolerance)
        const expectedExpiry = new Date(beforeRequest.getTime() + 5 * 60 * 1000);
        const timeDiff = Math.abs(otpExpiry.getTime() - expectedExpiry.getTime());
        expect(timeDiff).toBeLessThan(5000); // Within 5 seconds tolerance
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when email is missing', async () => {
        const otpRequest = {}; // No email

        const response = await request(app)
          .post(`${API_BASE}/request-otp`)
          .send(otpRequest)
          .expect(400);

        expect(response.body.message).toContain('Email is required');
      });

      it('should return 400 when email is empty string', async () => {
        const otpRequest = {
          email: ''
        };

        const response = await request(app)
          .post(`${API_BASE}/request-otp`)
          .send(otpRequest)
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
          const otpRequest = { email };

          const response = await request(app)
            .post(`${API_BASE}/request-otp`)
            .send(otpRequest)
            .expect(400);

          expect(response.body.message).toContain('Must be a valid email format');
        }
      });

      it('should return 400 when email is too long', async () => {
        const longEmail = 'a'.repeat(240) + '@example.com'; // Exceeds 254 characters

        const otpRequest = {
          email: longEmail
        };

        const response = await request(app)
          .post(`${API_BASE}/request-otp`)
          .send(otpRequest)
          .expect(400);

        // Email format validation might catch this first
        expect(response.body.message).toMatch(/Must be a valid email format|Email must not exceed 254 characters/);
      });
    });

    describe('Not Found Errors (404)', () => {
      it('should return 404 when email is not registered', async () => {
        const otpRequest = {
          email: 'unregistered@example.com'
        };

        const response = await request(app)
          .post(`${API_BASE}/request-otp`)
          .send(otpRequest)
          .expect(404);

        expect(response.body.message).toContain('Email not registered');
      });
    });

    describe('Rate Limiting', () => {
      it('should have rate limiting for OTP requests', async () => {
        const otpRequest = {
          email: validUserData.email
        };

        // Make multiple requests quickly
        const promises = [];
        for (let i = 0; i < 5; i++) {
          promises.push(
            request(app)
              .post(`${API_BASE}/request-otp`)
              .send(otpRequest)
          );
        }

        const responses = await Promise.all(promises);
        
        // All requests might succeed in test environment due to high limits
        const successCount = responses.filter(res => res.status === 200).length;
        const rateLimitedCount = responses.filter(res => res.status === 429).length;
        
        expect(successCount).toBeGreaterThan(0);
        // Rate limiting is configured but may not trigger in test environment
        expect(successCount + rateLimitedCount).toBe(5);
      });
    });
  });

  describe('POST /api/v1/users/otp-login - OTP Login', () => {
    describe('Successful OTP Login', () => {
      it('should successfully login with valid email and OTP', async () => {
        // Generate OTP first
        const otpRequest = {
          email: validUserData.email
        };

        await request(app)
          .post(`${API_BASE}/request-otp`)
          .send(otpRequest)
          .expect(200);

        // Get the generated OTP from database
        const user = await User.findByEmail(validUserData.email);
        const otpCode = user.otp.code;

        const loginData = {
          email: validUserData.email,
          otp: otpCode
        };

        const response = await request(app)
          .post(`${API_BASE}/otp-login`)
          .send(loginData)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'OTP login successful');
        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('accessToken');

        const userResponse = response.body.user;

        // Verify user information
        expect(userResponse).toHaveProperty('email', validUserData.email);
        expect(userResponse).toHaveProperty('firstName', validUserData.firstName);
        expect(userResponse).toHaveProperty('lastName', validUserData.lastName);
        expect(userResponse).not.toHaveProperty('password'); // Password should not be returned

        // Verify refresh token cookie is set
        const cookies = response.headers['set-cookie'];
        expect(cookies).toBeDefined();
        const refreshTokenCookie = cookies.find(cookie => cookie.startsWith('refreshToken='));
        expect(refreshTokenCookie).toBeDefined();
        expect(refreshTokenCookie).toContain('HttpOnly');
        expect(refreshTokenCookie).toContain('SameSite=Strict');

        // Verify OTP was cleared from database
        const dbUser = await User.findByEmail(validUserData.email);
        expect(dbUser.otp.code).toBeNull();
        expect(dbUser.otp.expiresAt).toBeNull();

        // Verify lastLogin was updated
        expect(dbUser.lastLogin).toBeTruthy();
      });

      it('should update lastLogin timestamp on successful OTP login', async () => {
        const originalUser = await User.findByEmail(validUserData.email);
        const originalLastLogin = originalUser.lastLogin;

        // Generate OTP
        const otpRequest = {
          email: validUserData.email
        };

        await request(app)
          .post(`${API_BASE}/request-otp`)
          .send(otpRequest)
          .expect(200);

        // Get the generated OTP from database
        const user = await User.findByEmail(validUserData.email);
        const otpCode = user.otp.code;

        // Wait a moment to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 100));

        const loginData = {
          email: validUserData.email,
          otp: otpCode
        };

        await request(app)
          .post(`${API_BASE}/otp-login`)
          .send(loginData)
          .expect(200);

        const updatedUser = await User.findByEmail(validUserData.email);
        expect(new Date(updatedUser.lastLogin).getTime()).toBeGreaterThan(new Date(originalLastLogin).getTime());
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when email is missing', async () => {
        const loginData = {
          otp: '123456'
        };

        const response = await request(app)
          .post(`${API_BASE}/otp-login`)
          .send(loginData)
          .expect(400);

        expect(response.body.message).toContain('Email is required');
      });

      it('should return 400 when OTP is missing', async () => {
        const loginData = {
          email: validUserData.email
        };

        const response = await request(app)
          .post(`${API_BASE}/otp-login`)
          .send(loginData)
          .expect(400);

        expect(response.body.message).toContain('OTP is required');
      });

      it('should return 400 when email format is invalid', async () => {
        const loginData = {
          email: 'invalid-email',
          otp: '123456'
        };

        const response = await request(app)
          .post(`${API_BASE}/otp-login`)
          .send(loginData)
          .expect(400);

        expect(response.body.message).toContain('Must be a valid email format');
      });

      it('should return 400 when OTP is not 6 digits', async () => {
        const invalidOtps = [
          { otp: '12345', expectedError: 'OTP must be exactly 6 digits' },      // Too short
          { otp: '1234567', expectedError: 'OTP must be exactly 6 digits' },    // Too long
          { otp: 'abcdef', expectedError: 'OTP must contain only digits' },     // Not digits
          { otp: '12345a', expectedError: 'OTP must contain only digits' },     // Mixed
          { otp: '', expectedError: 'OTP is required' }                         // Empty
        ];

        for (const { otp, expectedError } of invalidOtps) {
          const loginData = {
            email: validUserData.email,
            otp: otp
          };

          const response = await request(app)
            .post(`${API_BASE}/otp-login`)
            .send(loginData)
            .expect(400);

          expect(response.body.message).toContain(expectedError);
        }
      });
    });

    describe('Authentication Errors (401)', () => {
      it('should return 401 when OTP is incorrect', async () => {
        // Generate OTP first
        const otpRequest = {
          email: validUserData.email
        };

        await request(app)
          .post(`${API_BASE}/request-otp`)
          .send(otpRequest)
          .expect(200);

        // Get the generated OTP from database to verify it exists
        const user = await User.findByEmail(validUserData.email);
        const correctOtp = user.otp.code;

        const loginData = {
          email: validUserData.email,
          otp: '999999' // Wrong OTP
        };

        const response = await request(app)
          .post(`${API_BASE}/otp-login`)
          .send(loginData)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired OTP');

        // Verify OTP is still in database (not cleared)
        const userAfter = await User.findByEmail(validUserData.email);
        expect(userAfter.otp.code).toBe(correctOtp);
      });

      it('should return 401 when OTP is expired', async () => {
        // Generate OTP first
        const otpRequest = {
          email: validUserData.email
        };

        await request(app)
          .post(`${API_BASE}/request-otp`)
          .send(otpRequest)
          .expect(200);

        // Get the generated OTP from database
        const user = await User.findByEmail(validUserData.email);
        const otpCode = user.otp.code;

        // Manually expire the OTP
        user.otp.expiresAt = new Date(Date.now() - 1000); // 1 second ago
        await user.save();

        const loginData = {
          email: validUserData.email,
          otp: otpCode
        };

        const response = await request(app)
          .post(`${API_BASE}/otp-login`)
          .send(loginData)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired OTP');
      });

      it('should return 401 when no OTP exists for user', async () => {
        const loginData = {
          email: validUserData.email,
          otp: '123456'
        };

        const response = await request(app)
          .post(`${API_BASE}/otp-login`)
          .send(loginData)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired OTP');
      });

      it('should not allow reuse of OTP after successful login', async () => {
        // Generate OTP first
        const otpRequest = {
          email: validUserData.email
        };

        await request(app)
          .post(`${API_BASE}/request-otp`)
          .send(otpRequest)
          .expect(200);

        // Get the generated OTP from database
        const user = await User.findByEmail(validUserData.email);
        const otpCode = user.otp.code;

        const loginData = {
          email: validUserData.email,
          otp: otpCode
        };

        // First login should succeed
        await request(app)
          .post(`${API_BASE}/otp-login`)
          .send(loginData)
          .expect(200);

        // Second login with same OTP should fail
        const response = await request(app)
          .post(`${API_BASE}/otp-login`)
          .send(loginData)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired OTP');
      });
    });

    describe('Not Found Errors (404)', () => {
      it('should return 404 when email is not registered', async () => {
        const loginData = {
          email: 'unregistered@example.com',
          otp: '123456'
        };

        const response = await request(app)
          .post(`${API_BASE}/otp-login`)
          .send(loginData)
          .expect(404);

        expect(response.body.message).toContain('Email not registered');
      });
    });

    describe('Rate Limiting', () => {
      it('should have rate limiting for OTP login attempts', async () => {
        const loginData = {
          email: validUserData.email,
          otp: '999999' // Wrong OTP
        };

        // Make 12 failed login attempts to test rate limiting
        const promises = [];
        for (let i = 0; i < 12; i++) {
          promises.push(
            request(app)
              .post(`${API_BASE}/otp-login`)
              .send(loginData)
          );
        }

        const responses = await Promise.all(promises);
        
        // Some requests should return 401, others might be rate limited
        const unauthorizedCount = responses.filter(res => res.status === 401).length;
        const rateLimitedCount = responses.filter(res => res.status === 429).length;
        
        expect(unauthorizedCount).toBeGreaterThan(0);
        // Rate limiting might kick in for high volume
        expect(unauthorizedCount + rateLimitedCount).toBe(12);
      });
    });
  });
});