const request = require('supertest');
const createTestApp = require('./setup/testApp');
const { clearTestDB } = require('./setup/testDb');
const mongoose = require('mongoose');
const { User } = require('../models/users');
const { Trip } = require('../models/trips');
const { EmbeddingDocument } = require('../models/search');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

// Create test app instance
const app = createTestApp();

// Test utilities
let server;
let validToken;
let testUser;
let testTrip;

// Mock data for integration tests
const mockUser = {
  email: 'integration.test@example.com',
  password: 'TestPassword123!',
  firstName: 'Integration',
  lastName: 'Tester',
  isEmailVerified: true
};

const mockTripData = {
  title: 'Integration Test Trip to Tokyo',
  description: 'A comprehensive test trip for Phase 2 integration',
  destination: {
    country: 'Japan',
    city: 'Tokyo',
    region: 'Kanto',
    coordinates: {
      latitude: 35.6762,
      longitude: 139.6503
    }
  },
  dates: {
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-06-05')
  },
  budget: {
    amount: 2000,
    currency: 'USD'
  },
  travelers: [
    {
      name: 'John Doe',
      email: 'john@example.com',
      role: 'traveler',
      preferences: {
        interests: ['culture', 'food', 'history'],
        budgetRange: 'mid-range',
        activityLevel: 'moderate'
      }
    }
  ],
  preferences: {
    interests: ['sightseeing', 'cuisine', 'culture'],
    budgetRange: 'mid-range',
    transportationPreference: 'public',
    accommodationType: 'hotel',
    activityLevel: 'moderate'
  }
};

const mockSearchDocuments = [
  {
    documentId: 'tokyo-sensoji-temple',
    documentType: 'activity',
    content: {
      title: 'Sensoji Temple',
      description: 'Ancient Buddhist temple in Asakusa district, Tokyo\'s oldest temple with traditional market.',
      tags: ['temple', 'buddhist', 'traditional', 'historic', 'cultural'],
      category: 'sightseeing'
    },
    location: {
      name: 'Asakusa, Tokyo',
      country: 'Japan',
      city: 'Tokyo',
      longitude: 139.7967,
      latitude: 35.7148
    },
    attributes: {
      rating: 4.5,
      duration: 120,
      price: 'free'
    },
    source: {
      name: 'Integration Test Data',
      verified: true
    }
  },
  {
    documentId: 'tokyo-tsukiji-market',
    documentType: 'activity',
    content: {
      title: 'Tsukiji Outer Market',
      description: 'Famous fish market with fresh sushi and traditional Japanese street food.',
      tags: ['market', 'food', 'sushi', 'traditional', 'local'],
      category: 'food'
    },
    location: {
      name: 'Tsukiji, Tokyo',
      country: 'Japan',
      city: 'Tokyo',
      longitude: 139.7677,
      latitude: 35.6655
    },
    attributes: {
      rating: 4.7,
      duration: 180,
      price: 'budget'
    },
    source: {
      name: 'Integration Test Data',
      verified: true
    }
  }
];

