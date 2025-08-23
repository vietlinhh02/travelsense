const axios = require('axios');

/**
 * Foursquare Places API Client
 * Handles search and details retrieval from Foursquare Places API
 */
class FoursquareClient {
  constructor() {
    this.apiKey = process.env.FOURSQUARE_API_KEY || 'mock-foursquare-key';
    this.baseUrl = 'https://api.foursquare.com/v3/places';
    
    // Default parameters for API calls
    this.defaultParams = {
      limit: 10,
      radius: 10000, // 10km radius
      fields: [
        'fsq_id',
        'name',
        'geocodes',
        'location',
        'categories',
        'chains',
        'website',
        'tel',
        'email',
        'hours',
        'rating',
        'photos',
        'price',
        'verified',
        'timezone'
      ].join(',')
    };

    // Category mapping for better search results
    this.categoryMapping = {
      'cultural': '10000', // Arts and Entertainment
      'food': '13000',     // Food and Drink
      'nature': '16000',   // Outdoors and Recreation
      'shopping': '17000', // Retail
      'accommodation': '19000', // Travel and Transportation
      'entertainment': '10000'  // Arts and Entertainment
    };
  }

  /**
   * Check if API key is configured
   * @returns {boolean} True if API key is available
   */
  hasValidApiKey() {
    return this.apiKey && this.apiKey !== 'mock-foursquare-key';
  }

  /**
   * Search for places near a location
   * @param {Object} searchParams - Search parameters
   * @param {string} searchParams.query - Place name to search for
   * @param {string} searchParams.near - Location (city, country)
   * @param {string} searchParams.category - POI category
   * @param {number} searchParams.latitude - Latitude (optional)
   * @param {number} searchParams.longitude - Longitude (optional)
   * @returns {Promise<Object>} Search results from Foursquare
   */
  async searchPlaces(searchParams) {
    if (!this.hasValidApiKey()) {
      console.warn(' No valid Foursquare API key found, using mock response');
      return this._getMockSearchResponse(searchParams);
    }

    try {
      const params = this._buildSearchParams(searchParams);
      console.log(` Searching Foursquare for: ${searchParams.query} near ${searchParams.near}`);

      const response = await axios.get(`${this.baseUrl}/search`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        },
        params: params,
        timeout: 10000
      });

