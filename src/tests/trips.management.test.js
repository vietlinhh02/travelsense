const request = require('supertest');
const createTestApp = require('./setup/testApp');
const { clearMockDB } = require('./setup/mockDb');
const { Trip } = require('../models/trips');
const User = require('../models/users/user.model');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

// Create test app instance
const app = createTestApp();

// Mock dependencies - only mock when needed for isolated testing
jest.mock('../config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Mock the Trip model methods
jest.mock('../models/trips', () => {
  const mockTrip = function(data) {
    // Ensure default values for travelers - always include children and infants
    const travelers = {
      adults: data.travelers.adults || 1,
      children: data.travelers.children !== undefined ? data.travelers.children : 0,
      infants: data.travelers.infants !== undefined ? data.travelers.infants : 0
    };
    
    // Calculate virtual fields
    const startDate = new Date(data.destination.startDate);
    const endDate = new Date(data.destination.endDate);
    const timeDiff = endDate.getTime() - startDate.getTime();
    const duration = Math.ceil(timeDiff / (1000 * 3600 * 24));
    const totalTravelers = travelers.adults + travelers.children + travelers.infants;
    
    const instance = {
      _id: '507f1f77bcf86cd799439012',
      ...data,
      travelers,
      destination: {
        ...data.destination,
        startDate: startDate,
        endDate: endDate
      },
      save: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439012',
        ...data,
        travelers,
        destination: {
          ...data.destination,
          startDate: startDate,
          endDate: endDate
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        duration,
        totalTravelers
      }),
      toPublicJSON: jest.fn().mockReturnValue({
        _id: '507f1f77bcf86cd799439012',
        ...data,
        travelers,
        destination: {
          ...data.destination,
          startDate: startDate,
          endDate: endDate
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        duration,
        totalTravelers
      })
    };
    return instance;
  };
  
  mockTrip.create = jest.fn().mockImplementation((data) => {
    // Calculate duration from string dates
    const startDate = new Date(data.destination.startDate);
    const endDate = new Date(data.destination.endDate);
    const timeDiff = endDate.getTime() - startDate.getTime();
    const duration = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    // Ensure default values for travelers - always include children and infants
    const travelers = {
      adults: data.travelers.adults || 1,
      children: data.travelers.children !== undefined ? data.travelers.children : 0,
      infants: data.travelers.infants !== undefined ? data.travelers.infants : 0
    };
    
    // Create mock trip with proper structure including virtual fields
    const mockTripData = {
      _id: '507f1f77bcf86cd799439012',
      ...data,
      travelers,
      destination: {
        ...data.destination,
        startDate: startDate,
        endDate: endDate
      },
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      duration: duration,
      totalTravelers: travelers.adults + travelers.children + travelers.infants,
      itinerary: { days: [] }
    };
    
    const instance = {
      ...mockTripData,
      toPublicJSON: jest.fn().mockReturnValue(mockTripData)
    };
    return Promise.resolve(instance);
  });
  
  mockTrip.findById = jest.fn();
  mockTrip.findOne = jest.fn();
  mockTrip.find = jest.fn();
  mockTrip.countDocuments = jest.fn();
  mockTrip.findByIdAndUpdate = jest.fn();
  mockTrip.findByIdAndDelete = jest.fn();
  mockTrip.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });
  
  return { Trip: mockTrip };
});

// Mock the User model methods
jest.mock('../models/users/user.model', () => {
  const mockUser = function(data) {
    return {
      _id: '507f1f77bcf86cd799439011',
      ...data,
      save: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        ...data
      })
    };
  };
  
  mockUser.findById = jest.fn();
  mockUser.create = jest.fn();
  mockUser.deleteMany = jest.fn().mockResolvedValue({ deletedCount: 0 });
  
  return mockUser;
});

const API_BASE = '/api/v1/trips';

