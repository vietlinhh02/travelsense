const request = require('supertest');
const createTestApp = require('./setup/testApp');
const { clearMockDB } = require('./setup/mockDb');
const { EmbeddingDocument, SearchQueryLog, SearchPreferences } = require('../models/search');
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

// Mock search models
jest.mock('../models/search', () => ({
  EmbeddingDocument: {
    create: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
    aggregate: jest.fn()
  },
  SearchQueryLog: Object.assign(
    function(data) {
      return {
        _id: 'mock-log-id',
        ...data,
        save: jest.fn().mockResolvedValue({
          _id: 'mock-log-id',
          ...data
        })
      };
    },
    {
      create: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 }),
      aggregate: jest.fn().mockResolvedValue([]),
      logSearch: jest.fn().mockResolvedValue({
        _id: 'mock-log-id',
        queryId: 'mock-query-id',
        sessionId: 'mock-session-id'
      }),
      createLog: jest.fn().mockImplementation((data) => ({
        _id: 'mock-log-id',
        ...data,
        save: jest.fn().mockResolvedValue({
          _id: 'mock-log-id',
          ...data
        })
      })),
      getSearchAnalytics: jest.fn().mockResolvedValue({
        totalSearches: 25,
        averageProcessingTime: 150,
        successRate: 85,
        topQueries: ['sushi restaurant', 'tokyo attractions'],
        searchTypeBreakdown: { vector: 15, text: 10 },
        timeDistribution: []
      }),
      getPopularSearchTerms: jest.fn().mockResolvedValue([
        { term: 'sushi restaurant', count: 12, avgScore: 0.85 },
        { term: 'tokyo attractions', count: 8, avgScore: 0.82 }
      ]),
      recordInteraction: jest.fn().mockResolvedValue(true)
    }
  ),
  SearchPreferences: {
    findOne: jest.fn(),
    create: jest.fn(),
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 0 })
  }
}));

// Mock contentIndexingService
jest.mock('../services/search', () => ({
  vectorSearchService: {
    vectorSearch: jest.fn().mockImplementation((searchParams) => {
      return Promise.resolve({
        results: [{
          documentId: 'test-restaurant-tokyo-001',
          score: 0.95,
          content: { title: 'Amazing Sushi Restaurant' }
        }],
        metadata: {
          queryId: 'mock-query-id',
          sessionId: 'mock-session-id',
          totalFound: 1,
          totalReturned: 1,
          processingTime: 150,
          searchMethod: 'vector',
          similarityThreshold: searchParams.similarityThreshold || 0.7,
          hasMoreResults: false
        }
      });
    }),
    hybridSearch: jest.fn().mockResolvedValue({
      results: [{
        documentId: 'test-restaurant-tokyo-001',
        score: 0.93,
        content: { title: 'Amazing Sushi Restaurant' }
      }],
      metadata: {
        queryId: 'mock-query-id',
        sessionId: 'mock-session-id',
        totalFound: 1,
        totalReturned: 1,
        processingTime: 200,
        searchMethod: 'hybrid',
        vectorWeight: 0.7,
        textWeight: 0.3,
        hasMoreResults: false
      }
    }),
    textSearch: jest.fn().mockResolvedValue({
      results: [{
        documentId: 'test-restaurant-tokyo-001',
        score: 0.88,
        content: { title: 'Amazing Sushi Restaurant' }
      }],
      metadata: {
        queryId: 'mock-query-id',
        sessionId: 'mock-session-id',
        totalFound: 1,
        totalReturned: 1,
        processingTime: 100,
        searchMethod: 'text',
        hasMoreResults: false
      }
    }),
    locationSearch: jest.fn().mockResolvedValue({
      results: [{
        documentId: 'test-restaurant-tokyo-001',
        score: 0.90,
        distance: 500,
        content: { title: 'Amazing Sushi Restaurant' }
      }],
      metadata: {
        queryId: 'mock-query-id',
        sessionId: 'mock-session-id',
        totalFound: 1,
        totalReturned: 1,
        processingTime: 180,
        searchMethod: 'location',
        searchCenter: {
          longitude: 139.7671,
          latitude: 35.6719,
          radius: 25000
        },
        hasMoreResults: false
      }
    }),
    getPersonalizedRecommendations: jest.fn().mockResolvedValue({
      results: [{
        documentId: 'test-restaurant-tokyo-001',
        score: 0.92,
        content: { title: 'Amazing Sushi Restaurant' }
      }],
      metadata: {
        personalized: true,
        diversityFactor: 0.3,
        totalFound: 1,
        totalReturned: 1,
        processingTime: 120
      }
    }),
    findSimilarDocuments: jest.fn().mockImplementation((documentId, options) => {
      // Handle invalid document ID
      if (documentId === 'invalid-document-id') {
        throw new Error('VALIDATION_ERROR: Document ID must be between 1 and 100 characters');
      }
      // Handle non-existent document
      if (documentId === 'non-existent-document-123') {
        throw new Error('DOCUMENT_NOT_FOUND');
      }
      // Return successful response for valid documents
      return Promise.resolve({
        results: [{
          documentId: 'test-restaurant-tokyo-002',
          score: 0.85,
          content: { title: 'Similar Sushi Restaurant' }
        }],
        referenceDocument: {
          documentId: 'test-restaurant-tokyo-001',
          content: { title: 'Amazing Sushi Restaurant' }
        },
        metadata: {
          similarityThreshold: options?.similarityThreshold || 0.6,
          sameType: options?.sameType || true,
          sameLocation: options?.sameLocation || false,
          totalFound: 1,
          totalReturned: 1,
          processingTime: 110
        }
      });
    })
  },
  contentIndexingService: {
    getIndexingStats: jest.fn().mockResolvedValue({
      overview: {
        totalDocuments: 1250,
        avgQualityScore: 85
      },
      byType: {
        restaurant: 450,
        attraction: 350,
        hotel: 300,
        activity: 150
      }
    })
  }
}));