      console.log(`Foursquare search completed: ${response.data.results?.length || 0} results`);
      return this._processSearchResponse(response.data, searchParams);

    } catch (error) {
      console.error('Foursquare search failed:', error.response?.data || error.message);
      
      // Return mock response on error
      return this._getMockSearchResponse(searchParams);
    }
  }

  /**
   * Get detailed information about a specific place
   * @param {string} fsqId - Foursquare place ID
   * @returns {Promise<Object>} Place details
   */
  async getPlaceDetails(fsqId) {
    if (!this.hasValidApiKey()) {
      console.warn(' No valid Foursquare API key found, using mock response');
      return this._getMockPlaceDetails(fsqId);
    }

    try {
      console.log(`📍 Getting Foursquare details for: ${fsqId}`);

      const response = await axios.get(`${this.baseUrl}/${fsqId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        },
        params: {
          fields: this.defaultParams.fields
        },
        timeout: 10000
      });

      console.log(`Foursquare details retrieved for: ${response.data.name}`);
      return response.data;

    } catch (error) {
      console.error('Foursquare details failed:', error.response?.data || error.message);
      
      // Return mock response on error
      return this._getMockPlaceDetails(fsqId);
    }
  }

  /**
   * Get photos for a place
   * @param {string} fsqId - Foursquare place ID
   * @param {number} limit - Number of photos to retrieve
   * @returns {Promise<Array>} Array of photo objects
   */
  async getPlacePhotos(fsqId, limit = 5) {
    if (!this.hasValidApiKey()) {
      return this._getMockPhotos(fsqId, limit);
    }

    try {
      const response = await axios.get(`${this.baseUrl}/${fsqId}/photos`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json'
        },
        params: {
          limit: limit,
          sort: 'popular'
        },
        timeout: 10000
      });

      return response.data || [];

    } catch (error) {
      console.error('Foursquare photos failed:', error.response?.data || error.message);
      return this._getMockPhotos(fsqId, limit);
    }
  }

  /**
   * Build search parameters for Foursquare API
   * @param {Object} searchParams - Input search parameters
   * @returns {Object} Formatted parameters for API call
   */
  _buildSearchParams(searchParams) {
    const params = {
      query: searchParams.query,
      fields: this.defaultParams.fields,
      limit: this.defaultParams.limit,
      sort: 'RELEVANCE'
    };

    // Add location parameters
    if (searchParams.latitude && searchParams.longitude) {
      params.ll = `${searchParams.latitude},${searchParams.longitude}`;
      params.radius = this.defaultParams.radius;
    } else if (searchParams.near) {
      params.near = searchParams.near;
    }

    // Add category filter if provided
    if (searchParams.category && this.categoryMapping[searchParams.category]) {
      params.categories = this.categoryMapping[searchParams.category];
    }

    return params;
  }

  /**
   * Process search response from Foursquare
   * @param {Object} responseData - Raw API response
   * @param {Object} originalParams - Original search parameters
   * @returns {Object} Processed search results
   */
  _processSearchResponse(responseData, originalParams) {
    const results = responseData.results || [];
    
    return {
      query: originalParams.query,
      near: originalParams.near,
      total: results.length,
      results: results.map(place => ({
        fsq_id: place.fsq_id,
        name: place.name,
        coordinates: place.geocodes?.main || {},
        location: place.location || {},
        categories: place.categories || [],
        rating: place.rating,
        price: place.price,
        verified: place.verified || false,
        distance: place.distance
      })),
      source: 'foursquare',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate mock search response when API is unavailable
   * @param {Object} searchParams - Search parameters
   * @returns {Object} Mock search response
   */
  _getMockSearchResponse(searchParams) {
    console.log(' Using mock Foursquare search response');
    
    return {
      query: searchParams.query,
      near: searchParams.near,
      total: 1,
      results: [{
        fsq_id: `mock_fsq_${Date.now()}`,
        name: searchParams.query,
        coordinates: {
          latitude: 10.7769 + (Math.random() - 0.5) * 0.01,
          longitude: 106.7009 + (Math.random() - 0.5) * 0.01
        },
        location: {
          address: `Mock Address for ${searchParams.query}`,
          locality: searchParams.near?.split(',')[0] || 'Unknown City',
          region: searchParams.near?.split(',')[1] || 'Unknown Region',
          country: 'Mock Country',
          formatted_address: `Mock Address, ${searchParams.near || 'Unknown Location'}`
        },
        categories: [{
          id: '10000',
          name: this._getCategoryName(searchParams.category),
          icon: {
            prefix: 'https://ss3.4sqi.net/img/categories_v2/',
            suffix: '.png'
          }
        }],
        rating: 4.0 + Math.random(),
        price: Math.floor(Math.random() * 4) + 1,
        verified: true,
        distance: Math.floor(Math.random() * 1000)
      }],
      source: 'foursquare_mock',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate mock place details
   * @param {string} fsqId - Place ID
   * @returns {Object} Mock place details
   */
  _getMockPlaceDetails(fsqId) {
    console.log(' Using mock Foursquare place details');
    
    return {
      fsq_id: fsqId,
      name: `Mock Place ${fsqId}`,
      coordinates: {
        latitude: 10.7769 + (Math.random() - 0.5) * 0.01,
        longitude: 106.7009 + (Math.random() - 0.5) * 0.01
      },
      location: {
        address: 'Mock Street Address',
        locality: 'Mock City',
        region: 'Mock Region',
        country: 'Mock Country',
        formatted_address: 'Mock Street Address, Mock City, Mock Country'
      },
      categories: [{
        id: '10000',
        name: 'Mock Category',
        icon: {
          prefix: 'https://ss3.4sqi.net/img/categories_v2/',
          suffix: '.png'
        }
      }],
      website: 'https://example.com',
      tel: '+1234567890',
      hours: {
        display: 'Open 9:00 AM - 6:00 PM',
        open_now: true,
        regular: [{
          close: '1800',
          day: 1,
          open: '0900'
        }]
      },
      rating: 4.2,
      price: 2,
      verified: true,
      timezone: 'Asia/Ho_Chi_Minh',
      photos: [{
        id: 'mock_photo',
        prefix: 'https://fastly.4sqi.net/img/general/',
        suffix: '/original.jpg',
        width: 1920,
        height: 1080
      }]
    };
  }

  /**
   * Generate mock photos
   * @param {string} fsqId - Place ID
   * @param {number} limit - Number of photos
   * @returns {Array} Mock photos array
   */
  _getMockPhotos(fsqId, limit) {
    const photos = [];
    for (let i = 0; i < Math.min(limit, 3); i++) {
      photos.push({
        id: `mock_photo_${fsqId}_${i}`,
        prefix: 'https://fastly.4sqi.net/img/general/',
        suffix: '/original.jpg',
        width: 1920,
        height: 1080,
        user: {
          id: 'mock_user',
          firstName: 'Mock',
          lastName: 'User'
        },
        created_at: new Date().toISOString()
      });
    }
    return photos;
  }

  /**
   * Get category name from category key
   * @param {string} category - Category key
   * @returns {string} Category display name
   */
  _getCategoryName(category) {
    const categoryNames = {
      'cultural': 'Cultural Site',
      'food': 'Restaurant',
      'nature': 'Outdoor Recreation',
      'shopping': 'Shopping',
      'accommodation': 'Hotel',
      'entertainment': 'Entertainment'
    };
    
    return categoryNames[category] || 'Point of Interest';
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
      defaultRadius: this.defaultParams.radius,
      supportedCategories: Object.keys(this.categoryMapping)
    };
  }
}

module.exports = FoursquareClient;