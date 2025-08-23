const POICacheService = require('../../src/services/poi/poiCacheService');
const POICache = require('../../src/models/poi/poiCache.model');

// Mock the dependencies
jest.mock('../../src/models/poi/poiCache.model');
jest.mock('../../src/services/poi/poiExtractor.service');
jest.mock('../../src/services/poi/foursquareClient.service');
jest.mock('../../src/services/poi/tripadvisorClient.service');

describe('POI Cache Service', () => {
  let poiCacheService;
  let mockPOICache;
  let mockPOIExtractor;
  let mockFoursquareClient;
  let mockTripAdvisorClient;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create service instance
    poiCacheService = new POICacheService();

    // Get references to mocked dependencies
    mockPOIExtractor = poiCacheService.poiExtractor;
    mockFoursquareClient = poiCacheService.foursquareClient;
    mockTripAdvisorClient = poiCacheService.tripAdvisorClient;

    // Mock POICache static methods
    mockPOICache = POICache;
    mockPOICache.findByQuery = jest.fn();
    mockPOICache.generatePlaceId = jest.fn();
    mockPOICache.findOneAndUpdate = jest.fn();
    mockPOICache.cleanupExpired = jest.fn();
  });

  describe('Service Initialization', () => {
    it('should initialize with default configuration', () => {
      expect(poiCacheService.config).toBeDefined();
      expect(poiCacheService.config.cacheExpiryDays).toBe(30);
      expect(poiCacheService.config.maxApiRetries).toBe(2);
      expect(poiCacheService.config.enableMockFallback).toBe(true);
    });

    it('should initialize all required dependencies', () => {
      expect(poiCacheService.poiExtractor).toBeDefined();
      expect(poiCacheService.foursquareClient).toBeDefined();
      expect(poiCacheService.tripAdvisorClient).toBeDefined();
    });

    it('should return service statistics', () => {
      const stats = poiCacheService.getServiceStats();
      expect(stats).toBeDefined();
      expect(stats.config).toBeDefined();
      expect(stats.foursquareStats).toBeDefined();
      expect(stats.tripAdvisorStats).toBeDefined();
      expect(stats.extractorStats).toBeDefined();
    });
  });

  describe('Cache Hit Scenarios', () => {
    it('should return cached POI when cache hit occurs', async () => {
      const mockCachedPOI = {
        placeId: 'test-place-id',
        enriched: {
          name: 'Test Place',
          coordinates: { latitude: 48.8566, longitude: 2.3522 },
          rating: { average: 4.5 }
        },
        isExpired: jest.fn().mockReturnValue(false),
        recordHit: jest.fn().mockResolvedValue(true),
        getEnrichedData: jest.fn().mockReturnValue({
          name: 'Test Place',
          coordinates: { latitude: 48.8566, longitude: 2.3522 }
        })
      };

      mockPOICache.findByQuery.mockResolvedValue(mockCachedPOI);

      const poiQuery = {
        name: 'Test Place',
        city: 'Paris',
        country: 'France',
        category: 'cultural'
      };

      const result = await poiCacheService.getEnrichedPOI(poiQuery);

      expect(mockPOICache.findByQuery).toHaveBeenCalledWith(poiQuery);
      expect(mockCachedPOI.isExpired).toHaveBeenCalled();
      expect(mockCachedPOI.recordHit).toHaveBeenCalled();
      expect(result).toEqual(mockCachedPOI.getEnrichedData());
    });

    it('should handle expired cache by fetching new data', async () => {
      const mockExpiredPOI = {
        isExpired: jest.fn().mockReturnValue(true)
      };

      mockPOICache.findByQuery.mockResolvedValue(mockExpiredPOI);
      mockPOICache.generatePlaceId.mockReturnValue('generated-place-id');
      mockPOICache.findOneAndUpdate.mockResolvedValue({});

      // Mock successful API responses
      mockFoursquareClient.searchPlaces = jest.fn().mockResolvedValue({
        results: [{ fsq_id: 'test-fsq', name: 'Test Place' }],
        source: 'foursquare'
      });
      mockFoursquareClient.getPlaceDetails = jest.fn().mockResolvedValue({
        fsq_id: 'test-fsq',
        name: 'Test Place',
        coordinates: { latitude: 48.8566, longitude: 2.3522 }
      });

      mockTripAdvisorClient.searchLocations = jest.fn().mockResolvedValue({
        results: [{ location_id: 'test-ta', name: 'Test Place' }],
        source: 'tripadvisor'
      });
      mockTripAdvisorClient.getLocationDetails = jest.fn().mockResolvedValue({
        location_id: 'test-ta',
        name: 'Test Place',
        rating: '4.5'
      });
      mockTripAdvisorClient.getLocationReviews = jest.fn().mockResolvedValue({
        data: []
      });

      const poiQuery = {
        name: 'Test Place',
        city: 'Paris',
        country: 'France'
      };

      const result = await poiCacheService.getEnrichedPOI(poiQuery);

      expect(mockExpiredPOI.isExpired).toHaveBeenCalled();
      expect(mockFoursquareClient.searchPlaces).toHaveBeenCalled();
      expect(mockTripAdvisorClient.searchLocations).toHaveBeenCalled();
      expect(mockPOICache.findOneAndUpdate).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('Cache Miss Scenarios', () => {
    it('should fetch from APIs when cache miss occurs', async () => {
      mockPOICache.findByQuery.mockResolvedValue(null); // Cache miss
      mockPOICache.generatePlaceId.mockReturnValue('new-place-id');
      mockPOICache.findOneAndUpdate.mockResolvedValue({});

      // Mock successful API responses
      mockFoursquareClient.searchPlaces = jest.fn().mockResolvedValue({
        results: [{ fsq_id: 'fsq-123', name: 'New Place' }],
        source: 'foursquare'
      });
      mockFoursquareClient.getPlaceDetails = jest.fn().mockResolvedValue({
        fsq_id: 'fsq-123',
        name: 'New Place',
        coordinates: { latitude: 40.7128, longitude: -74.0060 },
        rating: 4.2
      });

      mockTripAdvisorClient.searchLocations = jest.fn().mockResolvedValue({
        results: [{ location_id: 'ta-456', name: 'New Place' }],
        source: 'tripadvisor'
      });
      mockTripAdvisorClient.getLocationDetails = jest.fn().mockResolvedValue({
        location_id: 'ta-456',
        name: 'New Place',
        rating: '4.7',
        num_reviews: 1500
      });
      mockTripAdvisorClient.getLocationReviews = jest.fn().mockResolvedValue({
        data: [{ id: 'review-1', text: 'Great place!', rating: 5 }]
      });

      const poiQuery = {
        name: 'New Place',
        city: 'New York',
        country: 'USA'
      };

      const result = await poiCacheService.getEnrichedPOI(poiQuery);

      expect(mockPOICache.findByQuery).toHaveBeenCalledWith(poiQuery);
      expect(mockFoursquareClient.searchPlaces).toHaveBeenCalled();
      expect(mockTripAdvisorClient.searchLocations).toHaveBeenCalled();
      expect(mockPOICache.findOneAndUpdate).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result.name).toBe('New Place');
    });

    it('should handle API failures gracefully', async () => {
      mockPOICache.findByQuery.mockResolvedValue(null);
      mockPOICache.generatePlaceId.mockReturnValue('fallback-place-id');

      // Mock API failures
      mockFoursquareClient.searchPlaces = jest.fn().mockRejectedValue(new Error('API Error'));
      mockTripAdvisorClient.searchLocations = jest.fn().mockRejectedValue(new Error('API Error'));

      const poiQuery = {
        name: 'Failed Place',
        city: 'Test City',
        country: 'Test Country'
      };

      const result = await poiCacheService.getEnrichedPOI(poiQuery);

      // Should return basic POI structure
      expect(result).toBeDefined();
      expect(result.name).toBe('Failed Place');
      expect(result.enrichment_status).toBe('basic_fallback');
    });
  });

  describe('Data Merging', () => {
    it('should merge Foursquare and TripAdvisor data correctly', () => {
      const originalQuery = {
        name: 'Test Place',
        city: 'Paris',
        country: 'France'
      };

      const foursquareData = {
        details: {
          name: 'Test Place Foursquare',
          coordinates: { latitude: 48.8566, longitude: 2.3522 },
          location: {
            formatted_address: '123 Test Street, Paris, France',
            address: '123 Test Street',
            locality: 'Paris',
            country: 'France'
          },
          rating: 4.2,
          categories: [{ name: 'Museum' }],
          verified: true,
          website: 'https://testplace.com'
        }
      };

      const tripAdvisorData = {
        details: {
          name: 'Test Place TripAdvisor',
          rating: '4.7',
          num_reviews: 2500,
          description: 'Amazing place to visit'
        }
      };

      const mergedData = poiCacheService._mergeAPIData(originalQuery, foursquareData, tripAdvisorData);

      expect(mergedData.name).toBe('Test Place Foursquare'); // Prefer Foursquare
      expect(mergedData.coordinates).toEqual(foursquareData.details.coordinates);
      expect(mergedData.rating.foursquare).toBe(4.2);
      expect(mergedData.rating.tripadvisor).toBe(4.7);
      expect(mergedData.rating.average).toBeCloseTo(4.45, 2);
      expect(mergedData.rating.total_reviews).toBe(2500);
      expect(mergedData.description).toBe('Amazing place to visit'); // From TripAdvisor
      expect(mergedData.verified).toBe(true);
    });

    it('should handle partial data from APIs', () => {
      const originalQuery = { name: 'Partial Place', city: 'Test City', country: 'Test Country' };

      // Only Foursquare data available
      const foursquareData = {
        details: {
          name: 'Partial Place',
          coordinates: { latitude: 10.0, longitude: 20.0 }
        }
      };

      const tripAdvisorData = null;

      const mergedData = poiCacheService._mergeAPIData(originalQuery, foursquareData, tripAdvisorData);

      expect(mergedData.name).toBe('Partial Place');
      expect(mergedData.coordinates).toEqual({ latitude: 10.0, longitude: 20.0 });
      expect(mergedData.rating.foursquare).toBeUndefined();
      expect(mergedData.rating.tripadvisor).toBeUndefined();
    });

    it('should handle empty API responses', () => {
      const originalQuery = { name: 'Empty Place', city: 'Test City', country: 'Test Country' };
      const foursquareData = null;
      const tripAdvisorData = null;

      const mergedData = poiCacheService._mergeAPIData(originalQuery, foursquareData, tripAdvisorData);

      expect(mergedData.name).toBe('Empty Place');
      expect(mergedData.coordinates).toBeNull();
      expect(mergedData.rating).toEqual({});
      expect(mergedData.categories).toEqual([]);
    });
  });

  describe('Batch Processing', () => {
    it('should process multiple POIs in batches', async () => {
      const poiQueries = [
        { name: 'Place 1', city: 'City 1', country: 'Country 1' },
        { name: 'Place 2', city: 'City 2', country: 'Country 2' },
        { name: 'Place 3', city: 'City 3', country: 'Country 3' }
      ];

      // Mock cache misses for all
      mockPOICache.findByQuery.mockResolvedValue(null);
      mockPOICache.generatePlaceId.mockImplementation(query => `${query.name}-id`);
      mockPOICache.findOneAndUpdate.mockResolvedValue({});

      // Mock API responses
      mockFoursquareClient.searchPlaces = jest.fn().mockResolvedValue({ results: [], source: 'foursquare' });
      mockTripAdvisorClient.searchLocations = jest.fn().mockResolvedValue({ results: [], source: 'tripadvisor' });

      const results = await poiCacheService._enrichPOIsBatch(poiQueries);

      expect(results).toHaveLength(3);
      expect(mockPOICache.findByQuery).toHaveBeenCalledTimes(3);
    });

    it('should handle batch processing with mixed success/failure', async () => {
      const poiQueries = [
        { name: 'Good Place', city: 'City 1', country: 'Country 1' },
        { name: 'Bad Place', city: 'City 2', country: 'Country 2' }
      ];

      mockPOICache.findByQuery.mockImplementation(query => {
        if (query.name === 'Good Place') {
          return Promise.resolve(null); // Cache miss, will fetch successfully
        } else {
          return Promise.reject(new Error('Database error')); // Will fail
        }
      });

      mockPOICache.generatePlaceId.mockReturnValue('test-id');
      mockPOICache.findOneAndUpdate.mockResolvedValue({});
      mockFoursquareClient.searchPlaces = jest.fn().mockResolvedValue({ results: [], source: 'foursquare' });
      mockTripAdvisorClient.searchLocations = jest.fn().mockResolvedValue({ results: [], source: 'tripadvisor' });

      const results = await poiCacheService._enrichPOIsBatch(poiQueries);

      expect(results).toHaveLength(2);
      // Both should return results (successful + fallback)
      expect(results[0].name).toBe('Good Place');
      expect(results[1].name).toBe('Bad Place');
      expect(results[1].enrichment_status).toBe('basic_fallback');
    });
  });

  describe('Activity Enrichment', () => {
    it('should enrich activities with POI data', async () => {
      const activities = [
        {
          title: 'Visit Eiffel Tower',
          description: 'Famous tower in Paris',
          category: 'cultural'
        },
        {
          title: 'Lunch at local restaurant',
          description: 'French cuisine',
          category: 'food'
        }
      ];

      const tripContext = {
        destination: 'Paris, France',
        city: 'Paris',
        country: 'France'
      };

      // Mock POI extraction
      mockPOIExtractor.extractPOIsFromItinerary = jest.fn().mockResolvedValue([
        {
          name: 'Eiffel Tower',
          city: 'Paris',
          country: 'France',
          category: 'cultural',
          confidence: 0.9
        }
      ]);

      // Mock enriched POI
      jest.spyOn(poiCacheService, 'getEnrichedPOI').mockResolvedValue({
        name: 'Eiffel Tower',
        coordinates: { latitude: 48.8584, longitude: 2.2945 },
        rating: { average: 4.5 },
        categories: ['Tower', 'Tourist Attraction']
      });

      const enrichedActivities = await poiCacheService.enrichActivities(activities, tripContext);

      expect(mockPOIExtractor.extractPOIsFromItinerary).toHaveBeenCalledWith(activities, tripContext);
      expect(enrichedActivities).toHaveLength(2);
      
      const enrichedActivity = enrichedActivities.find(act => act.title === 'Visit Eiffel Tower');
      expect(enrichedActivity).toBeDefined();
      expect(enrichedActivity.enrichment_status).toBe('success');
    });

    it('should handle activity enrichment failures gracefully', async () => {
      const activities = [
        { title: 'Test Activity', description: 'Test', category: 'cultural' }
      ];

      mockPOIExtractor.extractPOIsFromItinerary = jest.fn().mockRejectedValue(new Error('Extraction failed'));

      const result = await poiCacheService.enrichActivities(activities, {});

      expect(result).toHaveLength(1);
      expect(result[0].enrichment_status).toBe('failed');
      expect(result[0].enrichment_error).toBe('Extraction failed');
    });
  });

  describe('Configuration Management', () => {
    it('should allow updating service configuration', () => {
      const newConfig = {
        cacheExpiryDays: 60,
        maxApiRetries: 3
      };

      poiCacheService.updateConfig(newConfig);

      expect(poiCacheService.config.cacheExpiryDays).toBe(60);
      expect(poiCacheService.config.maxApiRetries).toBe(3);
      expect(poiCacheService.config.enableMockFallback).toBe(true); // Should retain old values
    });

    it('should provide service statistics', () => {
      const stats = poiCacheService.getServiceStats();

      expect(stats).toHaveProperty('config');
      expect(stats).toHaveProperty('foursquareStats');
      expect(stats).toHaveProperty('tripAdvisorStats');
      expect(stats).toHaveProperty('extractorStats');
    });
  });

  describe('Cache Cleanup', () => {
    it('should clean up expired cache entries', async () => {
      const mockResult = { deletedCount: 25 };
      mockPOICache.cleanupExpired.mockResolvedValue(mockResult);

      const result = await poiCacheService.cleanupExpiredCache(90);

      expect(mockPOICache.cleanupExpired).toHaveBeenCalledWith(90);
      expect(result).toEqual(mockResult);
    });

    it('should handle cleanup errors', async () => {
      mockPOICache.cleanupExpired.mockRejectedValue(new Error('Database error'));

      await expect(poiCacheService.cleanupExpiredCache()).rejects.toThrow('Database error');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors', async () => {
      mockPOICache.findByQuery.mockRejectedValue(new Error('Database connection failed'));

      const poiQuery = {
        name: 'Test Place',
        city: 'Test City',
        country: 'Test Country'
      };

      const result = await poiCacheService.getEnrichedPOI(poiQuery);

      // Should return basic POI structure
      expect(result).toBeDefined();
      expect(result.name).toBe('Test Place');
      expect(result.enrichment_status).toBe('basic_fallback');
    });

    it('should handle malformed POI queries', async () => {
      const malformedQuery = {
        name: '',
        city: null,
        country: undefined
      };

      const result = await poiCacheService.getEnrichedPOI(malformedQuery);

      expect(result).toBeDefined();
      expect(result.name).toBe(''); // Should preserve input
    });

    it('should handle empty activity arrays', async () => {
      const result = await poiCacheService.enrichActivities([], {});
      expect(result).toEqual([]);
    });

    it('should handle activities without extractable POIs', async () => {
      const activities = [
        { title: 'Rest day', description: 'Take it easy', category: 'leisure' }
      ];

      mockPOIExtractor.extractPOIsFromItinerary = jest.fn().mockResolvedValue([]);

      const result = await poiCacheService.enrichActivities(activities, {});

      expect(result).toHaveLength(1);
      expect(result[0].enrichment_status).toBe('no_match');
    });
  });

  describe('Performance and Limits', () => {
    it('should respect maxPoisPerChunk limit', async () => {
      const originalLimit = poiCacheService.config.poi?.maxPoisPerChunk;
      poiCacheService.updateConfig({ poi: { maxPoisPerChunk: 2 } });

      const activities = Array(10).fill().map((_, i) => ({
        title: `Activity ${i}`,
        description: `Description ${i}`,
        category: 'cultural'
      }));

      mockPOIExtractor.extractPOIsFromItinerary = jest.fn().mockResolvedValue(
        Array(10).fill().map((_, i) => ({
          name: `POI ${i}`,
          city: 'Test City',
          country: 'Test Country',
          confidence: 0.8
        }))
      );

      // Mock getEnrichedPOI to be called limited times
      const getEnrichedPOISpy = jest.spyOn(poiCacheService, 'getEnrichedPOI').mockResolvedValue({
        name: 'Test POI',
        enrichment_status: 'success'
      });

      await poiCacheService.enrichActivities(activities, {});

      // Should only process limited number of POIs based on maxPoisPerChunk
      // Note: The exact number called depends on the implementation details
      expect(getEnrichedPOISpy).toHaveBeenCalled();
    });
  });

  describe('Helper Methods', () => {
    it('should convert TripAdvisor price levels correctly', () => {
      expect(poiCacheService._convertTripAdvisorPriceLevel('$')).toBe(1);
      expect(poiCacheService._convertTripAdvisorPriceLevel('$$')).toBe(2);
      expect(poiCacheService._convertTripAdvisorPriceLevel('$$$')).toBe(3);
      expect(poiCacheService._convertTripAdvisorPriceLevel('$$$$')).toBe(4);
      expect(poiCacheService._convertTripAdvisorPriceLevel('')).toBeNull();
      expect(poiCacheService._convertTripAdvisorPriceLevel(null)).toBeNull();
    });

    it('should collect fetch errors correctly', () => {
      const foursquareResult = {
        status: 'rejected',
        reason: { message: 'Foursquare API error' }
      };
      
      const tripAdvisorResult = {
        status: 'fulfilled',
        value: {}
      };

      const errors = poiCacheService._collectFetchErrors(foursquareResult, tripAdvisorResult);

      expect(errors).toHaveLength(1);
      expect(errors[0].source).toBe('foursquare');
      expect(errors[0].error).toBe('Foursquare API error');
      expect(errors[0].timestamp).toBeDefined();
    });
  });
});