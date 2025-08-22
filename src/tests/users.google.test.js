const request = require('supertest');
const app = require('../app');
const User = require('../models/users/user.model');

// Base API path for tests
const API_BASE = '/api/v1/users';

describe('User Service Test Suite - Google OAuth Login', () => {
  // Valid Google token data for testing
  const validGoogleToken = {
    tokenId: 'valid_google_token_id_12345'
  };

  // Mock Google user email that will be created/found
  const googleUserEmail = 'google.user@gmail.com';

  beforeEach(async () => {
    // Clean up any existing Google user
    await User.deleteOne({ email: googleUserEmail });
  });

  afterEach(async () => {
    // Clean up test Google user
    await User.deleteOne({ email: googleUserEmail });
  });

  describe('POST /api/v1/users/google-login - Google OAuth Login', () => {
    describe('Successful Google Login', () => {
      it('should successfully create new user and login with valid Google token', async () => {
        const response = await request(app)
          .post(`${API_BASE}/google-login`)
          .send(validGoogleToken)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Google login successful');
        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('accessToken');

        const user = response.body.user;

        // Verify user information from Google
        expect(user).toHaveProperty('email', googleUserEmail);
        expect(user).toHaveProperty('firstName', 'Google');
        expect(user).toHaveProperty('lastName', 'User');
        expect(user).toHaveProperty('googleId', 'google_user_id_12345');
        expect(user).toHaveProperty('emailVerified', true); // Google emails are verified
        expect(user).toHaveProperty('phoneVerified', false);
        expect(user).toHaveProperty('twoFactorEnabled', false);
        expect(user).not.toHaveProperty('password'); // No password for Google users

        // Verify preferences structure
        expect(user).toHaveProperty('preferences');
        expect(user.preferences).toHaveProperty('interests', []);
        expect(user.preferences).toHaveProperty('constraints', []);

        // Verify profile structure
        expect(user).toHaveProperty('profile');
        expect(user.profile).toHaveProperty('languages', []);
        expect(user.profile).toHaveProperty('specialRequirements', []);

        // Verify timestamps
        expect(user).toHaveProperty('createdAt');
        expect(user).toHaveProperty('updatedAt');
        expect(user).toHaveProperty('lastLogin');

        // Verify refresh token cookie is set
        const cookies = response.headers['set-cookie'];
        expect(cookies).toBeDefined();
        const refreshTokenCookie = cookies.find(cookie => cookie.startsWith('refreshToken='));
        expect(refreshTokenCookie).toBeDefined();
        expect(refreshTokenCookie).toContain('HttpOnly');
        expect(refreshTokenCookie).toContain('SameSite=Strict');

        // Verify user exists in database
        const dbUser = await User.findByEmail(googleUserEmail);
        expect(dbUser).toBeTruthy();
        expect(dbUser.googleId).toBe('google_user_id_12345');
      });

      it('should login existing user with Google token and update lastLogin', async () => {
        // First, create a user via Google login
        await request(app)
          .post(`${API_BASE}/google-login`)
          .send(validGoogleToken)
          .expect(200);

        // Get the created user and note the lastLogin time
        const existingUser = await User.findByEmail(googleUserEmail);
        const originalLastLogin = existingUser.lastLogin;

        // Wait a moment to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 100));

        // Login again with same Google token
        const response = await request(app)
          .post(`${API_BASE}/google-login`)
          .send(validGoogleToken)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Google login successful');
        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('accessToken');

        const user = response.body.user;
        expect(user.email).toBe(googleUserEmail);

        // Verify lastLogin was updated
        const updatedUser = await User.findByEmail(googleUserEmail);
        expect(new Date(updatedUser.lastLogin).getTime()).toBeGreaterThan(new Date(originalLastLogin).getTime());
      });

      it('should add googleId to existing user if missing', async () => {
        // Create a regular user with same email first
        const regularUser = new User({
          email: googleUserEmail,
          password: 'TestPassword123!',
          firstName: 'Regular',
          lastName: 'User',
          emailVerified: false,
          phoneVerified: false,
          twoFactorEnabled: false,
          preferences: {
            interests: [],
            constraints: []
          },
          profile: {
            languages: [],
            specialRequirements: []
          },
          lastLogin: new Date()
        });
        await regularUser.save();

        // Now login with Google
        const response = await request(app)
          .post(`${API_BASE}/google-login`)
          .send(validGoogleToken)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Google login successful');
        const user = response.body.user;
        expect(user.email).toBe(googleUserEmail);
        expect(user.firstName).toBe('Regular'); // Should keep existing name
        expect(user.lastName).toBe('User');

        // Verify googleId was added
        const updatedUser = await User.findByEmail(googleUserEmail);
        expect(updatedUser.googleId).toBe('google_user_id_12345');
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when tokenId is missing', async () => {
        const invalidData = {}; // No tokenId

        const response = await request(app)
          .post(`${API_BASE}/google-login`)
          .send(invalidData)
          .expect(400);

        expect(response.body.message).toContain('Google token ID is required');
      });

      it('should return 400 when tokenId is empty string', async () => {
        const invalidData = {
          tokenId: ''
        };

        const response = await request(app)
          .post(`${API_BASE}/google-login`)
          .send(invalidData)
          .expect(400);

        expect(response.body.message).toContain('Google token ID is required');
      });

      it('should return 400 when tokenId is not a string', async () => {
        const invalidData = {
          tokenId: 12345 // Number instead of string
        };

        const response = await request(app)
          .post(`${API_BASE}/google-login`)
          .send(invalidData)
          .expect(400);

        expect(response.body.message).toContain('Token ID must be a string');
      });

      it('should return 400 when tokenId is too short', async () => {
        const invalidData = {
          tokenId: 'short' // Less than 10 characters
        };

        const response = await request(app)
          .post(`${API_BASE}/google-login`)
          .send(invalidData)
          .expect(400);

        expect(response.body.message).toContain('Invalid token ID format');
      });

      it('should return 400 when tokenId is too long', async () => {
        const invalidData = {
          tokenId: 'A'.repeat(2049) // Exceeds 2048 characters
        };

        const response = await request(app)
          .post(`${API_BASE}/google-login`)
          .send(invalidData)
          .expect(400);

        expect(response.body.message).toContain('Invalid token ID format');
      });
    });

    describe('Authentication Errors (401)', () => {
      // Note: In a real implementation, you would test actual Google token verification
      // For now, our mock implementation doesn't have invalid token scenarios
      // But we can test the structure for when Google token verification fails
      
      it('should be prepared to handle invalid Google tokens', async () => {
        // This test documents the expected behavior when Google token verification fails
        // In production, invalid tokens would return 401
        
        // For now, our mock accepts any token, so this test passes
        const response = await request(app)
          .post(`${API_BASE}/google-login`)
          .send({ tokenId: 'potentially_invalid_token' })
          .expect(200); // Mock accepts all tokens

        expect(response.body).toHaveProperty('message', 'Google login successful');
      });
    });

    describe('Rate Limiting', () => {
      it('should handle multiple Google login requests', async () => {
        // Test that Google login doesn't have rate limiting issues
        const promises = [];
        for (let i = 0; i < 3; i++) {
          promises.push(
            request(app)
              .post(`${API_BASE}/google-login`)
              .send(validGoogleToken)
          );
        }

        const responses = await Promise.all(promises);
        
        // All should succeed (Google login typically doesn't have strict rate limiting)
        const successfulLogins = responses.filter(res => res.status === 200);
        expect(successfulLogins.length).toBe(3);
      });
    });

    describe('Security Considerations', () => {
      it('should not expose sensitive user data in response', async () => {
        const response = await request(app)
          .post(`${API_BASE}/google-login`)
          .send(validGoogleToken)
          .expect(200);

        const user = response.body.user;
        
        // Should not contain password or other sensitive fields
        expect(user).not.toHaveProperty('password');
        expect(user).not.toHaveProperty('twoFactorMethod');
        
        // Should contain public information
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('firstName');
        expect(user).toHaveProperty('lastName');
        expect(user).toHaveProperty('googleId');
      });

      it('should set emailVerified to true for Google users', async () => {
        const response = await request(app)
          .post(`${API_BASE}/google-login`)
          .send(validGoogleToken)
          .expect(200);

        const user = response.body.user;
        expect(user.emailVerified).toBe(true);
        
        // Verify in database as well
        const dbUser = await User.findByEmail(googleUserEmail);
        expect(dbUser.emailVerified).toBe(true);
      });
    });
  });
});