// Mock User model
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

const API_BASE = '/api/v1/search';

describe('Vector Search Test Suite - Search and Content Management', () => {
  let testUser;
  let authToken;
  let userId;
  let testDocument;

  // Test data
  const validUserData = {
    email: 'search.test@example.com',
    password: 'TestPassword123!',
    firstName: 'Search',
    lastName: 'Tester'
  };

  const validDocumentData = {
    documentId: 'test-restaurant-tokyo-001',
    documentType: 'restaurant',
    content: {
      title: 'Amazing Sushi Restaurant',
      description: 'A premium sushi restaurant offering the finest seasonal ingredients with traditional techniques and modern presentation.',
      tags: ['sushi', 'premium', 'traditional', 'seasonal'],
      category: 'fine-dining',
      subcategory: 'japanese'
    },
    location: {
      name: 'Ginza District',
      country: 'Japan',
      city: 'Tokyo',
      longitude: 139.7671,
      latitude: 35.6719,
      region: 'Kanto'
    },
    attributes: {
      price: 'luxury',
      duration: 120,
      rating: 4.8,
      reviewCount: 247,
      openingHours: 'Tue-Sat 18:00-23:00',
      seasons: ['year-round'],
      accessibility: {
        wheelchairAccessible: false,
        familyFriendly: false,
        petFriendly: false
      }
    },
    source: {
      name: 'TravelGuide API',
      url: 'https://example.com/restaurants/amazing-sushi',
      lastUpdated: new Date(),
      verified: true
    }
  };

  beforeAll(async () => {
    // Test setup is handled by Jest setup files
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

    // Create test document for search tests
    const mockDocumentData = {
      _id: 'test-doc-id',
      ...validDocumentData,
      embedding: new Array(768).fill(0).map(() => Math.random() * 2 - 1)
    };
    
    testDocument = mockDocumentData;
    
    // Setup mock responses
    User.findById.mockResolvedValue(testUser);
    EmbeddingDocument.create.mockResolvedValue(mockDocumentData);
    EmbeddingDocument.findById.mockResolvedValue(mockDocumentData);
    EmbeddingDocument.find.mockResolvedValue([mockDocumentData]);
    
    // Mock vector search aggregation pipeline
    EmbeddingDocument.aggregate.mockResolvedValue([
      {
        ...mockDocumentData,
        score: 0.95
      }
    ]);
    
    // Mock SearchQueryLog for interaction tests
    SearchQueryLog.findOne.mockImplementation((query) => {
      if (query.queryId === 'test-query-123') {
        return Promise.resolve({
          _id: 'mock-log-id',
          queryId: 'test-query-123',
          userId: mockUserId,
          sessionId: 'test-session-456',
          recordInteraction: jest.fn().mockResolvedValue(true)
        });
      }
      return Promise.resolve(null);
    });
  });

  afterAll(async () => {
    // Final cleanup handled by Jest setup files
  });

  describe('POST /api/v1/search/vector - Vector Search', () => {
    describe('Successful Vector Search', () => {
      it('should successfully perform vector search with text query', async () => {
        const searchData = {
          query: 'premium sushi restaurant with traditional techniques',
          limit: 10,
          offset: 0,
          similarityThreshold: 0.5
        };

        const response = await request(app)
          .post(`${API_BASE}/vector`)
          .send(searchData)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Vector search completed successfully');
        expect(response.body).toHaveProperty('results');
        expect(response.body).toHaveProperty('metadata');
        
        expect(Array.isArray(response.body.results)).toBe(true);
        expect(response.body.metadata).toHaveProperty('totalFound');
        expect(response.body.metadata).toHaveProperty('totalReturned');
        expect(response.body.metadata).toHaveProperty('processingTime');
        expect(response.body.metadata).toHaveProperty('searchMethod', 'vector');
      });

      it('should successfully perform vector search with query vector', async () => {
        const mockVector = new Array(768).fill(0).map(() => Math.random() * 2 - 1);
        
        const searchData = {
          queryVector: mockVector,
          limit: 5,
          similarityThreshold: 0.7
        };

        const response = await request(app)
          .post(`${API_BASE}/vector`)
          .send(searchData)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Vector search completed successfully');
        expect(response.body.metadata).toHaveProperty('searchMethod', 'vector');
        expect(response.body.metadata).toHaveProperty('similarityThreshold', 0.7);
      });

      it('should successfully perform vector search with filters', async () => {
        const searchData = {
          query: 'restaurant',
          filters: {
            documentTypes: ['restaurant'],
            location: {
              country: 'Japan',
              city: 'Tokyo'
            },
            attributes: {
              priceRange: ['luxury'],
              minRating: 4.0,
              accessibility: {
                familyFriendly: false
              }
            },
            verified: true
          },
          limit: 20
        };

        const response = await request(app)
          .post(`${API_BASE}/vector`)
          .send(searchData)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Vector search completed successfully');
        expect(response.body.results).toBeDefined();
        expect(response.body.metadata).toHaveProperty('searchMethod', 'vector');
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when neither query nor queryVector is provided', async () => {
        const searchData = {
          limit: 10
        };

        const response = await request(app)
          .post(`${API_BASE}/vector`)
          .send(searchData)
          .expect(400);

        expect(response.body.message).toContain('Either query text or queryVector is required');
      });

      it('should return 400 when query exceeds maximum length', async () => {
        const searchData = {
          query: 'x'.repeat(501), // Exceeds 500 character limit
          limit: 10
        };

        const response = await request(app)
          .post(`${API_BASE}/vector`)
          .send(searchData)
          .expect(400);

        expect(response.body.message).toContain('Query must be a string between 1 and 500 characters');
      });

      it('should return 400 when queryVector has wrong dimensions', async () => {
        const searchData = {
          queryVector: new Array(100).fill(0.5), // Wrong dimensions
          limit: 10
        };

        const response = await request(app)
          .post(`${API_BASE}/vector`)
          .send(searchData)
          .expect(400);

        expect(response.body.message).toContain('Query vector must have exactly 768 dimensions');
      });

      it('should return 400 when limit exceeds maximum', async () => {
        const searchData = {
          query: 'test',
          limit: 150 // Exceeds 100 limit
        };

        const response = await request(app)
          .post(`${API_BASE}/vector`)
          .send(searchData)
          .expect(400);

        expect(response.body.message).toContain('Limit must be between 1 and 100');
      });

      it('should return 400 when similarityThreshold is out of range', async () => {
        const searchData = {
          query: 'test',
          similarityThreshold: 1.5 // Exceeds 1.0
        };

        const response = await request(app)
          .post(`${API_BASE}/vector`)
          .send(searchData)
          .expect(400);

        expect(response.body.message).toContain('Similarity threshold must be between 0 and 1');
      });
    });
  });

  describe('POST /api/v1/search/hybrid - Hybrid Search', () => {
    describe('Successful Hybrid Search', () => {
      it('should successfully perform hybrid search', async () => {
        const searchData = {
          query: 'traditional sushi experience',
          vectorWeight: 0.7,
          textWeight: 0.3,
          limit: 15
        };

        const response = await request(app)
          .post(`${API_BASE}/hybrid`)
          .send(searchData)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Hybrid search completed successfully');
        expect(response.body).toHaveProperty('results');
        expect(response.body.metadata).toHaveProperty('searchMethod', 'hybrid');
        expect(response.body.metadata).toHaveProperty('vectorWeight', 0.7);
        expect(response.body.metadata).toHaveProperty('textWeight', 0.3);
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when query is missing', async () => {
        const searchData = {
          vectorWeight: 0.7,
          textWeight: 0.3
        };

        const response = await request(app)
          .post(`${API_BASE}/hybrid`)
          .send(searchData)
          .expect(400);

        expect(response.body.message).toContain('Query is required for hybrid search');
      });
    });
  });

  describe('POST /api/v1/search/text - Text Search', () => {
    describe('Successful Text Search', () => {
      it('should successfully perform text search', async () => {
        const searchData = {
          query: 'sushi restaurant premium',
          filters: {
            documentTypes: ['restaurant']
          },
          limit: 10
        };

        const response = await request(app)
          .post(`${API_BASE}/text`)
          .send(searchData)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Text search completed successfully');
        expect(response.body).toHaveProperty('results');
        expect(response.body.metadata).toHaveProperty('searchMethod', 'text');
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when query is missing', async () => {
        const searchData = {
          limit: 10
        };

        const response = await request(app)
          .post(`${API_BASE}/text`)
          .send(searchData)
          .expect(400);

        expect(response.body.message).toContain('Query is required for text search');
      });
    });
  });

  describe('POST /api/v1/search/location - Location Search', () => {
    describe('Successful Location Search', () => {
      it('should successfully perform location search', async () => {
        const searchData = {
          longitude: 139.7671,
          latitude: 35.6719,
          radius: 10000,
          query: 'restaurant',
          limit: 20
        };

        const response = await request(app)
          .post(`${API_BASE}/location`)
          .send(searchData)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Location search completed successfully');
        expect(response.body).toHaveProperty('results');
        expect(response.body.metadata).toHaveProperty('searchMethod', 'location');
        expect(response.body.metadata).toHaveProperty('searchCenter');
        expect(response.body.metadata.searchCenter).toHaveProperty('longitude', 139.7671);
        expect(response.body.metadata.searchCenter).toHaveProperty('latitude', 35.6719);
      });

      it('should include distance in results', async () => {
        const searchData = {
          longitude: 139.7671,
          latitude: 35.6719,
          radius: 50000
        };

        const response = await request(app)
          .post(`${API_BASE}/location`)
          .send(searchData)
          .expect(200);

        if (response.body.results.length > 0) {
          expect(response.body.results[0]).toHaveProperty('distance');
          expect(typeof response.body.results[0].distance).toBe('number');
        }
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when longitude is missing', async () => {
        const searchData = {
          latitude: 35.6719,
          radius: 10000
        };

        const response = await request(app)
          .post(`${API_BASE}/location`)
          .send(searchData)
          .expect(400);

        expect(response.body.message).toContain('Longitude is required');
      });

      it('should return 400 when latitude is out of range', async () => {
        const searchData = {
          longitude: 139.7671,
          latitude: 95.0, // Exceeds valid range
          radius: 10000
        };

        const response = await request(app)
          .post(`${API_BASE}/location`)
          .send(searchData)
          .expect(400);

        expect(response.body.message).toContain('Latitude must be between -90 and 90');
      });
    });
  });

  describe('GET /api/v1/search/recommendations - Personalized Recommendations', () => {
    describe('Successful Recommendations', () => {
      it('should successfully get recommendations for authenticated user', async () => {
        const response = await request(app)
          .get(`${API_BASE}/recommendations`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            limit: 15,
            diversityFactor: 0.5
          })
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Recommendations retrieved successfully');
        expect(response.body).toHaveProperty('results');
        expect(response.body.metadata).toHaveProperty('personalized');
        expect(response.body.metadata).toHaveProperty('diversityFactor');
      });

      it('should handle location-based recommendations', async () => {
        const response = await request(app)
          .get(`${API_BASE}/recommendations`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            limit: 10,
            location: '139.7671,35.6719,25000',
            documentTypes: 'restaurant,activity'
          })
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Recommendations retrieved successfully');
        expect(response.body.results).toBeDefined();
      });
    });

    describe('Authentication Errors (401)', () => {
      it('should return 401 when no authorization token is provided', async () => {
        const response = await request(app)
          .get(`${API_BASE}/recommendations`)
          .expect(401);

        expect(response.body.message).toContain('Access token is required');
      });
    });
  });

  describe('GET /api/v1/search/similar/:documentId - Find Similar Documents', () => {
    describe('Successful Similar Search', () => {
      it('should successfully find similar documents', async () => {
        const response = await request(app)
          .get(`${API_BASE}/similar/${testDocument.documentId}`)
          .query({
            limit: 5,
            similarityThreshold: 0.6,
            sameType: true
          })
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Similar documents found successfully');
        expect(response.body).toHaveProperty('referenceDocument');
        expect(response.body).toHaveProperty('results');
        expect(response.body.referenceDocument).toHaveProperty('documentId', testDocument.documentId);
        expect(response.body.metadata).toHaveProperty('similarityThreshold', 0.6);
        expect(response.body.metadata).toHaveProperty('sameType', true);
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 for invalid document ID', async () => {
        const response = await request(app)
          .get(`${API_BASE}/similar/invalid-document-id`)
          .expect(400);

        expect(response.body.message).toContain('Document ID must be between 1 and 100 characters');
      });
    });

    describe('Not Found Errors (404)', () => {
      it('should return 404 for non-existent document', async () => {
        const response = await request(app)
          .get(`${API_BASE}/similar/non-existent-document-123`)
          .expect(404);

        expect(response.body.message).toContain('Reference document not found');
      });
    });
  });

  describe('POST /api/v1/search/interaction - Record Search Interaction', () => {
    let testQueryLog;

    beforeEach(async () => {
      // Create a test query log
      testQueryLog = new SearchQueryLog({
        queryId: 'test-query-123',
        userId: testUser._id,
        sessionId: 'test-session-456',
        query: {
          searchText: 'test search',
          searchType: 'vector'
        },
        results: {
          totalFound: 5,
          totalReturned: 5,
          processingTime: 150,
          searchMethod: 'atlas_vector',
          hasMoreResults: false
        }
      });
      await testQueryLog.save();
    });

    describe('Successful Interaction Recording', () => {
      it('should successfully record search interaction', async () => {
        const interactionData = {
          queryId: 'test-query-123',
          documentId: testDocument.documentId,
          interactionType: 'click',
          position: 0,
          additionalData: {
            timeSpent: 30,
            satisfactionScore: 4,
            actionType: 'view_details'
          }
        };

        const response = await request(app)
          .post(`${API_BASE}/interaction`)
          .send(interactionData)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Interaction recorded successfully');
        expect(response.body).toHaveProperty('recorded', true);
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 when queryId is missing', async () => {
        const interactionData = {
          documentId: testDocument.documentId,
          interactionType: 'click',
          position: 0
        };

        const response = await request(app)
          .post(`${API_BASE}/interaction`)
          .send(interactionData)
          .expect(400);

        expect(response.body.message).toContain('Query ID is required');
      });

      it('should return 400 when interactionType is invalid', async () => {
        const interactionData = {
          queryId: 'test-query-123',
          documentId: testDocument.documentId,
          interactionType: 'invalid-type',
          position: 0
        };

        const response = await request(app)
          .post(`${API_BASE}/interaction`)
          .send(interactionData)
          .expect(400);

        expect(response.body.message).toContain('Interaction type must be one of');
      });
    });

    describe('Not Found Errors (404)', () => {
      it('should return 404 when query log is not found', async () => {
        const interactionData = {
          queryId: 'non-existent-query',
          documentId: testDocument.documentId,
          interactionType: 'click',
          position: 0
        };

        const response = await request(app)
          .post(`${API_BASE}/interaction`)
          .send(interactionData)
          .expect(404);

        expect(response.body.message).toContain('Search query not found');
      });
    });
  });

  describe('GET /api/v1/search/analytics - Get Search Analytics', () => {
    beforeEach(async () => {
      // Create some test search logs
      const logs = [
        {
          queryId: 'analytics-query-1',
          userId: testUser._id,
          sessionId: 'analytics-session-1',
          query: {
            searchText: 'test search 1',
            searchType: 'vector'
          },
          results: {
            totalFound: 10,
            totalReturned: 5,
            processingTime: 200,
            searchMethod: 'atlas_vector',
            hasMoreResults: true
          },
          interactions: {
            searchAbandoned: false,
            searchRefined: false
          }
        },
        {
          queryId: 'analytics-query-2',
          userId: testUser._id,
          sessionId: 'analytics-session-2',
          query: {
            searchText: 'test search 2',
            searchType: 'text'
          },
          results: {
            totalFound: 0,
            totalReturned: 0,
            processingTime: 100,
            searchMethod: 'mongodb_text',
            hasMoreResults: false
          },
          interactions: {
            searchAbandoned: true,
            searchRefined: false
          }
        }
      ];

      for (const logData of logs) {
        const log = SearchQueryLog.createLog(logData);
        await log.save();
      }
    });

    describe('Successful Analytics Retrieval', () => {
      it('should successfully retrieve search analytics for authenticated user', async () => {
        const response = await request(app)
          .get(`${API_BASE}/analytics`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            timeframe: 7
          })
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Search analytics retrieved successfully');
        expect(response.body).toHaveProperty('analytics');
        expect(typeof response.body.analytics).toBe('object');
      });

      it('should handle search type filtering', async () => {
        const response = await request(app)
          .get(`${API_BASE}/analytics`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            timeframe: 30,
            searchType: 'vector'
          })
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Search analytics retrieved successfully');
        expect(response.body.analytics).toBeDefined();
      });
    });

    describe('Authentication Errors (401)', () => {
      it('should return 401 when no authorization token is provided', async () => {
        const response = await request(app)
          .get(`${API_BASE}/analytics`)
          .expect(401);

        expect(response.body.message).toContain('Access token is required');
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 for invalid timeframe', async () => {
        const response = await request(app)
          .get(`${API_BASE}/analytics`)
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            timeframe: 400 // Exceeds 365 limit
          })
          .expect(400);

        expect(response.body.message).toContain('Timeframe must be between 1 and 365 days');
      });
    });
  });

  describe('GET /api/v1/search/popular-terms - Get Popular Search Terms', () => {
    beforeEach(async () => {
      // Create some popular search terms
      const popularSearches = [
        'sushi restaurant',
        'tokyo attractions',
        'luxury hotels',
        'sushi restaurant', // Duplicate to make it more popular
        'tokyo attractions'
      ];

      for (const searchText of popularSearches) {
        const log = SearchQueryLog.createLog({
          queryId: `popular-${Date.now()}-${Math.random()}`,
          sessionId: 'popular-session',
          query: {
            searchText,
            searchType: 'vector'
          },
          results: {
            totalFound: 5,
            totalReturned: 5,
            processingTime: 150,
            searchMethod: 'atlas_vector',
            hasMoreResults: false
          }
        });
        await log.save();
      }
    });

    describe('Successful Popular Terms Retrieval', () => {
      it('should successfully retrieve popular search terms', async () => {
        const response = await request(app)
          .get(`${API_BASE}/popular-terms`)
          .query({
            limit: 10,
            timeframe: 7
          })
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Popular search terms retrieved successfully');
        expect(response.body).toHaveProperty('popularTerms');
        expect(Array.isArray(response.body.popularTerms)).toBe(true);
      });
    });

    describe('Validation Errors (400)', () => {
      it('should return 400 for invalid limit', async () => {
        const response = await request(app)
          .get(`${API_BASE}/popular-terms`)
          .query({
            limit: 150 // Exceeds 100 limit
          })
          .expect(400);

        expect(response.body.message).toContain('Limit must be between 1 and 100');
      });
    });
  });

  describe('GET /api/v1/search/health - Search Service Health Check', () => {
    describe('Successful Health Check', () => {
      it('should successfully retrieve search service health status', async () => {
        const response = await request(app)
          .get(`${API_BASE}/health`)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Search service is healthy');
        expect(response.body).toHaveProperty('status', 'healthy');
        expect(response.body).toHaveProperty('timestamp');
        expect(response.body).toHaveProperty('indexing');
        expect(response.body).toHaveProperty('searchPerformance');
        expect(response.body).toHaveProperty('capabilities');

        // Verify capabilities
        expect(response.body.capabilities).toHaveProperty('vectorSearch', true);
        expect(response.body.capabilities).toHaveProperty('textSearch', true);
        expect(response.body.capabilities).toHaveProperty('hybridSearch', true);
        expect(response.body.capabilities).toHaveProperty('locationSearch', true);
        expect(response.body.capabilities).toHaveProperty('personalizedRecommendations', true);
        expect(response.body.capabilities).toHaveProperty('similaritySearch', true);
      });
    });
  });
});