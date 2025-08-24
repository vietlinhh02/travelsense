const mongoose = require('mongoose');

/**
 * POI Cache Schema for storing enriched place data
 * Caches results from Foursquare and TripAdvisor APIs
 */
const poiCacheSchema = new mongoose.Schema({
  // Unique identifier for the place
  placeId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Original query used to find this place
  query: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    city: {
      type: String,
      required: true,
      trim: true
    },
    country: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      trim: true
    }
  },
  
  // Foursquare API data
  foursquare: {
    fsq_id: String,
    name: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    location: {
      address: String,
      locality: String, // city
      region: String,   // state/province
      postcode: String,
      country: String,
      formatted_address: String
    },
    categories: [{
      id: String,
      name: String,
      icon: {
        prefix: String,
        suffix: String
      }
    }],
    website: String,
    tel: String,
    email: String,
    hours: {
      display: String,
      is_local_holiday: Boolean,
      open_now: Boolean,
      regular: [{
        close: String,
        day: Number,
        open: String
      }]
    },
    rating: Number,
    photos: [{
      id: String,
      prefix: String,
      suffix: String,
      width: Number,
      height: Number
    }],
    price: Number, // 1-4 scale
    verified: Boolean,
    timezone: String
  },
  
  // TripAdvisor API data
  tripadvisor: {
    location_id: String,
    name: String,
    description: String,
    web_url: String,
    address_obj: {
      street1: String,
      street2: String,
      city: String,
      state: String,
      country: String,
      postalcode: String,
      address_string: String
    },
    latitude: String,
    longitude: String,
    num_reviews: Number,
    rating: Number,
    rating_image_url: String,
    awards: [{
      award_type: String,
      year: String,
      images: {
        small: String,
        large: String
      },
      categories: [String],
      display_name: String
    }],
    location_string: String,
    photo: {
      images: {
        small: {
          width: String,
          url: String,
          height: String
        },
        thumbnail: {
          width: String,
          url: String,
          height: String
        },
        original: {
          width: String,
          url: String,
          height: String
        },
        large: {
          width: String,
          url: String,
          height: String
        },
        medium: {
          width: String,
          url: String,
          height: String
        }
      },
      is_blessed: Boolean,
      uploaded_date: String,
      caption: String,
      id: String,
      helpful_votes: String,
      published_date: String,
      user: {
        user_id: Number,
        member_id: Number,
        type: String
      }
    },
    cuisine: [{
      key: String,
      name: String
    }],
    category: {
      key: String,
      name: String
    },
    subcategory: [{
      key: String,
      name: String
    }],
    price_level: String,
    hours: {
      week_ranges: [[{
        open_time: Number,
        close_time: Number
      }]],
      timezone: String
    },
    booking: {
      provider: String,
      url: String
    }
  },
  
  // Merged/computed data for easy access
  enriched: {
    name: String,
    description: String,
    coordinates: {
      latitude: Number,
      longitude: Number
    },
    // GeoJSON location for MongoDB geospatial queries
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        index: '2dsphere'
      }
    },
    address: {
      formatted: String,
      street: String,
      city: String,
      state: String,
      country: String,
      postalcode: String
    },
    contact: {
      phone: String,
      website: String,
      email: String
    },
    rating: {
      foursquare: Number,
      tripadvisor: Number,
      average: Number,
      total_reviews: Number
    },
    categories: [String],
    price_level: Number, // 1-4 scale
    hours: {
      open_now: Boolean,
      formatted: String,
      timezone: String
    },
    photos: [{
      url: String,
      source: String, // 'foursquare' or 'tripadvisor'
      width: Number,
      height: Number
    }],
    verified: Boolean
  },
  
  // Cache metadata
  cache: {
    created_at: {
      type: Date,
      default: Date.now
    },
    updated_at: {
      type: Date,
      default: Date.now
    },
    expires_at: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    },
    foursquare_fetched: Boolean,
    tripadvisor_fetched: Boolean,
    fetch_errors: [{
      source: String, // 'foursquare' or 'tripadvisor'
      error: String,
      timestamp: Date
    }],
    hit_count: {
      type: Number,
      default: 0
    },
    last_accessed: {
      type: Date,
      default: Date.now
    }
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
poiCacheSchema.index({ 'query.name': 1, 'query.city': 1, 'query.country': 1 });
poiCacheSchema.index({ 'enriched.location': '2dsphere' });
poiCacheSchema.index({ 'cache.expires_at': 1 });
poiCacheSchema.index({ 'cache.updated_at': -1 });
poiCacheSchema.index({ 'foursquare.fsq_id': 1 });
poiCacheSchema.index({ 'tripadvisor.location_id': 1 });

// Pre-save middleware to update timestamps
poiCacheSchema.pre('save', function(next) {
  this.cache.updated_at = new Date();
  next();
});

// Methods
poiCacheSchema.methods = {
  /**
   * Check if cache is expired
   * @returns {boolean} True if cache is expired
   */
  isExpired() {
    return new Date() > this.cache.expires_at;
  },

  /**
   * Update hit count and last accessed time
   */
  recordHit() {
    this.cache.hit_count += 1;
    this.cache.last_accessed = new Date();
    return this.save();
  },

  /**
   * Get enriched data for API response
   * @returns {Object} Cleaned enriched data
   */
  getEnrichedData() {
    return {
      placeId: this.placeId,
      name: this.enriched.name,
      description: this.enriched.description,
      coordinates: this.enriched.coordinates,
      address: this.enriched.address,
      contact: this.enriched.contact,
      rating: this.enriched.rating,
      categories: this.enriched.categories,
      price_level: this.enriched.price_level,
      hours: this.enriched.hours,
      photos: this.enriched.photos,
      verified: this.enriched.verified,
      last_updated: this.cache.updated_at
    };
  },

  /**
   * Check if both API sources have been fetched
   * @returns {boolean} True if both sources fetched
   */
  isComplete() {
    return this.cache.foursquare_fetched && this.cache.tripadvisor_fetched;
  }
};

// Static methods
poiCacheSchema.statics = {
  /**
   * Find POI by query parameters
   * @param {Object} query - Query object with name, city, country
   * @returns {Promise<POICache>} Found POI or null
   */
  async findByQuery(query) {
    const normalizedQuery = {
      name: query.name.trim().toLowerCase(),
      city: query.city.trim().toLowerCase(),
      country: query.country.trim().toLowerCase()
    };

    return this.findOne({
      'query.name': { $regex: new RegExp(normalizedQuery.name, 'i') },
      'query.city': { $regex: new RegExp(normalizedQuery.city, 'i') },
      'query.country': { $regex: new RegExp(normalizedQuery.country, 'i') }
    });
  },

  /**
   * Find expired cache entries
   * @returns {Promise<Array>} Array of expired entries
   */
  async findExpired() {
    return this.find({
      'cache.expires_at': { $lt: new Date() }
    });
  },

  /**
   * Clean up old expired entries
   * @param {number} daysOld - Remove entries older than this many days
   * @returns {Promise<Object>} Delete result
   */
  async cleanupExpired(daysOld = 90) {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    return this.deleteMany({
      'cache.expires_at': { $lt: cutoffDate }
    });
  },

  /**
   * Generate place ID from query
   * @param {Object} query - Query object
   * @returns {string} Generated place ID
   */
  generatePlaceId(query) {
    const normalized = `${query.name}-${query.city}-${query.country}`
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return normalized;
  }
};

const POICache = mongoose.model('POICache', poiCacheSchema);

module.exports = POICache;