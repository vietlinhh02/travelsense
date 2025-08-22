const request = require('supertest');
const app = require('../app');
const User = require('../models/users/user.model');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

// Base API path for tests
const API_BASE = '/api/v1/users';

describe('User Service Test Suite - Change Password', () => {
  let testUser;
  let accessToken;
  let userId;

  // Valid user data for testing
  const validUserData = {
    email: 'password.test@example.com',
    password: 'CurrentPass123!',
    firstName: 'Password',
    lastName: 'Test'
  };

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

  describe('PUT /api/v1/users/password - Change Password', () => {
    describe('Successful Password Changes', () => {
      it('should successfully change password with valid current password', async () => {
        const passwordData = {
          currentPassword: validUserData.password,
          newPassword: 'NewSecurePass456!'
        };

        const response = await request(app)
          .put(`${API_BASE}/password`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(passwordData)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Password changed successfully');

        // Verify user can login with new password
        const loginResponse = await request(app)
          .post(`${API_BASE}/login`)
          .send({
            email: validUserData.email,
            password: passwordData.newPassword
          })
          .expect(200);

        expect(loginResponse.body).toHaveProperty('accessToken');
      });

      it('should hash the new password properly', async () => {
        const passwordData = {
          currentPassword: validUserData.password,
          newPassword: 'AnotherSecurePass789!'
        };

        await request(app)
          .put(`${API_BASE}/password`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(passwordData)
          .expect(200);

        // Check user in database
        const user = await User.findById(userId);
        expect(user).toBeTruthy();
        expect(user.password).not.toBe(passwordData.newPassword); // Should be hashed
        
        // Verify new password works
        const isPasswordValid = await user.comparePassword(passwordData.newPassword);
        expect(isPasswordValid).toBe(true);
        
        // Verify old password no longer works
        const isOldPasswordValid = await user.comparePassword(validUserData.password);
        expect(isOldPasswordValid).toBe(false);
      });

      it('should reject login with old password after change', async () => {
        const passwordData = {
          currentPassword: validUserData.password,
          newPassword: 'YetAnotherPass123!'
        };

        // Change password
        await request(app)
          .put(`${API_BASE}/password`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(passwordData)
          .expect(200);

        // Try to login with old password
        const loginResponse = await request(app)
          .post(`${API_BASE}/login`)
          .send({
            email: validUserData.email,
            password: validUserData.password // Old password
          })
          .expect(401);

        expect(loginResponse.body.message).toContain('Invalid credentials');
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when currentPassword is missing', async () => {
        const passwordData = {
          newPassword: 'NewSecurePass456!'
        };

        const response = await request(app)
          .put(`${API_BASE}/password`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(passwordData)
          .expect(400);

        expect(response.body.message).toContain('Current password is required');
      });

      it('should return 400 when newPassword is missing', async () => {
        const passwordData = {
          currentPassword: validUserData.password
        };

        const response = await request(app)
          .put(`${API_BASE}/password`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(passwordData)
          .expect(400);

        expect(response.body.message).toContain('New password is required');
      });

      it('should return 400 when currentPassword is too short', async () => {
        const passwordData = {
          currentPassword: 'short',
          newPassword: 'NewSecurePass456!'
        };

        const response = await request(app)
          .put(`${API_BASE}/password`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(passwordData)
          .expect(400);

        expect(response.body.message).toContain('Current password must be between 8 and 128 characters');
      });

      it('should return 400 when newPassword is too short', async () => {
        const passwordData = {
          currentPassword: validUserData.password,
          newPassword: 'short'
        };

        const response = await request(app)
          .put(`${API_BASE}/password`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(passwordData)
          .expect(400);

        expect(response.body.message).toContain('New password must be between 8 and 128 characters');
      });

      it('should return 400 when newPassword is too long', async () => {
        const passwordData = {
          currentPassword: validUserData.password,
          newPassword: 'A'.repeat(129) + '1!' // Exceeds 128 characters
        };

        const response = await request(app)
          .put(`${API_BASE}/password`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(passwordData)
          .expect(400);

        expect(response.body.message).toContain('New password must be between 8 and 128 characters');
      });

      it('should return 400 when newPassword lacks complexity', async () => {
        const weakPasswords = [
          'password123', // No uppercase, special char
          'PASSWORD123', // No lowercase, special char
          'Password123', // No special char
          'Password!', // No number
          'password1!', // No uppercase
          'PASSWORD1!', // No lowercase
        ];

        for (const weakPassword of weakPasswords) {
          const passwordData = {
            currentPassword: validUserData.password,
            newPassword: weakPassword
          };

          const response = await request(app)
            .put(`${API_BASE}/password`)
            .set('Authorization', `Bearer ${accessToken}`)
            .send(passwordData)
            .expect(400);

          expect(response.body.message).toContain('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
        }
      });

      it('should return 400 when newPassword is same as currentPassword', async () => {
        const passwordData = {
          currentPassword: validUserData.password,
          newPassword: validUserData.password // Same as current
        };

        const response = await request(app)
          .put(`${API_BASE}/password`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(passwordData)
          .expect(400);

        expect(response.body.message).toContain('New password must be different from current password');
      });
    });

    describe('Authentication Errors (401)', () => {
      it('should return 401 when Authorization header is missing', async () => {
        const passwordData = {
          currentPassword: validUserData.password,
          newPassword: 'NewSecurePass456!'
        };

        const response = await request(app)
          .put(`${API_BASE}/password`)
          .send(passwordData)
          .expect(401);

        expect(response.body.message).toContain('Access token required');
      });

      it('should return 401 when token is invalid', async () => {
        const passwordData = {
          currentPassword: validUserData.password,
          newPassword: 'NewSecurePass456!'
        };
        const invalidToken = 'invalid.jwt.token';

        const response = await request(app)
          .put(`${API_BASE}/password`)
          .set('Authorization', `Bearer ${invalidToken}`)
          .send(passwordData)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired access token');
      });

      it('should return 401 when currentPassword is incorrect', async () => {
        const passwordData = {
          currentPassword: 'WrongPassword123!',
          newPassword: 'NewSecurePass456!'
        };

        const response = await request(app)
          .put(`${API_BASE}/password`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(passwordData)
          .expect(401);

        expect(response.body.message).toContain('Current password is incorrect');
      });

      it('should return 401 when token is expired', async () => {
        const passwordData = {
          currentPassword: validUserData.password,
          newPassword: 'NewSecurePass456!'
        };

        // Create an expired token
        const expiredToken = jwt.sign(
          { userId: userId, email: validUserData.email },
          config.jwt.accessTokenSecret,
          { expiresIn: '-1h' } // Expired 1 hour ago
        );

        const response = await request(app)
          .put(`${API_BASE}/password`)
          .set('Authorization', `Bearer ${expiredToken}`)
          .send(passwordData)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired access token');
      });
    });

    describe('Not Found Errors (404)', () => {
      it('should return 404 when user does not exist', async () => {
        const passwordData = {
          currentPassword: validUserData.password,
          newPassword: 'NewSecurePass456!'
        };

        // Create token with non-existent user ID
        const nonExistentUserId = '64a7b8c9d0e1f2a3b4c5d999';
        const tokenWithInvalidUser = jwt.sign(
          { userId: nonExistentUserId, email: 'nonexistent@example.com' },
          config.jwt.accessTokenSecret,
          { expiresIn: '15m' }
        );

        const response = await request(app)
          .put(`${API_BASE}/password`)
          .set('Authorization', `Bearer ${tokenWithInvalidUser}`)
          .send(passwordData)
          .expect(404);

        expect(response.body.message).toContain('User not found');
      });
    });
  });
});