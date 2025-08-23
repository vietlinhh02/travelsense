const axios = require('axios');

/**
 * TripAdvisor Content API Client
 * Handles location search, details, and reviews from TripAdvisor Content API
 */
class TripAdvisorClient {
  constructor() {
    this.apiKey = process.env.TRIPADVISOR_API_KEY || 'mock-tripadvisor-key';
    this.baseUrl = 'https://api.content.tripadvisor.com/api/v1';
    
    // Default parameters for API calls
    this.defaultParams = {
      limit: 10,
      language: 'en',
      currency: 'USD'
    };

    // Category mapping for TripAdvisor location types
    this.categoryMapping = {
      'cultural': 'attractions',
      'food': 'restaurants', 
      'nature': 'attractions',
      'shopping': 'attractions',
      'accommodation': 'hotels',
      'entertainment': 'attractions'
    };

    // Subcategory mapping for more specific searches
    this.subcategoryMapping = {
      'cultural': ['museums', 'historic_sites', 'religious_sites'],
      'food': ['restaurants', 'bars_pubs', 'coffee_tea'],
      'nature': ['nature_parks', 'beaches', 'gardens'],
      'shopping': ['shopping_malls', 'specialty_shops'],
      'entertainment': ['fun_parks', 'theaters', 'nightlife']
    };
  }

  /**
   * Check if API key is configured
   * @returns {boolean} True if API key is available
   */
  hasValidApiKey() {
    return this.apiKey && this.apiKey !== 'mock-tripadvisor-key';
  }

  /**
   * Search for locations by name and location
   * @param {Object} searchParams - Search parameters
   * @param {string} searchParams.query - Location name to search for
   * @param {string} searchParams.near - Location (city, country)
   * @param {string} searchParams.category - POI category
   * @param {number} searchParams.latitude - Latitude (optional)
   * @param {number} searchParams.longitude - Longitude (optional)
   * @returns {Promise<Object>} Search results from TripAdvisor
   */
  async searchLocations(searchParams) {
    if (!this.hasValidApiKey()) {
      console.warn('⚠️ No valid TripAdvisor API key found, using mock response');
      return this._getMockSearchResponse(searchParams);
    }

    try {
      const params = this._buildSearchParams(searchParams);
      console.log(`🔍 Searching TripAdvisor for: ${searchParams.query} near ${searchParams.near}`);

      const response = await axios.get(`${this.baseUrl}/location/search`, {
        headers: {
          'X-TripAdvisor-API-Key': this.apiKey,
          'Accept': 'application/json'
        },
        params: params,
        timeout: 15000
      });

      console.log(`✅ TripAdvisor search completed: ${response.data.data?.length || 0} results`);
      return this._processSearchResponse(response.data, searchParams);

    } catch (error) {
      console.error('❌ TripAdvisor search failed:', error.response?.data || error.message);
      
      // Return mock response on error
      return this._getMockSearchResponse(searchParams);
    }
  }

  /**
   * Get detailed information about a specific location
   * @param {string} locationId - TripAdvisor location ID
   * @returns {Promise<Object>} Location details
   */
  async getLocationDetails(locationId) {
    if (!this.hasValidApiKey()) {
      console.warn('⚠️ No valid TripAdvisor API key found, using mock response');
      return this._getMockLocationDetails(locationId);
    }

    try {
      console.log(`📍 Getting TripAdvisor details for: ${locationId}`);

      const response = await axios.get(`${this.baseUrl}/location/${locationId}/details`, {
        headers: {
          'X-TripAdvisor-API-Key': this.apiKey,
          'Accept': 'application/json'
        },
        params: {
          language: this.defaultParams.language,
          currency: this.defaultParams.currency
        },
        timeout: 15000
      });

      console.log(`✅ TripAdvisor details retrieved for: ${response.data.name}`);
      return response.data;

    } catch (error) {
      console.error('❌ TripAdvisor details failed:', error.response?.data || error.message);
      
      // Return mock response on error
      return this._getMockLocationDetails(locationId);
    }
  }

