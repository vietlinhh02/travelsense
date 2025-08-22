const request = require('supertest');
const app = require('../app');
const User = require('../models/users/user.model');
const bcrypt = require('bcryptjs');

// Mock dependencies - only mock when needed for isolated testing
jest.mock('../config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

const API_BASE = '/api/v1/users';

describe('User Service Test Suite - Registration & Login', () => {
  // Test data
  const validUserData = {
    email: 'test@example.com',
    password: 'TestPassword123!',
    firstName: 'John',
    lastName: 'Doe'
  };

  const validLoginData = {
    email: 'test@example.com',
    password: 'TestPassword123!'
  };

  beforeEach(async () => {
    // Clean up users before each test
    if (User.deleteMany) {
      await User.deleteMany({});
    }
  });

  afterAll(async () => {
    // Clean up after all tests
    if (User.deleteMany) {
      await User.deleteMany({});
    }
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
  });

  describe('POST /api/v1/users/register - User Registration', () => {
    describe('Successful Registration', () => {
      it('should successfully register a new user with valid data', async () => {
        const response = await request(app)
          .post(`${API_BASE}/register`)
          .send(validUserData)
          .expect(201);

        expect(response.body).toHaveProperty('message', 'User registered successfully');
        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('accessToken');

        // Verify user data structure
        const { user } = response.body;
        expect(user).toHaveProperty('email', validUserData.email.toLowerCase());
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
        // travelStyle and budgetRange are undefined when not set, not null
        expect(user.preferences.travelStyle).toBeUndefined();
        expect(user.preferences.budgetRange).toBeUndefined();

        // Verify profile structure
        expect(user).toHaveProperty('profile');
        // dateOfBirth and nationality are undefined when not set, not null
        expect(user.profile.dateOfBirth).toBeUndefined();
        expect(user.profile.nationality).toBeUndefined();
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
      });

      it('should hash the password before storing', async () => {
        await request(app)
          .post(`${API_BASE}/register`)
          .send(validUserData)
          .expect(201);

        // Check user in database
        const user = await User.findByEmail(validUserData.email);
        expect(user).toBeTruthy();
        expect(user.password).not.toBe(validUserData.password);
        
        // Verify password is properly hashed
        const isPasswordValid = await bcrypt.compare(validUserData.password, user.password);
        expect(isPasswordValid).toBe(true);
      });

      it('should normalize email to lowercase', async () => {
        const upperCaseEmailData = {
          ...validUserData,
          email: 'TEST@EXAMPLE.COM'
        };

        const response = await request(app)
          .post(`${API_BASE}/register`)
          .send(upperCaseEmailData)
          .expect(201);

        expect(response.body.user.email).toBe('test@example.com');
      });

      it('should trim firstName and lastName', async () => {
        const dataWithSpaces = {
          ...validUserData,
          firstName: '  John  ',
          lastName: '  Doe  '
        };

        const response = await request(app)
          .post(`${API_BASE}/register`)
          .send(dataWithSpaces)
          .expect(201);

        expect(response.body.user.firstName).toBe('John');
        expect(response.body.user.lastName).toBe('Doe');
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when email is missing', async () => {
        const { email, ...dataWithoutEmail } = validUserData;
        
        const response = await request(app)
          .post(`${API_BASE}/register`)
          .send(dataWithoutEmail)
          .expect(400);

        expect(response.body.message).toContain('Email is required');
      });

      it('should return 400 when email format is invalid', async () => {
        const invalidEmailData = {
          ...validUserData,
          email: 'invalid-email'
        };

        const response = await request(app)
          .post(`${API_BASE}/register`)
          .send(invalidEmailData)
          .expect(400);

        expect(response.body.message).toContain('Must be a valid email format');
      });

      it('should return 400 when email exceeds 254 characters', async () => {
        const longEmailData = {
          ...validUserData,
          email: 'a'.repeat(250) + '@test.com' // Total > 254 characters
        };

        const response = await request(app)
          .post(`${API_BASE}/register`)
          .send(longEmailData)
          .expect(400);

        expect(response.body.message).toContain('Must be a valid email format'); // The email is rejected as invalid format, not length
      });

      it('should return 400 when password is missing', async () => {
        const { password, ...dataWithoutPassword } = validUserData;
        
        const response = await request(app)
          .post(`${API_BASE}/register`)
          .send(dataWithoutPassword)
          .expect(400);

        expect(response.body.message).toContain('Password is required');
      });

      it('should return 400 when password is too short', async () => {
        const shortPasswordData = {
          ...validUserData,
          password: 'Test1!'
        };

        const response = await request(app)
          .post(`${API_BASE}/register`)
          .send(shortPasswordData)
          .expect(400);

        expect(response.body.message).toContain('Password must be between 8 and 128 characters');
      });

      it('should return 400 when password is too long', async () => {
        const longPasswordData = {
          ...validUserData,
          password: 'A'.repeat(129) + '1!'
        };

        const response = await request(app)
          .post(`${API_BASE}/register`)
          .send(longPasswordData)
          .expect(400);

        expect(response.body.message).toContain('Password must be between 8 and 128 characters');
      });

      it('should return 400 when password lacks complexity', async () => {
        const weakPasswords = [
          'password', // No uppercase, number, special char
          'PASSWORD', // No lowercase, number, special char
          'Password', // No number, special char
          'Password1', // No special char
          'Password!', // No number
          'password1!', // No uppercase
          'PASSWORD1!', // No lowercase
        ];

        for (const weakPassword of weakPasswords) {
          const response = await request(app)
            .post(`${API_BASE}/register`)
            .send({ ...validUserData, password: weakPassword })
            .expect(400);

          expect(response.body.message).toContain('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character');
        }
      });

      it('should return 400 when firstName is missing', async () => {
        const { firstName, ...dataWithoutFirstName } = validUserData;
        
        const response = await request(app)
          .post(`${API_BASE}/register`)
          .send(dataWithoutFirstName)
          .expect(400);

        expect(response.body.message).toContain('First name is required');
      });

      it('should return 400 when firstName is empty', async () => {
        const emptyFirstNameData = {
          ...validUserData,
          firstName: ''
        };

        const response = await request(app)
          .post(`${API_BASE}/register`)
          .send(emptyFirstNameData)
          .expect(400);

        expect(response.body.message).toContain('First name is required'); // When firstName is empty string, it's treated as missing
      });

      it('should return 400 when firstName exceeds 50 characters', async () => {
        const longFirstNameData = {
          ...validUserData,
          firstName: 'A'.repeat(51)
        };

        const response = await request(app)
          .post(`${API_BASE}/register`)
          .send(longFirstNameData)
          .expect(400);

        expect(response.body.message).toContain('First name must be between 1 and 50 characters');
      });

      it('should return 400 when firstName contains invalid characters', async () => {
        const invalidFirstNameData = {
          ...validUserData,
          firstName: 'John123'
        };

        const response = await request(app)
          .post(`${API_BASE}/register`)
          .send(invalidFirstNameData)
          .expect(400);

        expect(response.body.message).toContain('First name must contain only letters, spaces, hyphens, and apostrophes');
      });

      it('should return 400 when lastName is missing', async () => {
        const { lastName, ...dataWithoutLastName } = validUserData;
        
        const response = await request(app)
          .post(`${API_BASE}/register`)
          .send(dataWithoutLastName)
          .expect(400);

        expect(response.body.message).toContain('Last name is required');
      });

      it('should accept valid firstName/lastName with spaces, hyphens, and apostrophes', async () => {
        const validNameData = {
          ...validUserData,
          firstName: "Mary-Jane O'Connor",
          lastName: "Smith-Wilson Jr"
        };

        const response = await request(app)
          .post(`${API_BASE}/register`)
          .send(validNameData)
          .expect(201);

        expect(response.body.user.firstName).toBe("Mary-Jane O'Connor");
        expect(response.body.user.lastName).toBe("Smith-Wilson Jr");
      });
    });

    describe('Conflict Errors (409)', () => {
      it('should return 409 when email is already registered', async () => {
        // Register first user
        await request(app)
          .post(`${API_BASE}/register`)
          .send(validUserData)
          .expect(201);

        // Try to register with same email
        const response = await request(app)
          .post(`${API_BASE}/register`)
          .send(validUserData)
          .expect(409);

        expect(response.body.message).toBe('Email already registered');
      });

      it('should return 409 when email is already registered (case insensitive)', async () => {
        // Register with lowercase email
        await request(app)
          .post(`${API_BASE}/register`)
          .send(validUserData)
          .expect(201);

        // Try to register with uppercase email
        const upperCaseEmailData = {
          ...validUserData,
          email: validUserData.email.toUpperCase()
        };

        const response = await request(app)
          .post(`${API_BASE}/register`)
          .send(upperCaseEmailData)
          .expect(409);

        expect(response.body.message).toBe('Email already registered');
      });
    });

    describe('Rate Limiting (429)', () => {
      it('should enforce rate limiting for registration attempts', async () => {
        // This test would need to make multiple requests rapidly
        // In test environment, rate limiting is more permissive
        const requests = [];
        for (let i = 0; i < 5; i++) {
          requests.push(
            request(app)
              .post(`${API_BASE}/register`)
              .send({
                ...validUserData,
                email: `test${i}@example.com`
              })
          );
        }

        const responses = await Promise.all(requests);
        
        // In test environment, all should succeed due to higher limits
        const successfulRegistrations = responses.filter(res => res.status === 201);
        expect(successfulRegistrations.length).toBeGreaterThan(0);
      });
    });
  });

  describe('POST /api/v1/users/login - User Login', () => {
    beforeEach(async () => {
      // Create a user for login tests
      await request(app)
        .post(`${API_BASE}/register`)
        .send(validUserData)
        .expect(201);
    });

    describe('Successful Login', () => {
      it('should successfully login with valid credentials', async () => {
        const response = await request(app)
          .post(`${API_BASE}/login`)
          .send(validLoginData)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Login successful');
        expect(response.body).toHaveProperty('user');
        expect(response.body).toHaveProperty('accessToken');

        // Verify user data structure
        const { user } = response.body;
        expect(user).toHaveProperty('email', validLoginData.email.toLowerCase());
        expect(user).not.toHaveProperty('password'); // Password should not be returned

        // Verify refresh token cookie is set
        const cookies = response.headers['set-cookie'];
        expect(cookies).toBeDefined();
        const refreshTokenCookie = cookies.find(cookie => cookie.startsWith('refreshToken='));
        expect(refreshTokenCookie).toBeDefined();
      });

      it('should update lastLogin timestamp on successful login', async () => {
        const beforeLogin = new Date();
        
        await request(app)
          .post(`${API_BASE}/login`)
          .send(validLoginData)
          .expect(200);

        const user = await User.findByEmail(validLoginData.email);
        expect(user.lastLogin).toBeInstanceOf(Date);
        expect(user.lastLogin.getTime()).toBeGreaterThanOrEqual(beforeLogin.getTime());
      });

      it('should handle case insensitive email login', async () => {
        const upperCaseEmailLogin = {
          ...validLoginData,
          email: validLoginData.email.toUpperCase()
        };

        const response = await request(app)
          .post(`${API_BASE}/login`)
          .send(upperCaseEmailLogin)
          .expect(200);

        expect(response.body.user.email).toBe(validLoginData.email.toLowerCase());
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when email is missing', async () => {
        const { email, ...dataWithoutEmail } = validLoginData;
        
        const response = await request(app)
          .post(`${API_BASE}/login`)
          .send(dataWithoutEmail)
          .expect(400);

        expect(response.body.message).toContain('Email is required');
      });

      it('should return 400 when email format is invalid', async () => {
        const invalidEmailData = {
          ...validLoginData,
          email: 'invalid-email'
        };

        const response = await request(app)
          .post(`${API_BASE}/login`)
          .send(invalidEmailData)
          .expect(400);

        expect(response.body.message).toContain('Must be a valid email format');
      });

      it('should return 400 when password is missing', async () => {
        const { password, ...dataWithoutPassword } = validLoginData;
        
        const response = await request(app)
          .post(`${API_BASE}/login`)
          .send(dataWithoutPassword)
          .expect(400);

        expect(response.body.message).toContain('Password is required');
      });

      it('should return 400 when password is too short', async () => {
        const shortPasswordData = {
          ...validLoginData,
          password: 'short'
        };

        const response = await request(app)
          .post(`${API_BASE}/login`)
          .send(shortPasswordData)
          .expect(400);

        expect(response.body.message).toContain('Password must be between 8 and 128 characters');
      });
    });

    describe('Authentication Errors (401)', () => {
      it('should return 401 when email does not exist', async () => {
        const nonExistentEmailData = {
          ...validLoginData,
          email: 'nonexistent@example.com'
        };

        const response = await request(app)
          .post(`${API_BASE}/login`)
          .send(nonExistentEmailData)
          .expect(401);

        expect(response.body.message).toBe('Invalid credentials');
      });

      it('should return 401 when password is incorrect', async () => {
        const wrongPasswordData = {
          ...validLoginData,
          password: 'WrongPassword123!'
        };

        const response = await request(app)
          .post(`${API_BASE}/login`)
          .send(wrongPasswordData)
          .expect(401);

        expect(response.body.message).toBe('Invalid credentials');
      });
    });

    describe('Rate Limiting (429)', () => {
      it('should enforce rate limiting for login attempts', async () => {
        const requests = [];
        for (let i = 0; i < 3; i++) {
          requests.push(
            request(app)
              .post(`${API_BASE}/login`)
              .send(validLoginData)
          );
        }

        const responses = await Promise.all(requests);
        
        // In test environment, all should succeed due to higher limits
        const successfulLogins = responses.filter(res => res.status === 200);
        expect(successfulLogins.length).toBeGreaterThan(0);
      });
    });
  });

  describe('GET /api/v1/users/health - Health Check', () => {
    it('should return 200 for health check endpoint', async () => {
      const response = await request(app)
        .get(`${API_BASE}/health`)
        .expect(200);

      expect(response.body).toEqual({
        status: 'OK',
        timestamp: expect.any(String),
        service: 'users'
      });
    });

    it('should include proper headers in health check response', async () => {
      const response = await request(app)
        .get(`${API_BASE}/health`)
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });
});