const mongoose = require('mongoose');

const searchQueryLogSchema = new mongoose.Schema({
  // Query identification
  queryId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    maxlength: 100
  },
  
  // User information
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Allow anonymous searches
    index: true
  },
  sessionId: {
    type: String,
    required: true,
    maxlength: 100,
    index: true
  },
  
  // Query details
  query: {
    searchText: {
      type: String,
      required: true,
      maxlength: 500,
      text: true
    },
    searchType: {
      type: String,
      required: true,
      enum: ['vector', 'text', 'hybrid', 'location', 'category'],
      index: true
    },
    documentTypes: [{
      type: String,
      enum: ['activity', 'location', 'accommodation', 'restaurant', 'itinerary', 'review', 'guide', 'event', 'transportation']
    }],
    filters: {
      location: {
        country: String,
        city: String,
        coordinates: {
          longitude: Number,
          latitude: Number
        },
        radius: Number // In kilometers
      },
      attributes: {
        priceRange: [String],
        minRating: Number,
        maxDuration: Number,
        categories: [String],
        accessibility: {
          wheelchairAccessible: Boolean,
          familyFriendly: Boolean,
          petFriendly: Boolean
        },
        seasons: [String]
      },
      dateRange: {
        startDate: Date,
        endDate: Date
      }
    },
    sorting: {
      sortBy: {
        type: String,
        enum: ['relevance', 'rating', 'popularity', 'distance', 'price', 'date'],
        default: 'relevance'
      },
      sortOrder: {
        type: String,
        enum: ['asc', 'desc'],
        default: 'desc'
      }
    },
    pagination: {
      limit: {
        type: Number,
        min: 1,
        max: 100,
        default: 20
      },
      offset: {
        type: Number,
        min: 0,
        default: 0
      }
    }
  },
  
  // Results metadata
  results: {
    totalFound: {
      type: Number,
      min: 0,
      required: true
    },
    totalReturned: {
      type: Number,
      min: 0,
      required: true
    },
    processingTime: {
      type: Number, // In milliseconds
      min: 0,
      max: 30000 // Max 30 seconds
    },
    searchMethod: {
      type: String,
      enum: ['atlas_vector', 'atlas_text', 'mongodb_text', 'hybrid'],
      required: true
    },
    hasMoreResults: {
      type: Boolean,
      default: false
    }
  },
  
  // User interaction data
  interactions: {
    documentsViewed: [{
      documentId: String,
      position: Number, // Position in search results
      viewedAt: Date,
      timeSpent: Number // Time spent viewing in seconds
    }],
    documentsClicked: [{
      documentId: String,
      position: Number,
      clickedAt: Date,
      actionType: {
        type: String,
        enum: ['view_details', 'save_to_trip', 'share', 'get_directions', 'book']
      }
    }],
    searchRefined: {
      type: Boolean,
      default: false
    },
    searchAbandoned: {
      type: Boolean,
      default: false
    },
    satisfactionScore: {
      type: Number,
      min: 1,
      max: 5
    }
  },
  
  // Context information
  context: {
    tripId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip'
    },
    searchIntent: {
      type: String,
      enum: ['planning', 'exploring', 'booking', 'reviewing', 'sharing'],
      default: 'exploring'
    },
    travelPhase: {
      type: String,
      enum: ['pre_trip', 'during_trip', 'post_trip'],
      default: 'pre_trip'
    },
    deviceType: {
      type: String,
      enum: ['mobile', 'tablet', 'desktop'],
      default: 'desktop'
    },
    source: {
      type: String,
      enum: ['web', 'mobile_app', 'api'],
      default: 'web'
    }
  },
  
  // Technical metadata
  technical: {
    userAgent: {
      type: String,
      maxlength: 500
    },
    ipAddress: {
      type: String,
      maxlength: 45 // IPv6 support
    },
    embeddingModel: {
      type: String,
      enum: ['text-embedding-004', 'text-embedding-ada-002'],
      default: 'text-embedding-004'
    },
    queryVector: [Number], // Store the embedding for the query
    similarQueries: [{
      queryId: String,
      similarity: Number,
      foundAt: Date
    }]
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for efficient querying
searchQueryLogSchema.index({ userId: 1, createdAt: -1 });
searchQueryLogSchema.index({ sessionId: 1, createdAt: -1 });
searchQueryLogSchema.index({ 'query.searchType': 1, createdAt: -1 });
searchQueryLogSchema.index({ 'context.tripId': 1 });
searchQueryLogSchema.index({ 'query.searchText': 'text' });
searchQueryLogSchema.index({ 'results.totalFound': 1, 'results.processingTime': 1 });

// TTL index to automatically delete logs after 1 year
searchQueryLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 31536000 }); // 365 days

