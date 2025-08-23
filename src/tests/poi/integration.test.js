const LongTripHandler = require('../../src/services/ai/longTripHandler');
const POICacheService = require('../../src/services/poi/poiCacheService');
const POICache = require('../../src/models/poi/poiCache.model');

// Mock database and external dependencies
jest.mock('../../src/models/poi/poiCache.model');
jest.mock('axios');

describe('POI Enrichment Integration Tests', () => {
  let longTripHandler;
  let mockAiServices;
  let mockPOICache;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Initialize Long Trip Handler
    longTripHandler = new LongTripHandler();

    // Mock POICache
    mockPOICache = POICache;
    mockPOICache.findByQuery = jest.fn();
    mockPOICache.generatePlaceId = jest.fn();
    mockPOICache.findOneAndUpdate = jest.fn();
    mockPOICache.cleanupExpired = jest.fn();

    // Mock AI services
    mockAiServices = {
      generateStandardItinerary: jest.fn(),
      geminiClient: {
        callGeminiAPI: jest.fn()
      },
      promptBuilder: {
        buildChunkedItineraryPrompt: jest.fn()
      },
      responseParser: {
        processChunkedItineraryResponse: jest.fn()
      }
    };
  });

  describe('End-to-End POI Enrichment Flow', () => {
    it('should enrich standard itinerary with POI data', async () => {
      // Mock standard itinerary generation
      const mockStandardItinerary = {
        days: [
          {
            date: new Date('2024-06-01'),
            activities: [
              {
                time: '09:00',
                title: 'Visit Notre Dame Cathedral',
                description: 'Explore the famous cathedral',
                location: { name: 'Notre Dame Cathedral' },
                category: 'cultural'
              },
              {
                time: '14:00',
                title: 'Lunch at Le Comptoir du Relais',
                description: 'Traditional French bistro',
                location: { name: 'Le Comptoir du Relais' },
                category: 'food'
              }
            ]
          }
        ]
      };

      mockAiServices.generateStandardItinerary.mockResolvedValue(mockStandardItinerary);

      // Mock POI cache responses (cache miss)
      mockPOICache.findByQuery.mockResolvedValue(null);
      mockPOICache.generatePlaceId.mockImplementation(query => `${query.name.toLowerCase().replace(/\\s+/g, '-')}-${query.city.toLowerCase()}`);
      mockPOICache.findOneAndUpdate.mockResolvedValue({});

      // Create short trip (will use standard generation)
      const shortTrip = {
        duration: 3,
        destination: {
          destination: 'Paris, France',
          startDate: new Date('2024-06-01')
        },
        travelers: { adults: 2, children: 0 },
        preferences: { interests: ['cultural', 'food'] },
        budget: { total: 2000 }
      };

      const result = await longTripHandler.generateChunkedItinerary(shortTrip, mockAiServices);

      expect(mockAiServices.generateStandardItinerary).toHaveBeenCalledWith(shortTrip);
      expect(result.days).toBeDefined();
      expect(result.days).toHaveLength(1);
      
      // Check that activities are enriched
      const enrichedDay = result.days[0];
      expect(enrichedDay.activities).toHaveLength(2);
      
      // Activities should have enrichment status
      enrichedDay.activities.forEach(activity => {
        expect(activity).toHaveProperty('enrichment_status');
      });
    });

    it('should enrich long trip itinerary chunks with POI data', async () => {
      // Mock chunked itinerary generation
      mockAiServices.promptBuilder.buildChunkedItineraryPrompt.mockReturnValue('Mock prompt for chunk');
      mockAiServices.geminiClient.callGeminiAPI.mockResolvedValue({
        content: 'Mock AI response',
        tokensUsed: 150,
        model: 'flash'
      });

      mockAiServices.responseParser.processChunkedItineraryResponse.mockImplementation((content, trip, chunk) => {
        const chunkDuration = chunk.endDay - chunk.startDay + 1;
        const days = [];
        
        for (let i = 0; i < chunkDuration; i++) {
          days.push({
            date: new Date('2024-07-01'),
            activities: [
              {
                time: '10:00',
                title: `Imperial City Visit - Day ${i + 1}`,
                description: 'Historical palace complex',
                location: { name: 'Imperial City' },
                category: 'cultural'
              },
              {
                time: '15:00',
                title: `Local Restaurant - Day ${i + 1}`,
                description: 'Traditional Vietnamese cuisine',
                location: { name: 'Local Restaurant' },
                category: 'food'
              }
            ]
          });
        }
        
        return { days };
      });

      // Mock POI cache (cache miss for fresh enrichment)
      mockPOICache.findByQuery.mockResolvedValue(null);
      mockPOICache.generatePlaceId.mockImplementation(query => `${query.name.toLowerCase().replace(/\\s+/g, '-')}`);
      mockPOICache.findOneAndUpdate.mockResolvedValue({});

      // Create long trip (will use chunked generation)
      const longTrip = {
        duration: 15,
        destination: {
          destination: 'Vietnam Cultural Tour',
          startDate: new Date('2024-07-01')
        },
        travelers: { adults: 4, children: 2 },
        preferences: { 
          interests: ['cultural', 'food', 'nature'],
          constraints: ['family_friendly']
        },
        budget: { total: 8000 }
      };

      const result = await longTripHandler.generateChunkedItinerary(longTrip, mockAiServices);

      expect(result.days).toBeDefined();
      expect(result.days.length).toBeGreaterThan(0);
      
      // Verify chunks were generated and enriched
      expect(mockAiServices.geminiClient.callGeminiAPI).toHaveBeenCalled();
      expect(mockAiServices.responseParser.processChunkedItineraryResponse).toHaveBeenCalled();
      
      // Check that activities have enrichment status
      result.days.forEach(day => {
        if (day.activities) {
          day.activities.forEach(activity => {
            expect(activity).toHaveProperty('enrichment_status');
          });
        }
      });
    });

    it('should handle POI enrichment with cache hits', async () => {
      // Mock cached POI data
      const mockCachedPOI = {
        placeId: 'eiffel-tower-paris',
        enriched: {
          name: 'Eiffel Tower',
          coordinates: { latitude: 48.8584, longitude: 2.2945 },
          address: { formatted: 'Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France' },
          rating: { foursquare: 4.3, tripadvisor: 4.5, average: 4.4, total_reviews: 85000 },
          categories: ['Tower', 'Tourist Attraction'],
          verified: true
        },
        isExpired: jest.fn().mockReturnValue(false),
        recordHit: jest.fn().mockResolvedValue(true),
        getEnrichedData: jest.fn().mockReturnValue({
          name: 'Eiffel Tower',
          coordinates: { latitude: 48.8584, longitude: 2.2945 },
          address: { formatted: 'Champ de Mars, 5 Avenue Anatole France, 75007 Paris, France' },
          rating: { average: 4.4, total_reviews: 85000 },
          categories: ['Tower', 'Tourist Attraction'],
          verified: true
        })
      };

      mockPOICache.findByQuery.mockResolvedValue(mockCachedPOI);

      const mockItinerary = {
        days: [{
          date: new Date('2024-06-01'),
          activities: [{
            time: '10:00',
            title: 'Visit Eiffel Tower',
            description: 'Iconic Parisian landmark',
            location: { name: 'Eiffel Tower' },
            category: 'cultural'
          }]
        }]
      };

      mockAiServices.generateStandardItinerary.mockResolvedValue(mockItinerary);

      const trip = {
        duration: 2,
        destination: { destination: 'Paris, France', startDate: new Date('2024-06-01') },
        travelers: { adults: 2 },
        preferences: { interests: ['cultural'] }
      };

      const result = await longTripHandler.generateChunkedItinerary(trip, mockAiServices);

      expect(mockPOICache.findByQuery).toHaveBeenCalled();
      expect(mockCachedPOI.recordHit).toHaveBeenCalled();
      
      const enrichedActivity = result.days[0].activities[0];
      expect(enrichedActivity.enrichment_status).toBe('success');
      expect(enrichedActivity.poi_data.rating.average).toBe(4.4);
      expect(enrichedActivity.location.coordinates).toBeDefined();
    });
  });

  describe('Error Handling in Integration Flow', () => {
    it('should handle POI enrichment failures gracefully', async () => {
      // Mock AI generation success but POI enrichment failure
      const mockItinerary = {
        days: [{
          date: new Date('2024-06-01'),
          activities: [{
            time: '10:00',
            title: 'Visit Unknown Place',
            description: 'Mysterious location',
            category: 'cultural'
          }]
        }]
      };

      mockAiServices.generateStandardItinerary.mockResolvedValue(mockItinerary);

      // Mock POI cache failure
      mockPOICache.findByQuery.mockRejectedValue(new Error('Database connection failed'));

      const trip = {
        duration: 2,
        destination: { destination: 'Remote Location', startDate: new Date('2024-06-01') },
        travelers: { adults: 1 }
      };

      const result = await longTripHandler.generateChunkedItinerary(trip, mockAiServices);

      expect(result.days).toBeDefined();
      expect(result.days[0].activities[0]).toHaveProperty('enrichment_status');
      // Should indicate enrichment failure but preserve original activity
      expect(result.days[0].activities[0].title).toBe('Visit Unknown Place');
    });

    it('should handle AI generation failure with POI enrichment disabled', async () => {
      // Disable POI enrichment
      longTripHandler.setPOIEnrichment(false);

      mockAiServices.generateStandardItinerary.mockRejectedValue(new Error('AI service unavailable'));

      const trip = {
        duration: 2,
        destination: { destination: 'Test Location' },
        travelers: { adults: 1 }
      };

      await expect(longTripHandler.generateChunkedItinerary(trip, mockAiServices))
        .rejects.toThrow('AI service unavailable');

      // POI enrichment should not have been attempted
      expect(mockPOICache.findByQuery).not.toHaveBeenCalled();
    });

    it('should handle chunk generation failure with fallback', async () => {
      // Mock chunk generation failure
      mockAiServices.geminiClient.callGeminiAPI.mockRejectedValue(new Error('API quota exceeded'));

      const longTrip = {
        duration: 12,
        destination: { destination: 'Test Location', startDate: new Date('2024-06-01') },
        travelers: { adults: 2 }
      };

      const result = await longTripHandler.generateChunkedItinerary(longTrip, mockAiServices);

      expect(result.days).toBeDefined();
      expect(result.days.length).toBeGreaterThan(0);
      
      // Should contain fallback activities
      const hasFailbackActivities = result.days.some(day => 
        day.activities.some(activity => 
          activity.notes && activity.notes.includes('Fallback activity')
        )
      );
      expect(hasFailbackActivities).toBe(true);
    });
  });

  describe('Performance and Scalability Tests', () => {
    it('should handle large itineraries efficiently', async () => {
      // Create large itinerary with many activities
      const largeItinerary = {
        days: Array(30).fill().map((_, dayIndex) => ({
          date: new Date(`2024-06-${dayIndex + 1}`),
          activities: Array(5).fill().map((_, actIndex) => ({
            time: `${9 + actIndex * 2}:00`,
            title: `Activity ${dayIndex}-${actIndex}`,
            description: `Description for activity ${dayIndex}-${actIndex}`,
            location: { name: `Location ${dayIndex}-${actIndex}` },
            category: ['cultural', 'food', 'nature', 'shopping'][actIndex % 4]
          }))
        }))
      };

      mockAiServices.generateStandardItinerary.mockResolvedValue(largeItinerary);
      
      // Mock cache misses for performance testing
      mockPOICache.findByQuery.mockResolvedValue(null);
      mockPOICache.generatePlaceId.mockImplementation(query => `mock-id-${Date.now()}`);
      mockPOICache.findOneAndUpdate.mockResolvedValue({});

      const largeTripDuration = 30;
      const largeTrip = {
        duration: largeTripDuration,
        destination: { destination: 'Multi-city Tour', startDate: new Date('2024-06-01') },
        travelers: { adults: 4, children: 2 },
        preferences: { interests: ['cultural', 'food', 'nature', 'shopping'] }
      };

      const startTime = Date.now();
      const result = await longTripHandler.generateChunkedItinerary(largeTrip, mockAiServices);
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(result.days).toBeDefined();
      expect(result.days.length).toBeLessThanOrEqual(largeTripDuration);
      expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds
    });

    it('should respect POI processing limits', async () => {
      // Configure POI limits
      longTripHandler.updateConfig({
        poi: {
          enableEnrichment: true,
          maxPoisPerChunk: 5
        }
      });

      const manyActivitiesItinerary = {
        days: [{
          date: new Date('2024-06-01'),
          activities: Array(20).fill().map((_, i) => ({
            time: `${9 + i}:00`,
            title: `POI Activity ${i}`,
            description: `Activity with POI ${i}`,
            location: { name: `POI Location ${i}` },
            category: 'cultural'
          }))
        }]
      };

      mockAiServices.generateStandardItinerary.mockResolvedValue(manyActivitiesItinerary);
      mockPOICache.findByQuery.mockResolvedValue(null);
      mockPOICache.generatePlaceId.mockImplementation(query => `poi-${Date.now()}-${Math.random()}`);
      mockPOICache.findOneAndUpdate.mockResolvedValue({});

      const trip = {
        duration: 1,
        destination: { destination: 'POI Test City' },
        travelers: { adults: 1 }
      };

      const result = await longTripHandler.generateChunkedItinerary(trip, mockAiServices);

      expect(result.days).toBeDefined();
      expect(result.days[0].activities).toHaveLength(20);
      
      // Should have processed POIs but within limits
      const enrichedActivities = result.days[0].activities.filter(activity => 
        activity.enrichment_status === 'success' || activity.enrichment_status === 'no_match'
      );
      expect(enrichedActivities.length).toBeGreaterThan(0);
    });
  });

  describe('Configuration and Feature Toggles', () => {
    it('should allow disabling POI enrichment', async () => {
      longTripHandler.setPOIEnrichment(false);

      const mockItinerary = {
        days: [{
          date: new Date('2024-06-01'),
          activities: [{
            title: 'Test Activity',
            description: 'Test Description'
          }]
        }]
      };

      mockAiServices.generateStandardItinerary.mockResolvedValue(mockItinerary);

      const trip = {
        duration: 2,
        destination: { destination: 'Test Location' },
        travelers: { adults: 1 }
      };

      const result = await longTripHandler.generateChunkedItinerary(trip, mockAiServices);

      expect(result).toEqual(mockItinerary);
      expect(mockPOICache.findByQuery).not.toHaveBeenCalled();
    });

    it('should allow enabling POI enrichment', async () => {
      longTripHandler.setPOIEnrichment(true);

      const mockItinerary = {
        days: [{
          date: new Date('2024-06-01'),
          activities: [{
            title: 'Enrichable Activity',
            description: 'Activity that can be enriched',
            category: 'cultural'
          }]
        }]
      };

      mockAiServices.generateStandardItinerary.mockResolvedValue(mockItinerary);
      mockPOICache.findByQuery.mockResolvedValue(null);
      mockPOICache.generatePlaceId.mockReturnValue('test-id');
      mockPOICache.findOneAndUpdate.mockResolvedValue({});

      const trip = {
        duration: 2,
        destination: { destination: 'Test Location' },
        travelers: { adults: 1 }
      };

      const result = await longTripHandler.generateChunkedItinerary(trip, mockAiServices);

      expect(result.days[0].activities[0]).toHaveProperty('enrichment_status');
    });

    it('should provide POI statistics through integration', async () => {
      const stats = longTripHandler.getPOIStats();

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('config');
      expect(stats).toHaveProperty('foursquareStats');
      expect(stats).toHaveProperty('tripAdvisorStats');
      expect(stats).toHaveProperty('extractorStats');
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle Vietnam cultural tour scenario', async () => {
      const vietnamItinerary = {
        days: [
          {
            date: new Date('2024-08-01'),
            activities: [
              {
                time: '09:00',
                title: 'Visit Imperial City (Dai Noi)',
                description: 'Historical palace complex in Hue',
                location: { name: 'Imperial City' },
                category: 'cultural'
              },
              {
                time: '14:00',
                title: 'Lunch at Quan An Ngon',
                description: 'Traditional Vietnamese restaurant',
                location: { name: 'Quan An Ngon' },
                category: 'food'
              },
              {
                time: '16:00',
                title: 'Perfume River cruise',
                description: 'Scenic boat trip along the river',
                location: { name: 'Perfume River' },
                category: 'nature'
              }
            ]
          }
        ]
      };

      mockAiServices.generateStandardItinerary.mockResolvedValue(vietnamItinerary);

      // Mock specific POI cache responses for Vietnamese locations
      mockPOICache.findByQuery.mockImplementation(query => {
        if (query.name.toLowerCase().includes('imperial city')) {
          return Promise.resolve({
            enriched: {
              name: 'Imperial City (Dai Noi)',
              coordinates: { latitude: 16.4637, longitude: 107.5909 },
              rating: { average: 4.3 }
            },
            isExpired: () => false,
            recordHit: () => Promise.resolve(),
            getEnrichedData: () => ({
              name: 'Imperial City (Dai Noi)',
              coordinates: { latitude: 16.4637, longitude: 107.5909 }
            })
          });
        }
        return Promise.resolve(null);
      });

      mockPOICache.generatePlaceId.mockImplementation(query => query.name.toLowerCase().replace(/\\s+/g, '-'));
      mockPOICache.findOneAndUpdate.mockResolvedValue({});

      const vietnamTrip = {
        duration: 7,
        destination: {
          destination: 'Vietnam Cultural Heritage Tour',
          startDate: new Date('2024-08-01')
        },
        travelers: { adults: 2, children: 0 },
        preferences: { 
          interests: ['cultural', 'food', 'nature'],
          constraints: ['authentic_experiences']
        },
        budget: { total: 3000, currency: 'USD' }
      };

      const result = await longTripHandler.generateChunkedItinerary(vietnamTrip, mockAiServices);

      expect(result.days).toBeDefined();
      expect(result.days[0].activities).toHaveLength(3);
      
      const imperialCityActivity = result.days[0].activities.find(activity => 
        activity.title.includes('Imperial City')
      );
      expect(imperialCityActivity).toBeDefined();
      expect(imperialCityActivity.enrichment_status).toBe('success');
      expect(imperialCityActivity.location.coordinates).toBeDefined();
    });

    it('should handle multi-city European tour scenario', async () => {
      // Mock chunked generation for long European tour
      mockAiServices.promptBuilder.buildChunkedItineraryPrompt.mockReturnValue('European tour prompt');
      mockAiServices.geminiClient.callGeminiAPI.mockResolvedValue({
        content: 'European tour response',
        tokensUsed: 200
      });

      mockAiServices.responseParser.processChunkedItineraryResponse.mockImplementation((content, trip, chunk) => {
        const cities = ['Paris', 'Rome', 'Berlin', 'Amsterdam'];
        const chunkCity = cities[Math.floor(Math.random() * cities.length)];
        
        return {
          days: [{
            date: new Date('2024-09-01'),
            activities: [
              {
                time: '10:00',
                title: `Visit ${chunkCity} Cathedral`,
                description: `Famous cathedral in ${chunkCity}`,
                location: { name: `${chunkCity} Cathedral` },
                category: 'cultural'
              },
              {
                time: '14:00',
                title: `${chunkCity} Food Tour`,
                description: `Local cuisine experience in ${chunkCity}`,
                location: { name: `${chunkCity} Food Market` },
                category: 'food'
              }
            ]
          }]
        };
      });

      mockPOICache.findByQuery.mockResolvedValue(null);
      mockPOICache.generatePlaceId.mockImplementation(query => `${query.name}-${query.city}`.toLowerCase().replace(/\\s+/g, '-'));
      mockPOICache.findOneAndUpdate.mockResolvedValue({});

      const europeanTour = {
        duration: 21,
        destination: {
          destination: 'Europe Multi-City Cultural Tour',
          startDate: new Date('2024-09-01')
        },
        travelers: { adults: 4, children: 2, infants: 0 },
        preferences: {
          interests: ['cultural', 'food', 'nature'],
          constraints: ['family_friendly', 'accessible']
        },
        budget: { total: 15000, currency: 'EUR' }
      };

      const result = await longTripHandler.generateChunkedItinerary(europeanTour, mockAiServices);

      expect(result.days).toBeDefined();
      expect(result.days.length).toBeGreaterThan(0);
      expect(mockAiServices.geminiClient.callGeminiAPI).toHaveBeenCalled();
      
      // Verify activities have enrichment status
      result.days.forEach(day => {
        if (day.activities) {
          day.activities.forEach(activity => {
            expect(activity).toHaveProperty('enrichment_status');
          });
        }
      });
    });
  });
});