describe('Trip Service Test Suite - Trip Management', () => {
  let testUser;
  let authToken;
  let userId;

  // Test data
  const validTripData = {
    name: 'Weekend in Paris',
    destination: {
      origin: 'London',
      destination: 'Paris',
      startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
      endDate: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // 9 days from now
    },
    travelers: {
      adults: 2,
      children: 0,
      infants: 0
    },
    budget: {
      total: 1500,
      currency: 'EUR'
    },
    preferences: {
      interests: ['museums', 'cafes', 'architecture'],
      constraints: ['no early flights', 'vegetarian food'],
      specialRequests: ['accessibility required']
    }
  };

  const validUserData = {
    email: 'trip.test@example.com',
    password: 'TestPassword123!',
    firstName: 'Trip',
    lastName: 'Tester'
  };

  beforeAll(async () => {
    // Test setup is handled by Jest setup files
    // beforeAll now just prepares test data that's constant across tests
  });

  beforeEach(async () => {
    // Clear mock calls
    await clearMockDB();
    jest.clearAllMocks();
    
    // Create mock test user
    const mockUserId = '507f1f77bcf86cd799439011';
    testUser = {
      _id: mockUserId,
      ...validUserData,
      save: jest.fn().mockResolvedValue(true)
    };
    userId = mockUserId;
    
    // Generate auth token
    authToken = jwt.sign(
      { userId: mockUserId, email: validUserData.email },
      config.jwt.accessTokenSecret,
      { expiresIn: '1h' }
    );
    
    // Setup User mock responses
    User.findById.mockResolvedValue(testUser);
    User.create.mockResolvedValue(testUser);
    
    // Setup Trip mock responses
    const { Trip } = require('../models/trips');
    const mockTripData = {
      _id: '507f1f77bcf86cd799439012',
      ...validTripData,
      userId: mockUserId,
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date(),
      duration: 2,
      totalTravelers: 2,
      itinerary: { days: [] }
    };
    
    const mockTrip = {
      ...mockTripData,
      toPublicJSON: jest.fn().mockReturnValue(mockTripData),
      isOwnedBy: jest.fn().mockImplementation((userId) => {
        return mockTripData.userId === userId;
      }),
      save: jest.fn().mockResolvedValue(mockTripData)
    };
    
    Trip.create.mockResolvedValue(mockTrip);
    
    // Mock countDocuments for pagination
    Trip.countDocuments.mockResolvedValue(1);
    
    // Mock findById to return trip for valid IDs, null for invalid ones
    Trip.findById.mockImplementation((id) => {
      if (id === '507f1f77bcf86cd799439012' || id === mockTripData._id) {
        const tripWithMethods = {
          ...mockTrip,
          isOwnedBy: jest.fn().mockImplementation((userId) => {
            return mockTripData.userId === userId;
          })
        };
        return Promise.resolve(tripWithMethods);
      }
      // Simulate CastError for invalid ObjectId format
      if (id === 'invalid-id') {
        const error = new Error('Cast to ObjectId failed');
        error.name = 'CastError';
        throw error;
      }
      // Return null for non-existent trips
      return Promise.resolve(null);
    });
    
    Trip.find.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([mockTripData])
          })
        })
      }),
      lean: jest.fn().mockResolvedValue([mockTripData])
    });
    
    Trip.findByIdAndUpdate.mockResolvedValue(mockTrip);
    Trip.findByIdAndDelete.mockResolvedValue(mockTrip);
  });

  afterAll(async () => {
    // Final cleanup handled by Jest setup files
    // Just ensure any test-specific cleanup is done
  });

  describe('POST /api/v1/trips - Create Trip', () => {
    describe('Successful Trip Creation', () => {
      it('should successfully create a new trip with valid data', async () => {
        const response = await request(app)
          .post(API_BASE)
          .set('Authorization', `Bearer ${authToken}`)
          .send(validTripData)
          .expect(201);

        expect(response.body).toHaveProperty('message', 'Trip created successfully');
        expect(response.body).toHaveProperty('trip');

        // Verify trip data structure
        const { trip } = response.body;
        expect(trip).toHaveProperty('_id');
        expect(trip).toHaveProperty('userId', userId);
        expect(trip).toHaveProperty('name', validTripData.name);
        expect(trip).toHaveProperty('status', 'draft');

        // Verify destination structure
        expect(trip.destination).toHaveProperty('origin', validTripData.destination.origin);
        expect(trip.destination).toHaveProperty('destination', validTripData.destination.destination);
        expect(trip.destination).toHaveProperty('startDate');
        expect(trip.destination).toHaveProperty('endDate');

        // Verify travelers structure
        expect(trip.travelers).toHaveProperty('adults', validTripData.travelers.adults);
        expect(trip.travelers).toHaveProperty('children', validTripData.travelers.children);
        expect(trip.travelers).toHaveProperty('infants', validTripData.travelers.infants);

        // Verify budget structure
        expect(trip.budget).toHaveProperty('total', validTripData.budget.total);
        expect(trip.budget).toHaveProperty('currency', validTripData.budget.currency);

        // Verify preferences structure
        expect(trip.preferences).toHaveProperty('interests', validTripData.preferences.interests);
        expect(trip.preferences).toHaveProperty('constraints', validTripData.preferences.constraints);
        expect(trip.preferences).toHaveProperty('specialRequests', validTripData.preferences.specialRequests);

        // Verify itinerary structure (should be empty initially)
        expect(trip.itinerary).toHaveProperty('days', []);

        // Verify virtual fields
        expect(trip).toHaveProperty('duration', 2); // 2 days
        expect(trip).toHaveProperty('totalTravelers', 2); // 2 adults

        // Verify timestamps
        expect(trip).toHaveProperty('createdAt');
        expect(trip).toHaveProperty('updatedAt');
      });

      it('should create trip with minimal required data', async () => {
        const minimalTripData = {
          name: 'Business Trip',
          destination: {
            origin: 'New York',
            destination: 'Tokyo',
            startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          },
          travelers: {
            adults: 1
          }
        };

        const response = await request(app)
          .post(API_BASE)
          .set('Authorization', `Bearer ${authToken}`)
          .send(minimalTripData)
          .expect(201);

        expect(response.body).toHaveProperty('message', 'Trip created successfully');
        expect(response.body.trip).toHaveProperty('name', minimalTripData.name);
        expect(response.body.trip.travelers).toHaveProperty('children', 0); // Default value
        expect(response.body.trip.travelers).toHaveProperty('infants', 0); // Default value
      });

      it('should normalize currency code to uppercase', async () => {
        const tripDataWithLowerCurrency = {
          ...validTripData,
          budget: {
            total: 1000,
            currency: 'usd'
          }
        };

        const response = await request(app)
          .post(API_BASE)
          .set('Authorization', `Bearer ${authToken}`)
          .send(tripDataWithLowerCurrency)
          .expect(201);

        expect(response.body.trip.budget.currency).toBe('USD');
      });
    });

    describe('Authentication Errors (401)', () => {
      it('should return 401 when no authorization token is provided', async () => {
        const response = await request(app)
          .post(API_BASE)
          .send(validTripData)
          .expect(401);

        expect(response.body.message).toContain('Access token is required');
      });

      it('should return 401 when invalid authorization token is provided', async () => {
        const response = await request(app)
          .post(API_BASE)
          .set('Authorization', 'Bearer invalid-token')
          .send(validTripData)
          .expect(401);

        expect(response.body.message).toContain('Invalid or expired access token');
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when trip name is missing', async () => {
        const { name, ...dataWithoutName } = validTripData;
        
        const response = await request(app)
          .post(API_BASE)
          .set('Authorization', `Bearer ${authToken}`)
          .send(dataWithoutName)
          .expect(400);

        expect(response.body.message).toContain('Trip name is required');
      });

      it('should return 400 when destination is missing', async () => {
        const { destination, ...dataWithoutDestination } = validTripData;
        
        const response = await request(app)
          .post(API_BASE)
          .set('Authorization', `Bearer ${authToken}`)
          .send(dataWithoutDestination)
          .expect(400);

        expect(response.body.message).toContain('Origin is required');
      });

      it('should return 400 when start date is in the past', async () => {
        const pastDateTripData = {
          ...validTripData,
          destination: {
            ...validTripData.destination,
            startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0] // Yesterday
          }
        };

        const response = await request(app)
          .post(API_BASE)
          .set('Authorization', `Bearer ${authToken}`)
          .send(pastDateTripData)
          .expect(400);

        expect(response.body.message).toContain('Start date cannot be in the past');
      });

      it('should return 400 when end date is before start date', async () => {
        const invalidDateTripData = {
          ...validTripData,
          destination: {
            ...validTripData.destination,
            startDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          }
        };

        const response = await request(app)
          .post(API_BASE)
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidDateTripData)
          .expect(400);

        expect(response.body.message).toContain('End date must be after start date');
      });

      it('should return 400 when adults count is zero', async () => {
        const noAdultsTripData = {
          ...validTripData,
          travelers: {
            adults: 0,
            children: 2
          }
        };

        const response = await request(app)
          .post(API_BASE)
          .set('Authorization', `Bearer ${authToken}`)
          .send(noAdultsTripData)
          .expect(400);

        expect(response.body.message).toContain('Adults count must be between 1 and 20');
      });

      it('should return 400 when currency code is invalid', async () => {
        const invalidCurrencyTripData = {
          ...validTripData,
          budget: {
            total: 1000,
            currency: 'INVALID'
          }
        };

        const response = await request(app)
          .post(API_BASE)
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidCurrencyTripData)
          .expect(400);

        expect(response.body.message).toContain('Currency must be a valid 3-letter ISO 4217 currency code');
      });

      it('should return 400 when interests array exceeds maximum', async () => {
        const tooManyInterestsTripData = {
          ...validTripData,
          preferences: {
            interests: Array(21).fill('interest'), // 21 interests (max is 20)
            constraints: [],
            specialRequests: []
          }
        };

        const response = await request(app)
          .post(API_BASE)
          .set('Authorization', `Bearer ${authToken}`)
          .send(tooManyInterestsTripData)
          .expect(400);

        expect(response.body.message).toContain('Maximum of 20 interests allowed');
      });
    });
  });

  describe('GET /api/v1/trips - Get User Trips', () => {
    let trip1Data, trip2Data, trip3Data;

    beforeEach(async () => {
      // Setup mock trip data
      trip1Data = {
        _id: '507f1f77bcf86cd799439013',
        ...validTripData,
        name: 'Trip 1',
        userId: testUser._id,
        status: 'draft',
        destination: {
          ...validTripData.destination,
          startDate: new Date(validTripData.destination.startDate),
          endDate: new Date(validTripData.destination.endDate)
        },
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-01'),
        duration: 2,
        totalTravelers: 2
      };

      trip2Data = {
        _id: '507f1f77bcf86cd799439014',
        ...validTripData,
        name: 'Trip 2',
        userId: testUser._id,
        status: 'planned',
        destination: {
          ...validTripData.destination,
          startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          endDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)
        },
        createdAt: new Date('2023-01-02'),
        updatedAt: new Date('2023-01-02'),
        duration: 7,
        totalTravelers: 2
      };

      trip3Data = {
        _id: '507f1f77bcf86cd799439015',
        ...validTripData,
        name: 'Trip 3',
        userId: testUser._id,
        status: 'completed',
        destination: {
          ...validTripData.destination,
          startDate: new Date(validTripData.destination.startDate),
          endDate: new Date(validTripData.destination.endDate)
        },
        createdAt: new Date('2023-01-03'),
        updatedAt: new Date('2023-01-03'),
        duration: 2,
        totalTravelers: 2
      };

      // Setup Trip.find mock to return appropriate data based on query
      const { Trip } = require('../models/trips');
      Trip.find.mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue([trip3Data, trip2Data, trip1Data]) // Default order (newest first)
            })
          })
        }),
        lean: jest.fn().mockResolvedValue([trip3Data, trip2Data, trip1Data])
      });
      
      // Setup countDocuments mock
      Trip.countDocuments.mockResolvedValue(3);
    });

    describe('Successful Trip Retrieval', () => {
      it('should return all user trips with default pagination', async () => {
        const response = await request(app)
          .get(API_BASE)
          .set('Authorization', `Bearer ${authToken}`);

        // Log the actual response for debugging
        console.log('Response status:', response.status);
        console.log('Response body:', response.body);
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('trips');
        expect(response.body).toHaveProperty('pagination');
        expect(response.body.trips).toHaveLength(3);

        // Verify pagination metadata
        expect(response.body.pagination).toHaveProperty('currentPage', 1);
        expect(response.body.pagination).toHaveProperty('totalCount', 3);
        expect(response.body.pagination).toHaveProperty('limit', 10);
        expect(response.body.pagination).toHaveProperty('offset', 0);
        expect(response.body.pagination).toHaveProperty('hasNext', false);
        expect(response.body.pagination).toHaveProperty('hasPrev', false);
      });

      it('should filter trips by status', async () => {
        // Setup specific mock for status filter
        const { Trip } = require('../models/trips');
        Trip.find.mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([trip1Data]) // Only draft trips
              })
            })
          }),
          lean: jest.fn().mockResolvedValue([trip1Data])
        });
        Trip.countDocuments.mockResolvedValue(1);

        const response = await request(app)
          .get(`${API_BASE}?status=draft`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.trips).toHaveLength(1);
        expect(response.body.trips[0]).toHaveProperty('status', 'draft');
        expect(response.body.trips[0]).toHaveProperty('name', 'Trip 1');
      });

      it('should apply pagination correctly', async () => {
        // Setup specific mock for pagination
        const { Trip } = require('../models/trips');
        Trip.find.mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([trip2Data, trip1Data]) // Skip first, return 2
              })
            })
          }),
          lean: jest.fn().mockResolvedValue([trip2Data, trip1Data])
        });
        Trip.countDocuments.mockResolvedValue(3);

        const response = await request(app)
          .get(`${API_BASE}?limit=2&offset=1`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.trips).toHaveLength(2);
        expect(response.body.pagination).toHaveProperty('currentPage', 1);
        expect(response.body.pagination).toHaveProperty('limit', 2);
        expect(response.body.pagination).toHaveProperty('offset', 1);
      });

      it('should sort trips by creation date descending by default', async () => {
        const response = await request(app)
          .get(API_BASE)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const trips = response.body.trips;
        expect(trips[0].name).toBe('Trip 3'); // Most recently created
        expect(trips[1].name).toBe('Trip 2');
        expect(trips[2].name).toBe('Trip 1');
      });

      it('should sort trips by name ascending when specified', async () => {
        // Setup specific mock for name sorting
        const { Trip } = require('../models/trips');
        Trip.find.mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              skip: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue([trip1Data, trip2Data, trip3Data]) // Sorted by name
              })
            })
          }),
          lean: jest.fn().mockResolvedValue([trip1Data, trip2Data, trip3Data])
        });
        Trip.countDocuments.mockResolvedValue(3);

        const response = await request(app)
          .get(`${API_BASE}?sortBy=name&sortOrder=asc`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const trips = response.body.trips;
        expect(trips[0].name).toBe('Trip 1');
        expect(trips[1].name).toBe('Trip 2');
        expect(trips[2].name).toBe('Trip 3');
      });
    });

    describe('Authentication Errors (401)', () => {
      it('should return 401 when no authorization token is provided', async () => {
        const response = await request(app)
          .get(API_BASE)
          .expect(401);

        expect(response.body.message).toContain('Access token is required');
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 for invalid status filter', async () => {
        const response = await request(app)
          .get(`${API_BASE}?status=invalid`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        expect(response.body.message).toContain('Status must be one of');
      });

      it('should return 400 for invalid limit', async () => {
        const response = await request(app)
          .get(`${API_BASE}?limit=100`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        expect(response.body.message).toContain('Limit must be between 1 and 50');
      });

      it('should return 400 for invalid sortBy field', async () => {
        const response = await request(app)
          .get(`${API_BASE}?sortBy=invalid`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        expect(response.body.message).toContain('sortBy must be one of');
      });
    });
  });

  describe('GET /api/v1/trips/:id - Get Trip Details', () => {
    let testTrip;

    beforeEach(async () => {
      testTrip = new Trip({
        ...validTripData,
        userId: testUser._id
      });
      await testTrip.save();
    });

    describe('Successful Trip Detail Retrieval', () => {
      it('should return trip details for valid trip ID', async () => {
        const response = await request(app)
          .get(`${API_BASE}/${testTrip._id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('trip');
        expect(response.body.trip).toHaveProperty('_id', testTrip._id.toString());
        expect(response.body.trip).toHaveProperty('name', validTripData.name);
        expect(response.body.trip).toHaveProperty('userId', userId);
      });
    });

    describe('Authentication Errors (401)', () => {
      it('should return 401 when no authorization token is provided', async () => {
        const response = await request(app)
          .get(`${API_BASE}/${testTrip._id}`)
          .expect(401);

        expect(response.body.message).toContain('Access token is required');
      });
    });

    describe('Authorization Errors (403)', () => {
      it('should return 403 when user tries to access another user\'s trip', async () => {
        // Create mock for other user's trip
        const otherUserId = '507f1f77bcf86cd799439099';
        const otherUserTripId = '507f1f77bcf86cd799439098';
        
        // Update Trip.findById mock to return a trip owned by another user
        const { Trip } = require('../models/trips');
        Trip.findById.mockImplementation((id) => {
          if (id === otherUserTripId) {
            const tripWithMethods = {
              _id: otherUserTripId,
              ...validTripData,
              userId: otherUserId,
              isOwnedBy: jest.fn().mockImplementation((userId) => {
                return userId === otherUserId; // Only owned by other user
              })
            };
            return Promise.resolve(tripWithMethods);
          }
          // Default behavior for other IDs
          return Promise.resolve(null);
        });

        const response = await request(app)
          .get(`${API_BASE}/${otherUserTripId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);

        expect(response.body.message).toContain('Access denied to this trip');
      });
    });

    describe('Not Found Errors (404)', () => {
      it('should return 404 for non-existent trip ID', async () => {
        const mongoose = require('mongoose');
        const nonExistentId = new mongoose.Types.ObjectId();

        const response = await request(app)
          .get(`${API_BASE}/${nonExistentId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body.message).toContain('Trip not found');
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 for invalid trip ID format', async () => {
        const response = await request(app)
          .get(`${API_BASE}/invalid-id`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(400);

        expect(response.body.message).toContain('Trip ID must be a valid MongoDB ObjectId');
      });
    });
  });
});