// Virtual for query success rate
searchQueryLogSchema.virtual('successRate').get(function() {
  if (this.results.totalFound === 0) return 0;
  const clickedCount = this.interactions.documentsClicked.length;
  return this.results.totalReturned > 0 ? (clickedCount / this.results.totalReturned) * 100 : 0;
});

// Static method to generate query ID
searchQueryLogSchema.statics.generateQueryId = function() {
  return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Static method to log a search query
searchQueryLogSchema.statics.logSearch = function(queryData) {
  const log = new this({
    queryId: queryData.queryId || this.generateQueryId(),
    userId: queryData.userId,
    sessionId: queryData.sessionId,
    query: queryData.query,
    results: queryData.results,
    context: queryData.context || {},
    technical: queryData.technical || {}
  });
  
  return log.save();
};

// Instance method to record document interaction
searchQueryLogSchema.methods.recordInteraction = function(interactionType, documentId, position, additionalData = {}) {
  const interaction = {
    documentId,
    position,
    ...additionalData
  };
  
  if (interactionType === 'view') {
    interaction.viewedAt = new Date();
    this.interactions.documentsViewed.push(interaction);
  } else if (interactionType === 'click') {
    interaction.clickedAt = new Date();
    this.interactions.documentsClicked.push(interaction);
  }
  
  return this.save();
};

// Instance method to mark search as refined
searchQueryLogSchema.methods.markAsRefined = function() {
  this.interactions.searchRefined = true;
  return this.save();
};

// Instance method to mark search as abandoned
searchQueryLogSchema.methods.markAsAbandoned = function() {
  this.interactions.searchAbandoned = true;
  return this.save();
};

// Instance method to set satisfaction score
searchQueryLogSchema.methods.setSatisfactionScore = function(score) {
  this.interactions.satisfactionScore = score;
  return this.save();
};

// Static method to get search analytics
searchQueryLogSchema.statics.getSearchAnalytics = async function(filters = {}) {
  const pipeline = [
    {
      $match: {
        createdAt: {
          $gte: filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default: last 30 days
          $lte: filters.endDate || new Date()
        },
        ...(filters.userId && { userId: filters.userId }),
        ...(filters.searchType && { 'query.searchType': filters.searchType })
      }
    },
    {
      $group: {
        _id: null,
        totalSearches: { $sum: 1 },
        avgResultsFound: { $avg: '$results.totalFound' },
        avgProcessingTime: { $avg: '$results.processingTime' },
        searchTypes: { $push: '$query.searchType' },
        successfulSearches: {
          $sum: {
            $cond: [{ $gt: ['$results.totalFound', 0] }, 1, 0]
          }
        },
        abandonedSearches: {
          $sum: {
            $cond: ['$interactions.searchAbandoned', 1, 0]
          }
        },
        refinedSearches: {
          $sum: {
            $cond: ['$interactions.searchRefined', 1, 0]
          }
        }
      }
    }
  ];
  
  const result = await this.aggregate(pipeline);
  return result[0] || {};
};

// Static method to get popular search terms
searchQueryLogSchema.statics.getPopularSearchTerms = async function(limit = 20, timeframe = 7) {
  const startDate = new Date(Date.now() - timeframe * 24 * 60 * 60 * 1000);
  
  return await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$query.searchText',
        searchCount: { $sum: 1 },
        avgResultsFound: { $avg: '$results.totalFound' },
        uniqueUsers: { $addToSet: '$userId' }
      }
    },
    {
      $project: {
        searchText: '$_id',
        searchCount: 1,
        avgResultsFound: 1,
        uniqueUserCount: { $size: '$uniqueUsers' }
      }
    },
    {
      $sort: { searchCount: -1 }
    },
    {
      $limit: limit
    }
  ]);
};

// Static method to get user search history
searchQueryLogSchema.statics.getUserSearchHistory = function(userId, limit = 50) {
  return this.find({ userId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('queryId query.searchText results.totalFound createdAt context.searchIntent');
};

// Pre-save middleware to generate queryId if not provided
searchQueryLogSchema.pre('save', function(next) {
  if (!this.queryId) {
    this.queryId = this.constructor.generateQueryId();
  }
  next();
});

// Create and export the model
const SearchQueryLog = mongoose.model('SearchQueryLog', searchQueryLogSchema);

module.exports = SearchQueryLog;