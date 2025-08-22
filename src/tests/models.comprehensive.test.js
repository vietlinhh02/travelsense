const mongoose = require('mongoose');
const { clearTestDB } = require('./setup/testDb');

// Import models to test
const User = require('../models/users/user.model');
const { Trip } = require('../models/trips');
const { EmbeddingDocument, SearchQueryLog, SearchPreferences } = require('../models/search');
const { RateLimitTracker, AIInteractionLog } = require('../models/ai');
const {
  AccountRecovery,
  BlacklistToken,
  EmailVerification,
  OTPCode,
  PhoneVerification,
  RefreshToken,
  TwoFactorAuth
} = require('../models/auth');

describe('Model Tests - Static Methods and Virtual Fields', () => {
  beforeEach(async () => {
    await clearTestDB();
    jest.clearAllMocks();
  });

  describe('User Model Tests', () => {
    const validUserData = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      firstName: 'Test',
      lastName: 'User'
    };

    describe('Password Hashing', () => {
      it('should hash password before saving', async () => {
        const user = new User(validUserData);
        await user.save();

        expect(user.password).not.toBe(validUserData.password);
        expect(user.password).toMatch(/^\$2[ab]\$/); // bcrypt hash pattern
      });

      it('should not rehash password if not modified', async () => {
        const user = new User(validUserData);
        await user.save();
        const originalHash = user.password;

        user.firstName = 'Updated';
        await user.save();

        expect(user.password).toBe(originalHash);
      });
    });

    describe('Instance Methods', () => {
      it('should check password correctly', async () => {
        const user = new User(validUserData);
        await user.save();

        const isValid = await user.isPasswordValid('TestPassword123!');
        const isInvalid = await user.isPasswordValid('wrongpassword');

        expect(isValid).toBe(true);
        expect(isInvalid).toBe(false);
      });

      it('should generate full name correctly', async () => {
        const user = new User(validUserData);
        
        expect(user.fullName).toBe('Test User');
      });

      it('should check if user has role correctly', async () => {
        const user = new User({ ...validUserData, role: 'admin' });
        
        expect(user.hasRole('admin')).toBe(true);
        expect(user.hasRole('user')).toBe(false);
      });

      it('should check if profile is complete', async () => {
        const incompleteUser = new User(validUserData);
        const completeUser = new User({
          ...validUserData,
          profile: {
            dateOfBirth: new Date('1990-01-01'),
            nationality: 'US'
          }
        });

        expect(incompleteUser.isProfileComplete()).toBe(false);
        expect(completeUser.isProfileComplete()).toBe(true);
      });
    });

    describe('Validation', () => {
      it('should validate email format', async () => {
        const user = new User({ ...validUserData, email: 'invalid-email' });

        await expect(user.save()).rejects.toThrow();
      });

      it('should validate password requirements', async () => {
        const user = new User({ ...validUserData, password: '123' });

        await expect(user.save()).rejects.toThrow();
      });

      it('should validate interests array length', async () => {
        const tooManyInterests = Array(25).fill('interest');
        const user = new User({
          ...validUserData,
          preferences: { interests: tooManyInterests }
        });

        await expect(user.save()).rejects.toThrow();
      });
    });
  });

  describe('Trip Model Tests', () => {
    const validTripData = {
      userId: new mongoose.Types.ObjectId(),
      name: 'Test Trip',
      destination: {
        origin: 'London',
        destination: 'Paris',
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000)
      },
      travelers: {
        adults: 2,
        children: 1,
        infants: 0
      },
      budget: {
        total: 2000,
        currency: 'EUR'
      }
    };

    describe('Virtual Fields', () => {
      it('should calculate duration correctly', async () => {
        const trip = new Trip(validTripData);
        
        expect(trip.duration).toBe(3); // 3 days
      });

      it('should calculate total travelers correctly', async () => {
        const trip = new Trip(validTripData);
        
        expect(trip.totalTravelers).toBe(3); // 2 adults + 1 child + 0 infants
      });

      it('should calculate cost per person correctly', async () => {
        const trip = new Trip(validTripData);
        
        expect(trip.costPerPerson).toBe(666.67); // 2000 / 3 travelers
      });

      it('should check if trip is upcoming', async () => {
        const upcomingTrip = new Trip(validTripData);
        const pastTrip = new Trip({
          ...validTripData,
          destination: {
            ...validTripData.destination,
            startDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            endDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        });

        expect(upcomingTrip.isUpcoming).toBe(true);
        expect(pastTrip.isUpcoming).toBe(false);
      });
    });

    describe('Instance Methods', () => {
      it('should add activity to day correctly', async () => {
        const trip = new Trip(validTripData);
        const activity = {
          title: 'Visit Louvre',
          type: 'museum',
          startTime: '09:00',
          duration: 120
        };

        trip.addActivityToDay(0, activity);

        expect(trip.itinerary.days[0].activities).toHaveLength(1);
        expect(trip.itinerary.days[0].activities[0].title).toBe('Visit Louvre');
      });

      it('should update activity status correctly', async () => {
        const trip = new Trip(validTripData);
        const activity = {
          _id: new mongoose.Types.ObjectId(),
          title: 'Test Activity',
          status: 'planned'
        };

        trip.addActivityToDay(0, activity);
        trip.updateActivityStatus(0, activity._id, 'completed');

        expect(trip.itinerary.days[0].activities[0].status).toBe('completed');
      });

      it('should calculate trip progress correctly', async () => {
        const trip = new Trip(validTripData);
        trip.addActivityToDay(0, { title: 'Activity 1', status: 'completed' });
        trip.addActivityToDay(0, { title: 'Activity 2', status: 'planned' });
        trip.addActivityToDay(1, { title: 'Activity 3', status: 'completed' });

        const progress = trip.calculateProgress();

        expect(progress.totalActivities).toBe(3);
        expect(progress.completedActivities).toBe(2);
        expect(progress.progressPercentage).toBe(66.67);
      });
    });

    describe('Static Methods', () => {
      it('should find trips by status correctly', async () => {
        const userId = new mongoose.Types.ObjectId();
        await Trip.create({ ...validTripData, userId, status: 'active' });
        await Trip.create({ ...validTripData, userId, status: 'completed' });

        const activeTrips = await Trip.findByStatus(userId, 'active');
        const completedTrips = await Trip.findByStatus(userId, 'completed');

        expect(activeTrips).toHaveLength(1);
        expect(completedTrips).toHaveLength(1);
      });

      it('should find upcoming trips correctly', async () => {
        const userId = new mongoose.Types.ObjectId();
        const upcomingTripData = {
          ...validTripData,
          userId,
          destination: {
            ...validTripData.destination,
            startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
          }
        };

        await Trip.create(upcomingTripData);

        const upcomingTrips = await Trip.findUpcomingTrips(userId);

        expect(upcomingTrips).toHaveLength(1);
      });
    });
  });

  describe('RateLimitTracker Model Tests', () => {
    const validRateLimitData = {
      userId: new mongoose.Types.ObjectId(),
      model: 'flash',
      windowStart: new Date(),
      requestCount: 5
    };

    describe('Static Methods', () => {
      it('should check rate limit correctly', async () => {
        const userId = new mongoose.Types.ObjectId();
        
        // First request should be allowed
        const result1 = await RateLimitTracker.checkRateLimit(userId, 'flash');
        expect(result1.allowed).toBe(true);
        expect(result1.remaining).toBe(14); // 15 - 1

        // After 15 requests, should be blocked
        for (let i = 0; i < 14; i++) {
          await RateLimitTracker.checkRateLimit(userId, 'flash');
        }

        const result2 = await RateLimitTracker.checkRateLimit(userId, 'flash');
        expect(result2.allowed).toBe(false);
        expect(result2.remaining).toBe(0);
      });

      it('should get rate limit status correctly', async () => {
        const userId = new mongoose.Types.ObjectId();
        
        const status = await RateLimitTracker.getRateLimitStatus(userId, 'pro');
        
        expect(status.requestCount).toBe(0);
        expect(status.remaining).toBe(2); // pro model allows 2 requests per minute
      });

      it('should reset user rate limits correctly', async () => {
        const userId = new mongoose.Types.ObjectId();
        
        // Create some rate limit records
        await RateLimitTracker.checkRateLimit(userId, 'flash');
        await RateLimitTracker.checkRateLimit(userId, 'pro');

        const result = await RateLimitTracker.resetUserRateLimits(userId);
        expect(result.deletedCount).toBe(2);
      });

      it('should get user rate limit summary correctly', async () => {
        const userId = new mongoose.Types.ObjectId();
        
        const summary = await RateLimitTracker.getUserRateLimitSummary(userId);
        
        expect(summary).toHaveProperty('flash');
        expect(summary).toHaveProperty('pro');
        expect(summary).toHaveProperty('embeddings');
        expect(summary.flash.remaining).toBe(15);
        expect(summary.pro.remaining).toBe(2);
      });
    });

    describe('Instance Methods', () => {
      it('should check if record is expired correctly', async () => {
        const oldRecord = new RateLimitTracker({
          ...validRateLimitData,
          windowStart: new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
        });

        const newRecord = new RateLimitTracker(validRateLimitData);

        expect(oldRecord.isExpired()).toBe(true);
        expect(newRecord.isExpired()).toBe(false);
      });

      it('should get time to reset correctly', async () => {
        const record = new RateLimitTracker(validRateLimitData);
        
        const timeToReset = record.getTimeToReset();
        
        expect(timeToReset).toBeGreaterThan(0);
        expect(timeToReset).toBeLessThanOrEqual(60000); // Should be less than 1 minute
      });
    });
  });

  describe('SearchQueryLog Model Tests', () => {
    const validSearchLogData = {
      userId: new mongoose.Types.ObjectId(),
      sessionId: 'test-session-123',
      query: 'sushi restaurant tokyo',
      searchType: 'vector',
      filters: {
        location: { city: 'Tokyo' },
        category: 'restaurant'
      },
      resultsCount: 10,
      processingTime: 150,
      successful: true
    };

    describe('Static Methods', () => {
      it('should log search correctly', async () => {
        const searchData = {
          userId: new mongoose.Types.ObjectId(),
          query: 'test query',
          searchType: 'text'
        };

        const log = await SearchQueryLog.logSearch(searchData);

        expect(log.query).toBe('test query');
        expect(log.searchType).toBe('text');
        expect(log.queryId).toBeDefined();
      });

      it('should get search analytics correctly', async () => {
        // Create some test logs
        await SearchQueryLog.create(validSearchLogData);
        await SearchQueryLog.create({
          ...validSearchLogData,
          successful: false,
          processingTime: 200
        });

        const analytics = await SearchQueryLog.getSearchAnalytics({
          startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
          endDate: new Date()
        });

        expect(analytics.totalSearches).toBe(2);
        expect(analytics.successRate).toBe(50);
        expect(analytics.averageProcessingTime).toBe(175);
      });

      it('should get popular search terms correctly', async () => {
        await SearchQueryLog.create({ ...validSearchLogData, query: 'sushi restaurant' });
        await SearchQueryLog.create({ ...validSearchLogData, query: 'sushi restaurant' });
        await SearchQueryLog.create({ ...validSearchLogData, query: 'hotel tokyo' });

        const popularTerms = await SearchQueryLog.getPopularSearchTerms({ limit: 5 });

        expect(popularTerms).toHaveLength(2);
        expect(popularTerms[0].term).toBe('sushi restaurant');
        expect(popularTerms[0].count).toBe(2);
      });
    });

    describe('Instance Methods', () => {
      it('should record interaction correctly', async () => {
        const log = new SearchQueryLog(validSearchLogData);
        await log.save();

        await log.recordInteraction('click', 'document-123');

        expect(log.interactions).toHaveLength(1);
        expect(log.interactions[0].type).toBe('click');
        expect(log.interactions[0].documentId).toBe('document-123');
      });

      it('should calculate relevance score correctly', async () => {
        const log = new SearchQueryLog(validSearchLogData);
        await log.save();

        // Add some interactions
        await log.recordInteraction('view', 'doc-1');
        await log.recordInteraction('click', 'doc-2');
        await log.recordInteraction('save', 'doc-3');

        const score = log.calculateRelevanceScore();

        expect(score).toBeGreaterThan(0);
        expect(score).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('EmbeddingDocument Model Tests', () => {
    const validEmbeddingData = {
      documentId: 'test-doc-001',
      documentType: 'restaurant',
      content: {
        title: 'Amazing Sushi Restaurant',
        description: 'Best sushi in Tokyo',
        category: 'japanese'
      },
      location: {
        city: 'Tokyo',
        country: 'Japan',
        coordinates: {
          longitude: 139.7671,
          latitude: 35.6719
        }
      },
      embedding: Array(768).fill(0.1),
      attributes: {
        rating: 4.5,
        priceRange: 'medium'
      }
    };

    describe('Static Methods', () => {
      it('should create embedding document correctly', async () => {
        const doc = await EmbeddingDocument.create(validEmbeddingData);

        expect(doc.documentId).toBe('test-doc-001');
        expect(doc.content.title).toBe('Amazing Sushi Restaurant');
        expect(doc.embedding).toHaveLength(768);
      });

      it('should find similar documents correctly', async () => {
        await EmbeddingDocument.create(validEmbeddingData);
        
        const similarDocs = await EmbeddingDocument.findSimilarDocuments(
          validEmbeddingData.embedding,
          { limit: 5, threshold: 0.5 }
        );

        expect(Array.isArray(similarDocs)).toBe(true);
      });

      it('should search by location correctly', async () => {
        await EmbeddingDocument.create(validEmbeddingData);

        const results = await EmbeddingDocument.searchByLocation(
          139.7671,
          35.6719,
          5000 // 5km radius
        );

        expect(Array.isArray(results)).toBe(true);
      });
    });

    describe('Instance Methods', () => {
      it('should record search correctly', async () => {
        const doc = new EmbeddingDocument(validEmbeddingData);
        await doc.save();

        await doc.recordSearch();

        expect(doc.searchMetadata.searchCount).toBe(1);
        expect(doc.searchMetadata.lastSearched).toBeDefined();
      });

      it('should update quality score correctly', async () => {
        const doc = new EmbeddingDocument(validEmbeddingData);
        await doc.save();

        doc.updateQualityScore();

        expect(doc.searchMetadata.qualityScore).toBeGreaterThan(0);
        expect(doc.searchMetadata.qualityScore).toBeLessThanOrEqual(100);
      });

      it('should calculate distance correctly', async () => {
        const doc = new EmbeddingDocument(validEmbeddingData);

        const distance = doc.calculateDistance(139.8, 35.7); // Slightly different coordinates

        expect(distance).toBeGreaterThan(0);
        expect(typeof distance).toBe('number');
      });
    });
  });

  describe('Auth Models Tests', () => {
    describe('AccountRecovery Model', () => {
      it('should create recovery token correctly', async () => {
        const recoveryData = {
          email: 'test@example.com',
          recoveryType: 'password_reset'
        };

        const recovery = await AccountRecovery.createRecoveryToken(recoveryData);

        expect(recovery.email).toBe('test@example.com');
        expect(recovery.token).toBeDefined();
        expect(recovery.expiresAt).toBeDefined();
        expect(recovery.used).toBe(false);
      });

      it('should validate token correctly', async () => {
        const recovery = await AccountRecovery.createRecoveryToken({
          email: 'test@example.com',
          recoveryType: 'password_reset'
        });

        const isValid = await AccountRecovery.validateToken(recovery.token);
        expect(isValid).toBeTruthy();

        const isInvalid = await AccountRecovery.validateToken('invalid-token');
        expect(isInvalid).toBeFalsy();
      });
    });

    describe('RefreshToken Model', () => {
      it('should create refresh token correctly', async () => {
        const userId = new mongoose.Types.ObjectId();
        const token = await RefreshToken.createToken(userId);

        expect(token.userId.toString()).toBe(userId.toString());
        expect(token.token).toBeDefined();
        expect(token.expiresAt).toBeDefined();
      });

      it('should validate refresh token correctly', async () => {
        const userId = new mongoose.Types.ObjectId();
        const token = await RefreshToken.createToken(userId);

        const validToken = await RefreshToken.validateToken(token.token);
        expect(validToken).toBeTruthy();

        const invalidToken = await RefreshToken.validateToken('invalid-token');
        expect(invalidToken).toBeFalsy();
      });
    });
  });
});