const mongoose = require('mongoose');

const embeddingDocumentSchema = new mongoose.Schema({
  // Document identification
  documentId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    maxlength: 100
  },
  
  // Content type and source
  documentType: {
    type: String,
    required: true,
    enum: [
      'activity',        // Tourist activities and attractions
      'location',        // Places and destinations
      'accommodation',   // Hotels, hostels, etc.
      'restaurant',      // Dining establishments
      'itinerary',       // Sample itineraries
      'review',          // User reviews
      'guide',           // Travel guides and tips
      'event',           // Events and festivals
      'transportation'   // Transport options
    ],
    index: true
  },
  
  // Content metadata
  content: {
    title: {
      type: String,
      required: true,
      maxlength: 200,
      text: true // Enable text indexing
    },
    description: {
      type: String,
      required: true,
      maxlength: 2000,
      text: true // Enable text indexing
    },
    tags: [{
      type: String,
      maxlength: 50
    }],
    category: {
      type: String,
      maxlength: 50,
      index: true
    },
    subcategory: {
      type: String,
      maxlength: 50
    }
  },
  
  // Geographic information
  location: {
    name: {
      type: String,
      required: true,
      maxlength: 100,
      index: true
    },
    country: {
      type: String,
      required: true,
      maxlength: 50,
      index: true
    },
    city: {
      type: String,
      required: true,
      maxlength: 50,
      index: true
    },
    coordinates: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true
      }
    },
    region: {
      type: String,
      maxlength: 50
    }
  },
  
  // Vector embedding
  embedding: {
    type: [Number],
    required: true,
    validate: {
      validator: function(arr) {
        return arr.length === 768; // Assuming text-embedding-004 dimensions
      },
      message: 'Embedding must have exactly 768 dimensions'
    }
  },
  
  // Additional attributes
  attributes: {
    price: {
      type: String,
      enum: ['budget', 'mid-range', 'luxury', 'free']
    },
    duration: {
      type: Number, // Duration in minutes
      min: 0,
      max: 10080 // Max 1 week
    },
    rating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0
    },
    reviewCount: {
      type: Number,
      min: 0,
      default: 0
    },
    openingHours: {
      type: String,
      maxlength: 200
    },
    seasons: [{
      type: String,
      enum: ['spring', 'summer', 'autumn', 'winter', 'year-round']
    }],
    accessibility: {
      wheelchairAccessible: {
        type: Boolean,
        default: false
      },
      familyFriendly: {
        type: Boolean,
        default: false
      },
      petFriendly: {
        type: Boolean,
        default: false
      }
    }
  },
  
  // Source and quality metadata
  source: {
    name: {
      type: String,
      required: true,
      maxlength: 100
    },
    url: {
      type: String,
      maxlength: 500
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    verified: {
      type: Boolean,
      default: false
    }
  },
  
  // Search and indexing metadata
  searchMetadata: {
    popularityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    relevanceScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    qualityScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    lastSearched: {
      type: Date,
      default: Date.now
    },
    searchCount: {
      type: Number,
      min: 0,
      default: 0
    }
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for efficient querying
embeddingDocumentSchema.index({ documentType: 1, 'location.country': 1, 'location.city': 1 });
embeddingDocumentSchema.index({ 'location.coordinates': '2dsphere' }); // Geospatial index
embeddingDocumentSchema.index({ 'content.category': 1, 'attributes.rating': -1 });
embeddingDocumentSchema.index({ 'searchMetadata.popularityScore': -1 });
embeddingDocumentSchema.index({ 'source.verified': 1, 'attributes.rating': -1 });
embeddingDocumentSchema.index({ createdAt: -1 });

// Text index for full-text search fallback
embeddingDocumentSchema.index({
  'content.title': 'text',
  'content.description': 'text',
  'content.tags': 'text',
  'location.name': 'text'
});

// Virtual for formatted location
embeddingDocumentSchema.virtual('fullLocation').get(function() {
  return `${this.location.name}, ${this.location.city}, ${this.location.country}`;
});

// Instance method to calculate distance from a point
embeddingDocumentSchema.methods.distanceFrom = function(longitude, latitude) {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (latitude - this.location.coordinates.coordinates[1]) * Math.PI / 180;
  const dLon = (longitude - this.location.coordinates.coordinates[0]) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(this.location.coordinates.coordinates[1] * Math.PI / 180) * Math.cos(latitude * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
};

// Instance method to increment search count
embeddingDocumentSchema.methods.recordSearch = function() {
  this.searchMetadata.searchCount += 1;
  this.searchMetadata.lastSearched = new Date();
  return this.save();
};

// Static method to find by location
embeddingDocumentSchema.statics.findByLocation = function(country, city, documentType = null) {
  const query = {
    'location.country': new RegExp(country, 'i'),
    'location.city': new RegExp(city, 'i')
  };
  
  if (documentType) {
    query.documentType = documentType;
  }
  
  return this.find(query).sort({ 'searchMetadata.popularityScore': -1 });
};

// Static method to find nearby documents
embeddingDocumentSchema.statics.findNearby = function(longitude, latitude, maxDistance = 10000, documentType = null) {
  const query = {
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance // meters
      }
    }
  };
  
  if (documentType) {
    query.documentType = documentType;
  }
  
  return this.find(query).limit(50);
};

// Static method to search by category and filters
embeddingDocumentSchema.statics.searchByCategory = function(category, filters = {}) {
  const query = { 'content.category': new RegExp(category, 'i') };
  
  // Apply filters
  if (filters.priceRange) {
    query['attributes.price'] = { $in: filters.priceRange };
  }
  
  if (filters.minRating) {
    query['attributes.rating'] = { $gte: filters.minRating };
  }
  
  if (filters.maxDuration) {
    query['attributes.duration'] = { $lte: filters.maxDuration };
  }
  
  if (filters.accessibility) {
    Object.keys(filters.accessibility).forEach(key => {
      if (filters.accessibility[key]) {
        query[`attributes.accessibility.${key}`] = true;
      }
    });
  }
  
  if (filters.seasons && filters.seasons.length > 0) {
    query['attributes.seasons'] = { $in: filters.seasons };
  }
  
  return this.find(query)
    .sort({ 
      'attributes.rating': -1, 
      'searchMetadata.popularityScore': -1 
    });
};

// Static method to get popular documents
embeddingDocumentSchema.statics.getPopular = function(documentType = null, limit = 20) {
  const query = documentType ? { documentType } : {};
  
  return this.find(query)
    .sort({ 
      'searchMetadata.popularityScore': -1,
      'attributes.rating': -1,
      'searchMetadata.searchCount': -1
    })
    .limit(limit);
};

// Static method to full-text search
embeddingDocumentSchema.statics.textSearch = function(searchText, documentType = null, limit = 20) {
  const query = { $text: { $search: searchText } };
  
  if (documentType) {
    query.documentType = documentType;
  }
  
  return this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' }, 'attributes.rating': -1 })
    .limit(limit);
};

// Pre-save middleware to generate documentId if not provided
embeddingDocumentSchema.pre('save', function(next) {
  if (!this.documentId) {
    // Generate documentId from type, location, and title
    const titleSlug = this.content.title.toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50);
    
    this.documentId = `${this.documentType}-${this.location.city.toLowerCase()}-${titleSlug}-${Date.now()}`;
  }
  
  next();
});

// Create and export the model
const EmbeddingDocument = mongoose.model('EmbeddingDocument', embeddingDocumentSchema);

module.exports = EmbeddingDocument;