  /**
   * Get reviews for a location
   * @param {string} locationId - TripAdvisor location ID
   * @param {number} limit - Number of reviews to retrieve
   * @returns {Promise<Object>} Reviews data
   */
  async getLocationReviews(locationId, limit = 5) {
    if (!this.hasValidApiKey()) {
      return this._getMockReviews(locationId, limit);
    }

    try {
      console.log(`💬 Getting TripAdvisor reviews for: ${locationId}`);

      const response = await axios.get(`${this.baseUrl}/location/${locationId}/reviews`, {
        headers: {
          'X-TripAdvisor-API-Key': this.apiKey,
          'Accept': 'application/json'
        },
        params: {
          language: this.defaultParams.language,
          limit: Math.min(limit, 20) // TripAdvisor max is usually 20
        },
        timeout: 15000
      });

      console.log(`✅ TripAdvisor reviews retrieved: ${response.data.data?.length || 0} reviews`);
      return response.data;

    } catch (error) {
      console.error('❌ TripAdvisor reviews failed:', error.response?.data || error.message);
      return this._getMockReviews(locationId, limit);
    }
  }

  /**
   * Get photos for a location
   * @param {string} locationId - TripAdvisor location ID
   * @param {number} limit - Number of photos to retrieve
   * @returns {Promise<Object>} Photos data
   */
  async getLocationPhotos(locationId, limit = 5) {
    if (!this.hasValidApiKey()) {
      return this._getMockPhotos(locationId, limit);
    }

    try {
      const response = await axios.get(`${this.baseUrl}/location/${locationId}/photos`, {
        headers: {
          'X-TripAdvisor-API-Key': this.apiKey,
          'Accept': 'application/json'
        },
        params: {
          language: this.defaultParams.language,
          limit: Math.min(limit, 20)
        },
        timeout: 15000
      });

      return response.data;

    } catch (error) {
      console.error('❌ TripAdvisor photos failed:', error.response?.data || error.message);
      return this._getMockPhotos(locationId, limit);
    }
  }

  /**
   * Build search parameters for TripAdvisor API
   * @param {Object} searchParams - Input search parameters
   * @returns {Object} Formatted parameters for API call
   */
  _buildSearchParams(searchParams) {
    const params = {
      searchQuery: searchParams.query,
      language: this.defaultParams.language,
      limit: this.defaultParams.limit
    };

    // Add location parameters
    if (searchParams.latitude && searchParams.longitude) {
      params.latLong = `${searchParams.latitude},${searchParams.longitude}`;
      params.radius = 25; // 25 km radius
      params.radiusUnit = 'km';
    } else if (searchParams.near) {
      params.address = searchParams.near;
    }

    // Add category filter if provided
    if (searchParams.category && this.categoryMapping[searchParams.category]) {
      params.category = this.categoryMapping[searchParams.category];
    }

    return params;
  }

