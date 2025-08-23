const FoursquareClient = require('../../src/services/poi/foursquareClient.service');
const TripAdvisorClient = require('../../src/services/poi/tripadvisorClient.service');
const axios = require('axios');

// Mock axios
jest.mock('axios');
const mockedAxios = axios;

describe('API Clients Tests', () => {
  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset environment variables
    delete process.env.FOURSQUARE_API_KEY;
    delete process.env.TRIPADVISOR_API_KEY;
  });

  describe('Foursquare Client', () => {
    let foursquareClient;

    beforeEach(() => {
      foursquareClient = new FoursquareClient();
    });

    describe('API Key Management', () => {
      it('should detect when no valid API key is configured', () => {
        const hasValidKey = foursquareClient.hasValidApiKey();
        expect(hasValidKey).toBe(false);
      });

      it('should detect when valid API key is configured', () => {
        process.env.FOURSQUARE_API_KEY = 'valid-test-key';
        const newClient = new FoursquareClient();
        expect(newClient.hasValidApiKey()).toBe(true);
      });

      it('should return usage stats', () => {
        const stats = foursquareClient.getUsageStats();
        expect(stats).toHaveProperty('hasValidKey');
        expect(stats).toHaveProperty('baseUrl');
        expect(stats).toHaveProperty('defaultLimit');
        expect(stats).toHaveProperty('supportedCategories');
        expect(Array.isArray(stats.supportedCategories)).toBe(true);
      });
    });

    describe('Search Places - Mock Responses', () => {
      it('should return mock response when no API key is configured', async () => {
        const searchParams = {
          query: 'Notre Dame Cathedral',
          near: 'Paris, France',
          category: 'cultural'
        };

        const result = await foursquareClient.searchPlaces(searchParams);
        
        expect(result).toHaveProperty('source', 'foursquare_mock');
        expect(result).toHaveProperty('results');
        expect(Array.isArray(result.results)).toBe(true);
        expect(result.results.length).toBeGreaterThan(0);
        expect(result.results[0]).toHaveProperty('name');
        expect(result.results[0]).toHaveProperty('coordinates');
        expect(result.results[0]).toHaveProperty('location');
      });

      it('should return mock place details when no API key is configured', async () => {
        const fsqId = 'test-fsq-id';
        const result = await foursquareClient.getPlaceDetails(fsqId);
        
        expect(result).toHaveProperty('fsq_id', fsqId);
        expect(result).toHaveProperty('name');
        expect(result).toHaveProperty('coordinates');
        expect(result).toHaveProperty('location');
        expect(result).toHaveProperty('rating');
      });

      it('should return mock photos when no API key is configured', async () => {
        const fsqId = 'test-fsq-id';
        const limit = 3;
        const result = await foursquareClient.getPlacePhotos(fsqId, limit);
        
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeLessThanOrEqual(limit);
        
        if (result.length > 0) {
          expect(result[0]).toHaveProperty('id');
          expect(result[0]).toHaveProperty('prefix');
          expect(result[0]).toHaveProperty('suffix');
        }
      });
    });

    describe('Search Places - API Responses', () => {
      beforeEach(() => {
        process.env.FOURSQUARE_API_KEY = 'valid-test-key';
        foursquareClient = new FoursquareClient();
      });

      it('should handle successful API response', async () => {
        const mockResponse = {
          data: {
            results: [{
              fsq_id: 'test-fsq-123',
              name: 'Test Place',
              geocodes: {
                main: { latitude: 48.8566, longitude: 2.3522 }
              },
              location: {
                address: '123 Test Street',
                locality: 'Paris',
                region: 'Île-de-France',
                country: 'France'
              },
              categories: [{
                id: '10000',
                name: 'Cultural Site',
                icon: { prefix: 'https://test.com/', suffix: '.png' }
              }],
              rating: 4.5,
              price: 2,
              verified: true
            }]
          }
        };

        mockedAxios.get.mockResolvedValueOnce(mockResponse);

        const searchParams = {
          query: 'Test Place',
          near: 'Paris, France',
          category: 'cultural'
        };

        const result = await foursquareClient.searchPlaces(searchParams);
        
        expect(mockedAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('/search'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer valid-test-key'
            })
          })
        );

        expect(result).toHaveProperty('source', 'foursquare');
        expect(result.results).toHaveLength(1);
        expect(result.results[0]).toHaveProperty('fsq_id', 'test-fsq-123');
        expect(result.results[0]).toHaveProperty('name', 'Test Place');
      });

      it('should handle API errors gracefully', async () => {
        const mockError = {
          response: {
            data: { error: 'API limit exceeded' }
          }
        };

        mockedAxios.get.mockRejectedValueOnce(mockError);

        const searchParams = {
          query: 'Test Place',
          near: 'Paris, France'
        };

        const result = await foursquareClient.searchPlaces(searchParams);
        
        // Should fall back to mock response
        expect(result).toHaveProperty('source', 'foursquare_mock');
      });

      it('should handle network timeout', async () => {
        const timeoutError = new Error('timeout of 10000ms exceeded');
        mockedAxios.get.mockRejectedValueOnce(timeoutError);

        const searchParams = {
          query: 'Test Place',
          near: 'Paris, France'
        };

        const result = await foursquareClient.searchPlaces(searchParams);
        
        // Should fall back to mock response
        expect(result).toHaveProperty('source', 'foursquare_mock');
      });
    });

    describe('Place Details - API Responses', () => {
      beforeEach(() => {
        process.env.FOURSQUARE_API_KEY = 'valid-test-key';
        foursquareClient = new FoursquareClient();
      });

      it('should fetch place details successfully', async () => {
        const mockResponse = {
          data: {
            fsq_id: 'test-fsq-123',
            name: 'Test Place Details',
            geocodes: {
              main: { latitude: 48.8566, longitude: 2.3522 }
            },
            location: {
              address: '123 Test Street',
              formatted_address: '123 Test Street, Paris, France'
            },
            website: 'https://testplace.com',
            tel: '+33123456789',
            hours: {
              display: 'Open 9:00 AM - 6:00 PM',
              open_now: true
            },
            rating: 4.7,
            verified: true
          }
        };

        mockedAxios.get.mockResolvedValueOnce(mockResponse);

        const result = await foursquareClient.getPlaceDetails('test-fsq-123');
        
        expect(mockedAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('/test-fsq-123'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'Authorization': 'Bearer valid-test-key'
            })
          })
        );

        expect(result).toEqual(mockResponse.data);
      });
    });
  });

  describe('TripAdvisor Client', () => {
    let tripAdvisorClient;

    beforeEach(() => {
      tripAdvisorClient = new TripAdvisorClient();
    });

    describe('API Key Management', () => {
      it('should detect when no valid API key is configured', () => {
        const hasValidKey = tripAdvisorClient.hasValidApiKey();
        expect(hasValidKey).toBe(false);
      });

      it('should detect when valid API key is configured', () => {
        process.env.TRIPADVISOR_API_KEY = 'valid-test-key';
        const newClient = new TripAdvisorClient();
        expect(newClient.hasValidApiKey()).toBe(true);
      });

      it('should return usage stats', () => {
        const stats = tripAdvisorClient.getUsageStats();
        expect(stats).toHaveProperty('hasValidKey');
        expect(stats).toHaveProperty('baseUrl');
        expect(stats).toHaveProperty('defaultLimit');
        expect(stats).toHaveProperty('supportedCategories');
        expect(stats).toHaveProperty('supportedSubcategories');
      });
    });

    describe('Search Locations - Mock Responses', () => {
      it('should return mock response when no API key is configured', async () => {
        const searchParams = {
          query: 'Eiffel Tower',
          near: 'Paris, France',
          category: 'cultural'
        };

        const result = await tripAdvisorClient.searchLocations(searchParams);
        
        expect(result).toHaveProperty('source', 'tripadvisor_mock');
        expect(result).toHaveProperty('results');
        expect(Array.isArray(result.results)).toBe(true);
        expect(result.results.length).toBeGreaterThan(0);
        
        const firstResult = result.results[0];
        expect(firstResult).toHaveProperty('location_id');
        expect(firstResult).toHaveProperty('name');
        expect(firstResult).toHaveProperty('address_obj');
        expect(firstResult).toHaveProperty('rating');
        expect(firstResult).toHaveProperty('num_reviews');
      });

      it('should return mock location details when no API key is configured', async () => {
        const locationId = 'test-location-123';
        const result = await tripAdvisorClient.getLocationDetails(locationId);
        
        expect(result).toHaveProperty('location_id', locationId);
        expect(result).toHaveProperty('name');
        expect(result).toHaveProperty('description');
        expect(result).toHaveProperty('address_obj');
        expect(result).toHaveProperty('rating');
        expect(result).toHaveProperty('awards');
      });

      it('should return mock reviews when no API key is configured', async () => {
        const locationId = 'test-location-123';
        const limit = 3;
        const result = await tripAdvisorClient.getLocationReviews(locationId, limit);
        
        expect(result).toHaveProperty('data');
        expect(Array.isArray(result.data)).toBe(true);
        expect(result.data.length).toBeLessThanOrEqual(limit);
        
        if (result.data.length > 0) {
          const review = result.data[0];
          expect(review).toHaveProperty('id');
          expect(review).toHaveProperty('text');
          expect(review).toHaveProperty('rating');
          expect(review).toHaveProperty('user');
        }
      });
    });

    describe('Search Locations - API Responses', () => {
      beforeEach(() => {
        process.env.TRIPADVISOR_API_KEY = 'valid-test-key';
        tripAdvisorClient = new TripAdvisorClient();
      });

      it('should handle successful API response', async () => {
        const mockResponse = {
          data: {
            data: [{
              location_id: 'test-ta-123',
              name: 'Test Attraction',
              description: 'A beautiful test attraction',
              web_url: 'https://tripadvisor.com/test',
              address_obj: {
                street1: '123 Test Avenue',
                city: 'Paris',
                country: 'France',
                address_string: '123 Test Avenue, Paris, France'
              },
              latitude: '48.8566',
              longitude: '2.3522',
              num_reviews: 1500,
              rating: '4.5',
              category: {
                key: 'attractions',
                name: 'Attractions'
              }
            }]
          }
        };

        mockedAxios.get.mockResolvedValueOnce(mockResponse);

        const searchParams = {
          query: 'Test Attraction',
          near: 'Paris, France',
          category: 'cultural'
        };

        const result = await tripAdvisorClient.searchLocations(searchParams);
        
        expect(mockedAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('/location/search'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-TripAdvisor-API-Key': 'valid-test-key'
            })
          })
        );

        expect(result).toHaveProperty('source', 'tripadvisor');
        expect(result.results).toHaveLength(1);
        expect(result.results[0]).toHaveProperty('location_id', 'test-ta-123');
        expect(result.results[0]).toHaveProperty('name', 'Test Attraction');
      });

      it('should handle API errors gracefully', async () => {
        const mockError = {
          response: {
            data: { error: 'Unauthorized' }
          }
        };

        mockedAxios.get.mockRejectedValueOnce(mockError);

        const searchParams = {
          query: 'Test Place',
          near: 'Paris, France'
        };

        const result = await tripAdvisorClient.searchLocations(searchParams);
        
        // Should fall back to mock response
        expect(result).toHaveProperty('source', 'tripadvisor_mock');
      });
    });

    describe('Location Details and Reviews', () => {
      beforeEach(() => {
        process.env.TRIPADVISOR_API_KEY = 'valid-test-key';
        tripAdvisorClient = new TripAdvisorClient();
      });

      it('should fetch location details successfully', async () => {
        const mockResponse = {
          data: {
            location_id: 'test-ta-123',
            name: 'Test Location Details',
            description: 'Detailed description of the location',
            web_url: 'https://tripadvisor.com/test-details',
            num_reviews: 2500,
            rating: '4.8',
            awards: [],
            hours: {
              week_ranges: [[{ open_time: 540, close_time: 1080 }]],
              timezone: 'Europe/Paris'
            }
          }
        };

        mockedAxios.get.mockResolvedValueOnce(mockResponse);

        const result = await tripAdvisorClient.getLocationDetails('test-ta-123');
        
        expect(mockedAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('/location/test-ta-123/details'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-TripAdvisor-API-Key': 'valid-test-key'
            })
          })
        );

        expect(result).toEqual(mockResponse.data);
      });

      it('should fetch location reviews successfully', async () => {
        const mockResponse = {
          data: {
            data: [{
              id: 'review-123',
              text: 'Great place to visit!',
              rating: 5,
              published_date: '2024-01-15T10:00:00Z',
              user: {
                username: 'TestUser',
                user_location: { name: 'New York, NY' }
              }
            }],
            paging: {
              total_results: 100,
              results: 1,
              offset: 0
            }
          }
        };

        mockedAxios.get.mockResolvedValueOnce(mockResponse);

        const result = await tripAdvisorClient.getLocationReviews('test-ta-123', 5);
        
        expect(mockedAxios.get).toHaveBeenCalledWith(
          expect.stringContaining('/location/test-ta-123/reviews'),
          expect.objectContaining({
            headers: expect.objectContaining({
              'X-TripAdvisor-API-Key': 'valid-test-key'
            })
          })
        );

        expect(result).toEqual(mockResponse.data);
      });

      it('should fetch location photos successfully', async () => {
        const mockResponse = {
          data: {
            data: [{
              id: 'photo-123',
              caption: 'Beautiful view',
              images: {
                thumbnail: { url: 'https://example.com/thumb.jpg' },
                small: { url: 'https://example.com/small.jpg' },
                large: { url: 'https://example.com/large.jpg' }
              }
            }]
          }
        };

        mockedAxios.get.mockResolvedValueOnce(mockResponse);

        const result = await tripAdvisorClient.getLocationPhotos('test-ta-123', 3);
        
        expect(result).toEqual(mockResponse.data);
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    let foursquareClient;
    let tripAdvisorClient;

    beforeEach(() => {
      foursquareClient = new FoursquareClient();
      tripAdvisorClient = new TripAdvisorClient();
    });

    it('should handle malformed search parameters gracefully', async () => {
      const malformedParams = {
        query: '',
        near: null,
        category: undefined
      };

      const fsqResult = await foursquareClient.searchPlaces(malformedParams);
      const taResult = await tripAdvisorClient.searchLocations(malformedParams);

      expect(fsqResult).toBeDefined();
      expect(taResult).toBeDefined();
      
      // Both should fall back to mock responses
      expect(fsqResult.source).toContain('mock');
      expect(taResult.source).toContain('mock');
    });

    it('should handle empty API responses', async () => {
      process.env.FOURSQUARE_API_KEY = 'valid-test-key';
      process.env.TRIPADVISOR_API_KEY = 'valid-test-key';
      
      const newFsqClient = new FoursquareClient();
      const newTaClient = new TripAdvisorClient();

      // Mock empty responses
      mockedAxios.get.mockResolvedValueOnce({ data: { results: [] } });
      mockedAxios.get.mockResolvedValueOnce({ data: { data: [] } });

      const searchParams = {
        query: 'Nonexistent Place',
        near: 'Middle of Nowhere'
      };

      const fsqResult = await newFsqClient.searchPlaces(searchParams);
      const taResult = await newTaClient.searchLocations(searchParams);

      expect(fsqResult.results).toHaveLength(0);
      expect(taResult.results).toHaveLength(0);
    });

    it('should handle rate limiting errors', async () => {
      process.env.FOURSQUARE_API_KEY = 'valid-test-key';
      const newFsqClient = new FoursquareClient();

      const rateLimitError = {
        response: {
          status: 429,
          data: { error: 'Rate limit exceeded' }
        }
      };

      mockedAxios.get.mockRejectedValueOnce(rateLimitError);

      const result = await newFsqClient.searchPlaces({
        query: 'Test Place',
        near: 'Test City'
      });

      // Should fall back to mock response
      expect(result.source).toBe('foursquare_mock');
    });

    it('should handle authentication errors', async () => {
      process.env.TRIPADVISOR_API_KEY = 'invalid-key';
      const newTaClient = new TripAdvisorClient();

      const authError = {
        response: {
          status: 401,
          data: { error: 'Invalid API key' }
        }
      };

      mockedAxios.get.mockRejectedValueOnce(authError);

      const result = await newTaClient.searchLocations({
        query: 'Test Place',
        near: 'Test City'
      });

      // Should fall back to mock response
      expect(result.source).toBe('tripadvisor_mock');
    });

    it('should handle server errors', async () => {
      process.env.FOURSQUARE_API_KEY = 'valid-test-key';
      const newFsqClient = new FoursquareClient();

      const serverError = {
        response: {
          status: 500,
          data: { error: 'Internal server error' }
        }
      };

      mockedAxios.get.mockRejectedValueOnce(serverError);

      const result = await newFsqClient.getPlaceDetails('test-fsq-123');

      // Should return mock details
      expect(result.fsq_id).toBe('test-fsq-123');
      expect(result.name).toContain('Mock Place');
    });
  });

  describe('Parameter Building and URL Construction', () => {
    let foursquareClient;
    let tripAdvisorClient;

    beforeEach(() => {
      process.env.FOURSQUARE_API_KEY = 'test-key';
      process.env.TRIPADVISOR_API_KEY = 'test-key';
      foursquareClient = new FoursquareClient();
      tripAdvisorClient = new TripAdvisorClient();
    });

    it('should build correct Foursquare search parameters', async () => {
      const mockResponse = { data: { results: [] } };
      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const searchParams = {
        query: 'Museum',
        near: 'Paris, France',
        category: 'cultural',
        latitude: 48.8566,
        longitude: 2.3522
      };

      await foursquareClient.searchPlaces(searchParams);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/search'),
        expect.objectContaining({
          params: expect.objectContaining({
            query: 'Museum',
            ll: '48.8566,2.3522',
            categories: '10000' // Cultural category ID
          })
        })
      );
    });

    it('should build correct TripAdvisor search parameters', async () => {
      const mockResponse = { data: { data: [] } };
      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      const searchParams = {
        query: 'Restaurant',
        near: 'Tokyo, Japan',
        category: 'food'
      };

      await tripAdvisorClient.searchLocations(searchParams);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('/location/search'),
        expect.objectContaining({
          params: expect.objectContaining({
            searchQuery: 'Restaurant',
            address: 'Tokyo, Japan',
            category: 'restaurants'
          })
        })
      );
    });

    it('should handle coordinate-based vs text-based location parameters', async () => {
      const mockResponse = { data: { results: [] } };
      mockedAxios.get.mockResolvedValueOnce(mockResponse);
      mockedAxios.get.mockResolvedValueOnce(mockResponse);

      // Test coordinate-based search
      await foursquareClient.searchPlaces({
        query: 'Cafe',
        latitude: 40.7128,
        longitude: -74.0060
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({
            ll: '40.7128,-74.006'
          })
        })
      );

      // Test text-based search
      await foursquareClient.searchPlaces({
        query: 'Cafe',
        near: 'New York, NY'
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({
            near: 'New York, NY'
          })
        })
      );
    });
  });
});