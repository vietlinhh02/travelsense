const request = require('supertest');
const app = require('../app');
const User = require('../models/users/user.model');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

// Base API path for tests
const API_BASE = '/api/v1/users';

describe('User Service Test Suite - Delete Account', () => {
  let testUser;
  let accessToken;
  let userId;

  // Valid user data for testing
  const validUserData = {
    email: 'delete.test@example.com',
    password: 'DeletePass123!',
    firstName: 'Delete',
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
    // Clean up test user if it still exists
    await User.deleteOne({ email: validUserData.email });
  });

  describe('DELETE /api/v1/users/account - Delete Account', () => {
    describe('Successful Account Deletion', () => {
      it('should successfully delete account with valid password', async () => {
        const deleteData = {
          password: validUserData.password
        };

        const response = await request(app)
          .delete(`${API_BASE}/account`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(deleteData)
          .expect(204);

        // Response should be empty for 204 No Content
        expect(response.body).toEqual({});

        // Verify user is deleted from database
        const deletedUser = await User.findById(userId);
        expect(deletedUser).toBeNull();
      });

      it('should not allow login after account deletion', async () => {
        const deleteData = {
          password: validUserData.password
        };

        // Delete account
        await request(app)
          .delete(`${API_BASE}/account`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(deleteData)
          .expect(204);

        // Try to login with deleted account
        const loginResponse = await request(app)
          .post(`${API_BASE}/login`)
          .send({
            email: validUserData.email,
            password: validUserData.password
          })
          .expect(401);

        expect(loginResponse.body.message).toContain('Invalid credentials');
      });

      it('should not allow access to protected endpoints after deletion', async () => {
        const deleteData = {
          password: validUserData.password
        };

        // Delete account
        await request(app)
          .delete(`${API_BASE}/account`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(deleteData)
          .expect(204);

        // Try to access profile with same token
        const profileResponse = await request(app)
          .get(`${API_BASE}/profile`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(404);

        expect(profileResponse.body.message).toContain('User not found');
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when password is missing', async () => {
        const deleteData = {}; // No password

        const response = await request(app)
          .delete(`${API_BASE}/account`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(deleteData)
          .expect(400);

        expect(response.body.message).toContain('Password is required');

        // Verify user still exists
        const user = await User.findById(userId);
        expect(user).toBeTruthy();
      });

      it('should return 400 when password is empty string', async () => {
        const deleteData = {
          password: ''
        };

        const response = await request(app)
          .delete(`${API_BASE}/account`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(deleteData)
          .expect(400);

        expect(response.body.message).toContain('Password is required');

        // Verify user still exists
        const user = await User.findById(userId);
        expect(user).toBeTruthy();
      });

      it('should return 400 when password is too short', async () => {
        const deleteData = {
          password: 'short'
        };

        const response = await request(app)
          .delete(`${API_BASE}/account`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(deleteData)
          .expect(400);

        expect(response.body.message).toContain('Password must be between 8 and 128 characters');

        // Verify user still exists
        const user = await User.findById(userId);
        expect(user).toBeTruthy();
      });

      it('should return 400 when password is too long', async () => {
        const deleteData = {
          password: 'A'.repeat(129) // Exceeds 128 characters
        };

        const response = await request(app)
          .delete(`${API_BASE}/account`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(deleteData)
          .expect(400);

        expect(response.body.message).toContain('Password must be between 8 and 128 characters');

        // Verify user still exists
        const user = await User.findById(userId);
        expect(user).toBeTruthy();
      });
    });

    describe('Authentication Errors (401)', () => {
      it('should return 401 when Authorization header is missing', async () => {
        const deleteData = {
          password: validUserData.password
        };

        const response = await request(app)
          .delete(`${API_BASE}/account`)
          .send(deleteData)
          .expect(401);

        expect(response.body.message).toContain('Access token required');

        // Verify user still exists
        const user = await User.findById(userId);
        expect(user).toBeTruthy();
      });

      it('should return 401 when token is invalid', async () => {
        const deleteData = {
          password: validUserData.password
        };
        const invalidToken = 'invalid.jwt.token';

        const response = await request(app)
          .delete(`${API_BASE}/account`)
          .set('Authorization', `Bearer ${invalidToken}`)
          .send(deleteData)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired access token');

        // Verify user still exists
        const user = await User.findById(userId);
        expect(user).toBeTruthy();
      });

      it('should return 401 when password is incorrect', async () => {
        const deleteData = {
          password: 'WrongPassword123!'
        };

        const response = await request(app)
          .delete(`${API_BASE}/account`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(deleteData)
          .expect(401);

        expect(response.body.message).toContain('Password is incorrect');

        // Verify user still exists
        const user = await User.findById(userId);
        expect(user).toBeTruthy();
      });

      it('should return 401 when token is expired', async () => {
        const deleteData = {
          password: validUserData.password
        };

        // Create an expired token
        const expiredToken = jwt.sign(
          { userId: userId, email: validUserData.email },
          config.jwt.accessTokenSecret,
          { expiresIn: '-1h' } // Expired 1 hour ago
        );

        const response = await request(app)
          .delete(`${API_BASE}/account`)
          .set('Authorization', `Bearer ${expiredToken}`)
          .send(deleteData)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired access token');

        // Verify user still exists
        const user = await User.findById(userId);
        expect(user).toBeTruthy();
      });
    });

    describe('Not Found Errors (404)', () => {
      it('should return 404 when user does not exist', async () => {
        const deleteData = {
          password: validUserData.password
        };

        // Create token with non-existent user ID
        const nonExistentUserId = '64a7b8c9d0e1f2a3b4c5d999';
        const tokenWithInvalidUser = jwt.sign(
          { userId: nonExistentUserId, email: 'nonexistent@example.com' },
          config.jwt.accessTokenSecret,
          { expiresIn: '15m' }
        );

        const response = await request(app)
          .delete(`${API_BASE}/account`)
          .set('Authorization', `Bearer ${tokenWithInvalidUser}`)
          .send(deleteData)
          .expect(404);

        expect(response.body.message).toContain('User not found');
      });
    });

    describe('Security Considerations', () => {
      it('should not delete account with valid token but wrong password', async () => {
        const deleteData = {
          password: 'CompletelyWrongPassword123!'
        };

        const response = await request(app)
          .delete(`${API_BASE}/account`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(deleteData)
          .expect(401);

        expect(response.body.message).toContain('Password is incorrect');

        // Verify user still exists and can still login
        const user = await User.findById(userId);
        expect(user).toBeTruthy();

        // Verify user can still login with correct password
        const loginResponse = await request(app)
          .post(`${API_BASE}/login`)
          .send({
            email: validUserData.email,
            password: validUserData.password
          })
          .expect(200);

        expect(loginResponse.body).toHaveProperty('accessToken');
      });

      it('should require exact password match (case sensitive)', async () => {
        const deleteData = {
          password: validUserData.password.toLowerCase() // Change case
        };

        const response = await request(app)
          .delete(`${API_BASE}/account`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(deleteData)
          .expect(401);

        expect(response.body.message).toContain('Password is incorrect');

        // Verify user still exists
        const user = await User.findById(userId);
        expect(user).toBeTruthy();
      });
    });
  });
});