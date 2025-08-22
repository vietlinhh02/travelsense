const request = require('supertest');
const app = require('../app');
const User = require('../models/users/user.model');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

// Base API path for tests
const API_BASE = '/api/v1/users';

describe('User Service Test Suite - Profile Management', () => {
  let testUser;
  let accessToken;
  let userId;

  // Valid user data for testing
  const validUserData = {
    email: 'profile.test@example.com',
    password: 'TestPass123!',
    firstName: 'Profile',
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

  describe('GET /api/v1/users/profile - Get User Profile', () => {
    describe('Successful Profile Retrieval', () => {
      it('should successfully retrieve user profile with valid token', async () => {
        const response = await request(app)
          .get(`${API_BASE}/profile`)
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('user');
        const user = response.body.user;

        // Verify basic user information
        expect(user).toHaveProperty('_id', userId);
        expect(user).toHaveProperty('email', validUserData.email);
        expect(user).toHaveProperty('firstName', validUserData.firstName);
        expect(user).toHaveProperty('lastName', validUserData.lastName);
        expect(user).toHaveProperty('emailVerified', false);
        expect(user).toHaveProperty('phoneVerified', false);
        expect(user).toHaveProperty('twoFactorEnabled', false);
        expect(user).not.toHaveProperty('password'); // Password should not be returned

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
      });
    });

    describe('Authentication Errors (401)', () => {
      it('should return 401 when Authorization header is missing', async () => {
        const response = await request(app)
          .get(`${API_BASE}/profile`)
          .expect(401);

        expect(response.body.message).toContain('Access token required');
      });

      it('should return 401 when Bearer token is malformed', async () => {
        const response = await request(app)
          .get(`${API_BASE}/profile`)
          .set('Authorization', 'InvalidFormat token.here')
          .expect(401);

        expect(response.body.message).toContain('Invalid token format');
      });

      it('should return 401 when token is missing after Bearer', async () => {
        const response = await request(app)
          .get(`${API_BASE}/profile`)
          .set('Authorization', 'Bearer ')
          .expect(401);

        expect(response.body.message).toContain('Invalid token format'); // When token is missing after Bearer, validation returns this message
      });

      it('should return 401 when token is invalid', async () => {
        const invalidToken = 'invalid.jwt.token';
        
        const response = await request(app)
          .get(`${API_BASE}/profile`)
          .set('Authorization', `Bearer ${invalidToken}`)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired access token');
      });

      it('should return 401 when token is expired', async () => {
        // Create an expired token
        const expiredToken = jwt.sign(
          { userId: userId, email: validUserData.email },
          config.jwt.accessTokenSecret,
          { expiresIn: '-1h' } // Expired 1 hour ago
        );

        const response = await request(app)
          .get(`${API_BASE}/profile`)
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired access token');
      });
    });

    describe('Not Found Errors (404)', () => {
      it('should return 404 when user does not exist', async () => {
        // Create token with non-existent user ID
        const nonExistentUserId = '64a7b8c9d0e1f2a3b4c5d999';
        const tokenWithInvalidUser = jwt.sign(
          { userId: nonExistentUserId, email: 'nonexistent@example.com' },
          config.jwt.accessTokenSecret,
          { expiresIn: '15m' }
        );

        const response = await request(app)
          .get(`${API_BASE}/profile`)
          .set('Authorization', `Bearer ${tokenWithInvalidUser}`)
          .expect(404);

        expect(response.body.message).toContain('User not found');
      });
    });
  });

  describe('PUT /api/v1/users/profile - Update User Profile', () => {
    describe('Successful Profile Updates', () => {
      it('should successfully update basic profile information', async () => {
        const updateData = {
          firstName: 'UpdatedFirst',
          lastName: 'UpdatedLast'
        };

        const response = await request(app)
          .put(`${API_BASE}/profile`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Profile updated successfully');
        expect(response.body).toHaveProperty('user');
        const user = response.body.user;

        expect(user.firstName).toBe(updateData.firstName);
        expect(user.lastName).toBe(updateData.lastName);
        expect(user.email).toBe(validUserData.email); // Email should remain unchanged
      });

      it('should successfully update preferences', async () => {
        const updateData = {
          preferences: {
            interests: ['travel', 'photography', 'food'],
            constraints: ['budget-friendly', 'pet-friendly'],
            travelStyle: 'adventure',
            budgetRange: 'medium'
          }
        };

        const response = await request(app)
          .put(`${API_BASE}/profile`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Profile updated successfully');
        const user = response.body.user;

        expect(user.preferences.interests).toEqual(updateData.preferences.interests);
        expect(user.preferences.constraints).toEqual(updateData.preferences.constraints);
        expect(user.preferences.travelStyle).toBe(updateData.preferences.travelStyle);
        expect(user.preferences.budgetRange).toBe(updateData.preferences.budgetRange);
      });

      it('should successfully update profile information', async () => {
        const updateData = {
          profile: {
            dateOfBirth: '1990-05-15',
            nationality: 'American',
            languages: ['English', 'Spanish', 'French'],
            specialRequirements: ['wheelchair accessible', 'vegetarian meals']
          }
        };

        const response = await request(app)
          .put(`${API_BASE}/profile`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Profile updated successfully');
        const user = response.body.user;

        expect(new Date(user.profile.dateOfBirth).toISOString().split('T')[0]).toBe(updateData.profile.dateOfBirth);
        expect(user.profile.nationality).toBe(updateData.profile.nationality);
        expect(user.profile.languages).toEqual(updateData.profile.languages);
        expect(user.profile.specialRequirements).toEqual(updateData.profile.specialRequirements);
      });

      it('should successfully update partial fields', async () => {
        const updateData = {
          firstName: 'PartialUpdate',
          preferences: {
            interests: ['music', 'art']
          }
        };

        const response = await request(app)
          .put(`${API_BASE}/profile`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateData)
          .expect(200);

        const user = response.body.user;
        expect(user.firstName).toBe(updateData.firstName);
        expect(user.lastName).toBe(validUserData.lastName); // Should remain unchanged
        expect(user.preferences.interests).toEqual(updateData.preferences.interests);
      });

      it('should trim firstName and lastName on update', async () => {
        const updateData = {
          firstName: '  TrimFirst  ',
          lastName: '  TrimLast  '
        };

        const response = await request(app)
          .put(`${API_BASE}/profile`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateData)
          .expect(200);

        const user = response.body.user;
        expect(user.firstName).toBe('TrimFirst');
        expect(user.lastName).toBe('TrimLast');
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when firstName is too long', async () => {
        const updateData = {
          firstName: 'A'.repeat(51) // Exceeds 50 character limit
        };

        const response = await request(app)
          .put(`${API_BASE}/profile`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateData)
          .expect(400);

        expect(response.body.message).toContain('First name must be between 1 and 50 characters');
      });

      it('should return 400 when firstName contains invalid characters', async () => {
        const updateData = {
          firstName: 'John123' // Contains numbers
        };

        const response = await request(app)
          .put(`${API_BASE}/profile`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateData)
          .expect(400);

        expect(response.body.message).toContain('First name must contain only letters, spaces, hyphens, and apostrophes');
      });

      it('should return 400 when lastName is too long', async () => {
        const updateData = {
          lastName: 'B'.repeat(51) // Exceeds 50 character limit
        };

        const response = await request(app)
          .put(`${API_BASE}/profile`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateData)
          .expect(400);

        expect(response.body.message).toContain('Last name must be between 1 and 50 characters');
      });

      it('should return 400 when interests array is too large', async () => {
        const updateData = {
          preferences: {
            interests: Array(21).fill('interest') // Exceeds 20 item limit
          }
        };

        const response = await request(app)
          .put(`${API_BASE}/profile`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateData)
          .expect(400);

        expect(response.body.message).toContain('Maximum of 20 interests allowed');
      });

      it('should return 400 when interest item is too long', async () => {
        const updateData = {
          preferences: {
            interests: ['A'.repeat(51)] // Exceeds 50 character limit per item
          }
        };

        const response = await request(app)
          .put(`${API_BASE}/profile`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateData)
          .expect(400);

        expect(response.body.message).toContain('Each interest must be a string with maximum 50 characters');
      });

      it('should return 400 when travelStyle is invalid', async () => {
        const updateData = {
          preferences: {
            travelStyle: 'invalid-style'
          }
        };

        const response = await request(app)
          .put(`${API_BASE}/profile`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateData)
          .expect(400);

        expect(response.body.message).toContain('Travel style must be one of');
      });

      it('should return 400 when budgetRange is invalid', async () => {
        const updateData = {
          preferences: {
            budgetRange: 'invalid-range'
          }
        };

        const response = await request(app)
          .put(`${API_BASE}/profile`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateData)
          .expect(400);

        expect(response.body.message).toContain('Budget range must be one of');
      });

      it('should return 400 when dateOfBirth is in the future', async () => {
        const futureDate = new Date();
        futureDate.setFullYear(futureDate.getFullYear() + 1);
        
        const updateData = {
          profile: {
            dateOfBirth: futureDate.toISOString().split('T')[0]
          }
        };

        const response = await request(app)
          .put(`${API_BASE}/profile`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateData)
          .expect(400);

        expect(response.body.message).toContain('Date of birth must be in the past');
      });

      it('should return 400 when languages array is too large', async () => {
        const updateData = {
          profile: {
            languages: Array(11).fill('language') // Exceeds 10 item limit
          }
        };

        const response = await request(app)
          .put(`${API_BASE}/profile`)
          .set('Authorization', `Bearer ${accessToken}`)
          .send(updateData)
          .expect(400);

        expect(response.body.message).toContain('Maximum of 10 languages allowed');
      });
    });

    describe('Authentication Errors (401)', () => {
      it('should return 401 when Authorization header is missing', async () => {
        const updateData = { firstName: 'NewName' };

        const response = await request(app)
          .put(`${API_BASE}/profile`)
          .send(updateData)
          .expect(401);

        expect(response.body.message).toContain('Access token required');
      });

      it('should return 401 when token is invalid', async () => {
        const updateData = { firstName: 'NewName' };
        const invalidToken = 'invalid.jwt.token';

        const response = await request(app)
          .put(`${API_BASE}/profile`)
          .set('Authorization', `Bearer ${invalidToken}`)
          .send(updateData)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired access token');
      });
    });

    describe('Not Found Errors (404)', () => {
      it('should return 404 when user does not exist', async () => {
        const updateData = { firstName: 'NewName' };

        // Create token with non-existent user ID
        const nonExistentUserId = '64a7b8c9d0e1f2a3b4c5d999';
        const tokenWithInvalidUser = jwt.sign(
          { userId: nonExistentUserId, email: 'nonexistent@example.com' },
          config.jwt.accessTokenSecret,
          { expiresIn: '15m' }
        );

        const response = await request(app)
          .put(`${API_BASE}/profile`)
          .set('Authorization', `Bearer ${tokenWithInvalidUser}`)
          .send(updateData)
          .expect(404);

        expect(response.body.message).toContain('User not found');
      });
    });
  });
});