  /**
   * Process search response from TripAdvisor
   * @param {Object} responseData - Raw API response
   * @param {Object} originalParams - Original search parameters
   * @returns {Object} Processed search results
   */
  _processSearchResponse(responseData, originalParams) {
    const results = responseData.data || [];
    
    return {
      query: originalParams.query,
      near: originalParams.near,
      total: results.length,
      results: results.map(location => ({
        location_id: location.location_id,
        name: location.name,
        description: location.description,
        web_url: location.web_url,
        address_obj: location.address_obj,
        latitude: location.latitude,
        longitude: location.longitude,
        num_reviews: location.num_reviews,
        rating: location.rating,
        rating_image_url: location.rating_image_url,
        category: location.category,
        subcategory: location.subcategory,
        location_string: location.location_string,
        photo: location.photo,
        distance: location.distance_string
      })),
      source: 'tripadvisor',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate mock search response when API is unavailable
   * @param {Object} searchParams - Search parameters
   * @returns {Object} Mock search response
   */
  _getMockSearchResponse(searchParams) {
    console.log('🔄 Using mock TripAdvisor search response');
    
    return {
      query: searchParams.query,
      near: searchParams.near,
      total: 1,
      results: [{
        location_id: `mock_ta_${Date.now()}`,
        name: searchParams.query,
        description: `Mock description for ${searchParams.query}. This is a popular destination known for its cultural significance and historical importance.`,
        web_url: `https://www.tripadvisor.com/mock-${searchParams.query.toLowerCase().replace(/\s+/g, '-')}`,
        address_obj: {
          street1: `Mock Street for ${searchParams.query}`,
          city: searchParams.near?.split(',')[0] || 'Unknown City',
          state: searchParams.near?.split(',')[1] || 'Unknown State',
          country: 'Mock Country',
          postalcode: '12345',
          address_string: `Mock Address, ${searchParams.near || 'Unknown Location'}`
        },
        latitude: (10.7769 + (Math.random() - 0.5) * 0.01).toString(),
        longitude: (106.7009 + (Math.random() - 0.5) * 0.01).toString(),
        num_reviews: Math.floor(Math.random() * 5000) + 100,
        rating: (4.0 + Math.random()).toFixed(1),
        rating_image_url: 'https://www.tripadvisor.com/img/cdsi/img2/ratings/traveler/4.0-12345.svg',
        category: {
          key: this.categoryMapping[searchParams.category] || 'attractions',
          name: this._getCategoryDisplayName(searchParams.category)
        },
        subcategory: [{
          key: 'historic_sites',
          name: 'Historic Sites'
        }],
        location_string: searchParams.near || 'Unknown Location',
        photo: {
          images: {
            small: {
              width: '150',
              url: 'https://media-cdn.tripadvisor.com/media/photo-l/mock-small.jpg',
              height: '150'
            },
            thumbnail: {
              width: '50',
              url: 'https://media-cdn.tripadvisor.com/media/photo-t/mock-thumb.jpg',
              height: '50'
            },
            original: {
              width: '2000',
              url: 'https://media-cdn.tripadvisor.com/media/photo-o/mock-original.jpg',
              height: '1500'
            },
            large: {
              width: '550',
              url: 'https://media-cdn.tripadvisor.com/media/photo-s/mock-large.jpg',
              height: '413'
            },
            medium: {
              width: '250',
              url: 'https://media-cdn.tripadvisor.com/media/photo-f/mock-medium.jpg',
              height: '188'
            }
          },
          is_blessed: true,
          uploaded_date: new Date().toISOString(),
          caption: `Beautiful view of ${searchParams.query}`,
          id: 'mock_photo_id'
        },
        distance: '1.2 km'
      }],
      source: 'tripadvisor_mock',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate mock location details
   * @param {string} locationId - Location ID
   * @returns {Object} Mock location details
   */
  _getMockLocationDetails(locationId) {
    console.log('🔄 Using mock TripAdvisor location details');
    
    return {
      location_id: locationId,
      name: `Mock Location ${locationId}`,
      description: 'This is a mock location created for testing purposes. In reality, this would contain rich information about the place including history, visitor tips, and detailed descriptions.',
      web_url: `https://www.tripadvisor.com/mock-location-${locationId}`,
      address_obj: {
        street1: 'Mock Street Address',
        city: 'Mock City',
        state: 'Mock State',
        country: 'Mock Country',
        postalcode: '12345',
        address_string: 'Mock Street Address, Mock City, Mock State, Mock Country'
      },
      latitude: (10.7769 + (Math.random() - 0.5) * 0.01).toString(),
      longitude: (106.7009 + (Math.random() - 0.5) * 0.01).toString(),
      num_reviews: Math.floor(Math.random() * 10000) + 500,
      rating: (4.0 + Math.random()).toFixed(1),
      rating_image_url: 'https://www.tripadvisor.com/img/cdsi/img2/ratings/traveler/4.5-12345.svg',
      awards: [{
        award_type: 'CERTIFICATE_OF_EXCELLENCE',
        year: '2023',
        images: {
          small: 'https://www.tripadvisor.com/img/cdsi/img2/awards/CERTIFICATE_OF_EXCELLENCE_small.jpg',
          large: 'https://www.tripadvisor.com/img/cdsi/img2/awards/CERTIFICATE_OF_EXCELLENCE_large.jpg'
        },
        categories: ['Attractions'],
        display_name: 'Certificate of Excellence 2023'
      }],
      location_string: 'Mock City, Mock Country',
      category: {
        key: 'attractions',
        name: 'Attractions'
      },
      subcategory: [{
        key: 'historic_sites',
        name: 'Historic Sites'
      }],
      price_level: '$',
      hours: {
        week_ranges: [[{
          open_time: 540, // 9:00 AM in minutes
          close_time: 1080 // 6:00 PM in minutes
        }]],
        timezone: 'Asia/Ho_Chi_Minh'
      },
      cuisine: null, // Only for restaurants
      booking: {
        provider: 'Mock Booking Provider',
        url: 'https://mockbooking.com/book'
      }
    };
  }

  /**
   * Generate mock reviews
   * @param {string} locationId - Location ID
   * @param {number} limit - Number of reviews
   * @returns {Object} Mock reviews data
   */
  _getMockReviews(locationId, limit) {
    const reviews = [];
    const sampleReviews = [
      'Amazing place with rich history! Definitely worth visiting.',
      'Beautiful architecture and very well maintained. Highly recommended!',
      'Great cultural experience. The staff was very knowledgeable.',
      'Perfect for history enthusiasts. Allow at least 2-3 hours for your visit.',
      'Stunning location with breathtaking views. A must-see destination!'
    ];

    for (let i = 0; i < Math.min(limit, 5); i++) {
      reviews.push({
        id: `mock_review_${locationId}_${i}`,
        lang: 'en',
        location_id: locationId,
        published_date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
        rating: Math.floor(Math.random() * 2) + 4, // 4 or 5 stars
        helpful_votes: Math.floor(Math.random() * 20),
        rating_image_url: 'https://www.tripadvisor.com/img/cdsi/img2/ratings/traveler/5.0-12345.svg',
        url: `https://www.tripadvisor.com/mock-review-${i}`,
        text: sampleReviews[i % sampleReviews.length],
        title: `Mock Review ${i + 1}`,
        trip_type: 'Family',
        travel_date: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 7),
        user: {
          username: `MockUser${i + 1}`,
          user_location: {
            name: 'Mock City, Mock Country',
            id: 'mock_location_id'
          },
          avatar: {
            thumbnail: 'https://media-cdn.tripadvisor.com/media/photo-t/mock-avatar.jpg',
            small: 'https://media-cdn.tripadvisor.com/media/photo-l/mock-avatar.jpg'
          }
        }
      });
    }

    return {
      data: reviews,
      paging: {
        total_results: reviews.length,
        results: reviews.length,
        offset: 0
      }
    };
  }

  /**
   * Generate mock photos
   * @param {string} locationId - Location ID
   * @param {number} limit - Number of photos
   * @returns {Object} Mock photos data
   */
  _getMockPhotos(locationId, limit) {
    const photos = [];
    for (let i = 0; i < Math.min(limit, 5); i++) {
      photos.push({
        id: `mock_photo_${locationId}_${i}`,
        is_blessed: true,
        caption: `Beautiful view ${i + 1}`,
        published_date: new Date().toISOString(),
        images: {
          thumbnail: {
            height: '50',
            width: '50',
            url: `https://media-cdn.tripadvisor.com/media/photo-t/mock-photo-${i}.jpg`
          },
          small: {
            height: '150',
            width: '150',
            url: `https://media-cdn.tripadvisor.com/media/photo-l/mock-photo-${i}.jpg`
          },
          medium: {
            height: '188',
            width: '250',
            url: `https://media-cdn.tripadvisor.com/media/photo-f/mock-photo-${i}.jpg`
          },
          large: {
            height: '413',
            width: '550',
            url: `https://media-cdn.tripadvisor.com/media/photo-s/mock-photo-${i}.jpg`
          },
          original: {
            height: '1500',
            width: '2000',
            url: `https://media-cdn.tripadvisor.com/media/photo-o/mock-photo-${i}.jpg`
          }
        },
        album: 'Other',
        user: {
          username: `MockPhotographer${i + 1}`
        }
      });
    }

    return {
      data: photos,
      paging: {
        total_results: photos.length,
        results: photos.length,
        offset: 0
      }
    };
  }

  /**
   * Get category display name from category key
   * @param {string} category - Category key
   * @returns {string} Category display name
   */
  _getCategoryDisplayName(category) {
    const categoryNames = {
      'cultural': 'Cultural Attractions',
      'food': 'Restaurants', 
      'nature': 'Nature & Outdoor',
      'shopping': 'Shopping',
      'accommodation': 'Hotels',
      'entertainment': 'Entertainment'
    };
    
    return categoryNames[category] || 'Attractions';
  }

  /**
   * Get API usage statistics
   * @returns {Object} Usage stats
   */
  getUsageStats() {
    return {
      hasValidKey: this.hasValidApiKey(),
      baseUrl: this.baseUrl,
      defaultLimit: this.defaultParams.limit,
      defaultLanguage: this.defaultParams.language,
      supportedCategories: Object.keys(this.categoryMapping),
      supportedSubcategories: this.subcategoryMapping
    };
  }
}

module.exports = TripAdvisorClient;