describe('Phase 2 Integration Tests', () => {
  beforeAll(async () => {
    // Test setup is handled by Jest setup files
  });
  
  beforeEach(async () => {
    // Clear database between tests
    await clearTestDB();
    
    // Create test user
    testUser = await User.create(mockUser);
    
    // Generate valid JWT token
    validToken = jwt.sign(
      { userId: testUser._id, email: testUser.email },
      config.jwt.secret,
      { expiresIn: config.jwt.accessExpirationMinutes + 'm' }
    );
  });

  afterAll(async () => {
    // Final cleanup handled by Jest setup files
  });

  describe('Complete Trip Planning Workflow', () => {
    test('1. Create a new trip', async () => {
      const response = await request(app)
        .post('/api/v1/trips')
        .set('Authorization', `Bearer ${validToken}`)
        .send(mockTripData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Trip created successfully');
      expect(response.body.trip).toMatchObject({
        title: mockTripData.title,
        description: mockTripData.description,
        destination: expect.objectContaining({
          country: mockTripData.destination.country,
          city: mockTripData.destination.city
        })
      });

      testTrip = response.body.trip;
    });

    test('2. Index content for vector search', async () => {
      // Index multiple documents for search functionality
      for (const doc of mockSearchDocuments) {
        const response = await request(app)
          .post('/api/v1/search/content')
          .set('Authorization', `Bearer ${validToken}`)
          .send(doc)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Document indexed successfully');
        expect(response.body.embeddingGenerated).toBe(true);
      }
    });

    test('3. Search for activities using vector search', async () => {
      const searchQuery = {
        query: 'traditional Japanese temple cultural experience',
        filters: {
          documentTypes: ['activity'],
          location: {
            country: 'Japan',
            city: 'Tokyo'
          }
        },
        limit: 5
      };

      const response = await request(app)
        .post('/api/v1/search/vector')
        .send(searchQuery)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Vector search completed successfully');
      expect(response.body.results).toBeInstanceOf(Array);
      expect(response.body.results.length).toBeGreaterThan(0);
      expect(response.body.metadata).toMatchObject({
        totalResults: expect.any(Number),
        processingTime: expect.any(Number)
      });
    });

    test('4. Generate AI-powered itinerary for the trip', async () => {
      const response = await request(app)
        .post(`/api/v1/ai/trips/${testTrip._id}/generate-itinerary`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          focus: 'cultural experiences and traditional cuisine'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Itinerary generated successfully');
      expect(response.body.itinerary).toMatchObject({
        tripId: testTrip._id,
        focus: 'cultural experiences and traditional cuisine',
        days: expect.any(Array)
      });
      expect(response.body.tokensUsed).toBeGreaterThan(0);
      expect(response.body.processingTime).toBeGreaterThan(0);
    });

    test('5. Get personalized activity recommendations', async () => {
      const response = await request(app)
        .post('/api/v1/search/recommendations')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          tripId: testTrip._id,
          preferences: {
            interests: ['culture', 'food', 'history'],
            budgetRange: 'mid-range'
          },
          limit: 3
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Personalized recommendations generated successfully');
      expect(response.body.recommendations).toBeInstanceOf(Array);
      expect(response.body.metadata).toMatchObject({
        totalResults: expect.any(Number),
        personalizationScore: expect.any(Number)
      });
    });

    test('6. Chat with AI about the trip', async () => {
      const response = await request(app)
        .post('/api/v1/ai/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          message: 'What are the best times to visit the attractions in my Tokyo itinerary?',
          context: {
            tripId: testTrip._id
          },
          model: 'flash'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('AI chat completed successfully');
      expect(response.body.content).toBeDefined();
      expect(response.body.model).toBe('flash');
      expect(response.body.tokensUsed).toBeGreaterThan(0);
    });

    test('7. Get activity suggestions using AI', async () => {
      const response = await request(app)
        .post('/api/v1/ai/suggest-activities')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          tripId: testTrip._id,
          date: '2024-06-02',
          timePeriod: 'morning',
          interests: ['culture', 'temples', 'traditional'],
          constraints: ['family-friendly', 'budget under $30']
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Activity suggestions generated successfully');
      expect(response.body.suggestions).toBeInstanceOf(Array);
      expect(response.body.tokensUsed).toBeGreaterThan(0);
    });

    test('8. Optimize trip schedule using AI', async () => {
      const response = await request(app)
        .post(`/api/v1/ai/trips/${testTrip._id}/optimize-schedule`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          focus: 'minimize travel time and maximize cultural experiences'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Schedule optimized successfully');
      expect(response.body.optimizedSchedule).toBeDefined();
      expect(response.body.tokensUsed).toBeGreaterThan(0);
    });

    test('9. Validate trip constraints using AI', async () => {
      const response = await request(app)
        .post(`/api/v1/ai/trips/${testTrip._id}/validate-constraints`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          checkType: 'all'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Constraints validated successfully');
      expect(response.body.validationResults).toMatchObject({
        valid: expect.any(Boolean),
        violations: expect.any(Array),
        warnings: expect.any(Array),
        suggestions: expect.any(Array)
      });
    });

    test('10. Perform location-based search', async () => {
      const response = await request(app)
        .post('/api/v1/search/location')
        .send({
          longitude: 139.6917,
          latitude: 35.6895,
          radius: 5000,
          query: 'restaurants',
          filters: {
            documentTypes: ['restaurant']
          },
          limit: 3
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Location search completed successfully');
      expect(response.body.results).toBeInstanceOf(Array);
      expect(response.body.metadata).toMatchObject({
        searchCenter: {
          longitude: 139.6917,
          latitude: 35.6895
        },
        radius: 5000
      });
    });

    test('11. Record user interaction with search results', async () => {
      const response = await request(app)
        .post('/api/v1/search/interactions')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          queryId: 'test-query-123',
          documentId: 'tokyo-sensoji-temple',
          interactionType: 'view',
          position: 1,
          additionalData: {
            satisfactionScore: 5
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Interaction recorded successfully');
      expect(response.body.recorded).toBe(true);
    });

    test('12. Get updated trip with all modifications', async () => {
      const response = await request(app)
        .get(`/api/v1/trips/${testTrip._id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Trip retrieved successfully');
      expect(response.body.trip).toMatchObject({
        _id: testTrip._id,
        title: mockTripData.title,
        status: expect.any(String)
      });
      
      // Trip should have itinerary after AI generation
      if (response.body.trip.itinerary) {
        expect(response.body.trip.itinerary).toMatchObject({
          days: expect.any(Array)
        });
      }
    });
  });

  describe('Service Health Checks', () => {
    test('AI service health status', async () => {
      const response = await request(app)
        .get('/api/v1/ai/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('AI service is healthy');
      expect(response.body.status).toBe('healthy');
      expect(response.body.services).toMatchObject({
        geminiFlash: 'available',
        geminiPro: 'available',
        embeddings: 'available'
      });
    });

    test('Search service health status', async () => {
      const response = await request(app)
        .get('/api/v1/search/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Search service health checked');
      expect(response.body.status).toMatch(/healthy|warning/);
      expect(response.body.metrics).toBeDefined();
    });

    test('Content management health status', async () => {
      const response = await request(app)
        .get('/api/v1/search/content/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Content service health checked');
      expect(response.body.status).toMatch(/healthy|warning/);
      expect(response.body.indexing).toMatchObject({
        embeddingDimensions: 768,
        capabilities: expect.any(Array)
      });
    });
  });

  describe('Analytics and Statistics', () => {
    test('Get AI interaction statistics', async () => {
      const response = await request(app)
        .get('/api/v1/ai/stats?timeframe=7')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Interaction statistics retrieved successfully');
      expect(response.body.stats).toMatchObject({
        totalInteractions: expect.any(Number),
        totalTokensUsed: expect.any(Number),
        averageProcessingTime: expect.any(Number),
        successRate: expect.any(Number)
      });
    });

    test('Get search analytics', async () => {
      const response = await request(app)
        .get('/api/v1/search/analytics?timeframe=7')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Search analytics retrieved successfully');
      expect(response.body.analytics).toMatchObject({
        totalSearches: expect.any(Number),
        averageResponseTime: expect.any(Number),
        searchTypes: expect.any(Object)
      });
    });

    test('Get content indexing statistics', async () => {
      const response = await request(app)
        .get('/api/v1/search/content/stats')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Indexing statistics retrieved successfully');
      expect(response.body.overview).toMatchObject({
        totalDocuments: expect.any(Number)
      });
      expect(response.body.byType).toBeInstanceOf(Array);
    });

    test('Get AI rate limit status', async () => {
      const response = await request(app)
        .get('/api/v1/ai/rate-limits')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Rate limit status retrieved successfully');
      expect(response.body.rateLimits).toMatchObject({
        flash: expect.objectContaining({
          limit: expect.any(Number),
          remaining: expect.any(Number)
        }),
        pro: expect.objectContaining({
          limit: expect.any(Number),
          remaining: expect.any(Number)
        })
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('Handle invalid trip ID in AI operations', async () => {
      const invalidTripId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .post(`/api/v1/ai/trips/${invalidTripId}/generate-itinerary`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({ focus: 'test' })
        .expect(403); // Security check returns 403 instead of 404

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('access');
    });

    test('Handle malformed search queries', async () => {
      const response = await request(app)
        .post('/api/v1/search/vector')
        .send({
          // Missing required query or queryVector
          filters: { documentTypes: ['activity'] }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Either query text or queryVector is required');
    });

    test('Handle unauthorized access to protected endpoints', async () => {
      const response = await request(app)
        .post('/api/v1/ai/chat')
        .send({
          message: 'Test message'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Access token required');
    });

    test('Handle invalid coordinates in location search', async () => {
      const response = await request(app)
        .post('/api/v1/search/location')
        .send({
          longitude: 999, // Invalid longitude
          latitude: 35.6895,
          radius: 5000
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Longitude must be between -180 and 180');
    });
  });

  describe('Cross-Service Data Consistency', () => {
    test('Verify trip data consistency across services', async () => {
      // Get trip from Trip service
      const tripResponse = await request(app)
        .get(`/api/v1/trips/${testTrip._id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      // Use trip data in AI chat with context
      const aiResponse = await request(app)
        .post('/api/v1/ai/chat')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          message: 'Tell me about my trip destination',
          context: {
            tripId: testTrip._id
          }
        })
        .expect(200);

      expect(tripResponse.body.trip._id).toBe(testTrip._id);
      expect(aiResponse.body.content).toBeDefined();
      expect(aiResponse.body.tokensUsed).toBeGreaterThan(0);
    });

    test('Verify search results relevance to trip preferences', async () => {
      // Search for activities matching trip preferences
      const searchResponse = await request(app)
        .post('/api/v1/search/vector')
        .send({
          query: 'cultural traditional Japanese temple',
          filters: {
            documentTypes: ['activity'],
            location: {
              country: mockTripData.destination.country,
              city: mockTripData.destination.city
            }
          }
        })
        .expect(200);

      expect(searchResponse.body.results).toBeInstanceOf(Array);
      
      // Verify results match trip destination
      if (searchResponse.body.results.length > 0) {
        const firstResult = searchResponse.body.results[0];
        expect(firstResult.location.country).toBe(mockTripData.destination.country);
      }
    });
  });
});

// Utility function to generate mock embeddings for testing
function generateMockEmbedding() {
  return Array.from({ length: 768 }, () => Math.random() * 2 - 1);
}