const mongoose = require('mongoose');

const searchPreferencesSchema = new mongoose.Schema({
  // User identification
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  
  // Content preferences learned from search behavior
  contentPreferences: {
    // Preferred document types based on search history
    preferredTypes: [{
      documentType: {
        type: String,
        enum: ['activity', 'location', 'accommodation', 'restaurant', 'itinerary', 'review', 'guide', 'event', 'transportation']
      },
      preferenceScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      }
    }],
    
    // Preferred categories based on interactions
    preferredCategories: [{
      category: {
        type: String,
        maxlength: 50
      },
      preferenceScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      },
      lastInteraction: {
        type: Date,
        default: Date.now
      }
    }],
    
    // Price sensitivity
    pricePreference: {
      preferredRange: {
        type: String,
        enum: ['budget', 'mid-range', 'luxury', 'mixed'],
        default: 'mixed'
      },
      flexibilityScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 50
      }
    },
    
    // Quality vs. popularity preferences
    qualityPreference: {
      prefersPopular: {
        type: Boolean,
        default: false
      },
      prefersHighRated: {
        type: Boolean,
        default: true
      },
      prefersVerified: {
        type: Boolean,
        default: true
      }
    }
  },
  
  // Geographic preferences
  locationPreferences: {
    // Frequently searched destinations
    frequentDestinations: [{
      country: {
        type: String,
        required: true,
        maxlength: 50
      },
      city: {
        type: String,
        required: true,
        maxlength: 50
      },
      searchCount: {
        type: Number,
        min: 0,
        default: 1
      },
      lastSearched: {
        type: Date,
        default: Date.now
      },
      averageStayDuration: {
        type: Number, // In days
        min: 0
      }
    }],
    
    // Distance preferences
    distancePreference: {
      preferredRadius: {
        type: Number, // In kilometers
        min: 1,
        max: 1000,
        default: 25
      },
      willingToTravel: {
        type: Number, // In kilometers
        min: 1,
        max: 10000,
        default: 100
      }
    },
    
    // Preferred regions or climates
    regionPreferences: [{
      regionType: {
        type: String,
        enum: ['urban', 'rural', 'coastal', 'mountain', 'desert', 'tropical', 'historic', 'modern']
      },
      preferenceScore: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
      }
    }]
  },
  
  // Search behavior patterns
  searchBehavior: {
    // Search frequency and timing
    searchFrequency: {
      dailyAverage: {
        type: Number,
        min: 0,
        default: 0
      },
      weeklyAverage: {
        type: Number,
        min: 0,
        default: 0
      },
      peakSearchHours: [{
        type: Number,
        min: 0,
        max: 23
      }],
      peakSearchDays: [{
        type: String,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      }]
    },
    
    // Search style preferences
    searchStyle: {
      prefersDetailedQueries: {
        type: Boolean,
        default: false
      },
      usesFilters: {
        type: Boolean,
        default: false
      },
      refinesSearches: {
        type: Boolean,
        default: false
      },
      avgQueryLength: {
        type: Number,
        min: 0,
        default: 0
      }
    },
    
    // Interaction patterns
    interactionPatterns: {
      avgTimePerResult: {
        type: Number, // In seconds
        min: 0,
        default: 0
      },
      clickThroughRate: {
        type: Number, // Percentage
        min: 0,
        max: 100,
        default: 0
      },
      bounceRate: {
        type: Number, // Percentage
        min: 0,
        max: 100,
        default: 0
      },
      preferredResultsPerPage: {
        type: Number,
        min: 5,
        max: 50,
        default: 20
      }
    }
  },
  
  // Trip planning preferences
  tripPreferences: {
    // Planning style
    planningStyle: {
      type: String,
      enum: ['detailed', 'flexible', 'spontaneous', 'structured'],
      default: 'flexible'
    },
    
    // Trip characteristics
    tripCharacteristics: {
      preferredDuration: {
        type: Number, // In days
        min: 1,
        max: 365,
        default: 7
      },
      preferredGroupSize: {
        type: Number,
        min: 1,
        max: 20,
        default: 2
      },
      travelWithChildren: {
        type: Boolean,
        default: false
      },
      accessibilityNeeds: {
        type: Boolean,
        default: false
      }
    },
    
    // Activity preferences
    activityPreferences: {
      preferredPace: {
        type: String,
        enum: ['relaxed', 'moderate', 'active', 'intensive'],
        default: 'moderate'
      },
      culturalInterests: {
        type: Number,
        min: 0,
        max: 100,
        default: 50
      },
      adventureLevel: {
        type: Number,
        min: 0,
        max: 100,
        default: 50
      },
      socialPreference: {
        type: String,
        enum: ['solo', 'intimate', 'social', 'group'],
        default: 'intimate'
      }
    }
  },
  
  // Learning and adaptation metadata
  learningMetadata: {
    totalSearches: {
      type: Number,
      min: 0,
      default: 0
    },
    totalInteractions: {
      type: Number,
      min: 0,
      default: 0
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    confidenceScore: {
      type: Number, // How confident we are in these preferences
      min: 0,
      max: 100,
      default: 0
    },
    feedbackCount: {
      type: Number,
      min: 0,
      default: 0
    },
    avgSatisfactionScore: {
      type: Number,
      min: 1,
      max: 5,
      default: 3
    }
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for efficient querying
searchPreferencesSchema.index({ userId: 1 }, { unique: true });
searchPreferencesSchema.index({ 'learningMetadata.lastUpdated': -1 });
searchPreferencesSchema.index({ 'learningMetadata.confidenceScore': -1 });

// Instance method to update content preferences based on search interaction
searchPreferencesSchema.methods.updateContentPreferences = function(documentType, category, interactionType, satisfactionScore = null) {
  // Update document type preference
  let typePreference = this.contentPreferences.preferredTypes.find(p => p.documentType === documentType);
  if (!typePreference) {
    typePreference = { documentType, preferenceScore: 0 };
    this.contentPreferences.preferredTypes.push(typePreference);
  }
  
  // Adjust preference score based on interaction type
  let scoreChange = 0;
  switch (interactionType) {
    case 'view': scoreChange = 1; break;
    case 'click': scoreChange = 3; break;
    case 'save': scoreChange = 5; break;
    case 'book': scoreChange = 10; break;
    case 'negative_feedback': scoreChange = -5; break;
    default: scoreChange = 1;
  }
  
  // Apply satisfaction score multiplier
  if (satisfactionScore) {
    scoreChange *= (satisfactionScore / 3); // Scale around neutral (3)
  }
  
  typePreference.preferenceScore = Math.max(0, Math.min(100, typePreference.preferenceScore + scoreChange));
  
  // Update category preference
  if (category) {
    let categoryPreference = this.contentPreferences.preferredCategories.find(p => p.category === category);
    if (!categoryPreference) {
      categoryPreference = { category, preferenceScore: 0, lastInteraction: new Date() };
      this.contentPreferences.preferredCategories.push(categoryPreference);
    }
    
    categoryPreference.preferenceScore = Math.max(0, Math.min(100, categoryPreference.preferenceScore + scoreChange));
    categoryPreference.lastInteraction = new Date();
  }
  
  // Update learning metadata
  this.learningMetadata.totalInteractions += 1;
  this.learningMetadata.lastUpdated = new Date();
  
  return this.save();
};

// Instance method to update location preferences
searchPreferencesSchema.methods.updateLocationPreferences = function(country, city, stayDuration = null) {
  let destination = this.locationPreferences.frequentDestinations.find(d => 
    d.country === country && d.city === city
  );
  
  if (!destination) {
    destination = { 
      country, 
      city, 
      searchCount: 0, 
      lastSearched: new Date() 
    };
    this.locationPreferences.frequentDestinations.push(destination);
  }
  
  destination.searchCount += 1;
  destination.lastSearched = new Date();
  
  if (stayDuration) {
    destination.averageStayDuration = destination.averageStayDuration 
      ? (destination.averageStayDuration + stayDuration) / 2 
      : stayDuration;
  }
  
  return this.save();
};

// Instance method to update search behavior
searchPreferencesSchema.methods.updateSearchBehavior = function(searchData) {
  const now = new Date();
  const hour = now.getHours();
  const day = now.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Update search frequency
  this.searchBehavior.searchFrequency.dailyAverage = 
    (this.searchBehavior.searchFrequency.dailyAverage * 0.9) + (1 * 0.1);
  
  // Update peak hours and days
  if (!this.searchBehavior.searchFrequency.peakSearchHours.includes(hour)) {
    this.searchBehavior.searchFrequency.peakSearchHours.push(hour);
  }
  
  if (!this.searchBehavior.searchFrequency.peakSearchDays.includes(day)) {
    this.searchBehavior.searchFrequency.peakSearchDays.push(day);
  }
  
  // Update search style
  if (searchData.queryLength) {
    this.searchBehavior.searchStyle.avgQueryLength = 
      (this.searchBehavior.searchStyle.avgQueryLength * 0.8) + (searchData.queryLength * 0.2);
  }
  
  if (searchData.usedFilters) {
    this.searchBehavior.searchStyle.usesFilters = true;
  }
  
  if (searchData.wasRefined) {
    this.searchBehavior.searchStyle.refinesSearches = true;
  }
  
  // Update learning metadata
  this.learningMetadata.totalSearches += 1;
  this.learningMetadata.lastUpdated = new Date();
  
  return this.save();
};

// Instance method to calculate confidence score
searchPreferencesSchema.methods.calculateConfidenceScore = function() {
  const totalInteractions = this.learningMetadata.totalInteractions;
  const totalSearches = this.learningMetadata.totalSearches;
  const feedbackCount = this.learningMetadata.feedbackCount;
  
  let confidence = 0;
  
  // Base confidence from interactions
  confidence += Math.min(50, totalInteractions * 2);
  
  // Additional confidence from searches
  confidence += Math.min(30, totalSearches * 1);
  
  // Boost from explicit feedback
  confidence += Math.min(20, feedbackCount * 4);
  
  this.learningMetadata.confidenceScore = Math.min(100, confidence);
  
  return this.save();
};

// Static method to get or create preferences for a user
searchPreferencesSchema.statics.getOrCreatePreferences = async function(userId) {
  let preferences = await this.findOne({ userId });
  
  if (!preferences) {
    preferences = new this({ userId });
    await preferences.save();
  }
  
  return preferences;
};

// Static method to get recommendations based on preferences
searchPreferencesSchema.statics.getRecommendations = async function(userId, options = {}) {
  const preferences = await this.findOne({ userId });
  
  if (!preferences || preferences.learningMetadata.confidenceScore < 20) {
    // Not enough data for personalization
    return {
      personalized: false,
      recommendations: {}
    };
  }
  
  const recommendations = {
    personalized: true,
    contentTypes: preferences.contentPreferences.preferredTypes
      .sort((a, b) => b.preferenceScore - a.preferenceScore)
      .slice(0, 3),
    categories: preferences.contentPreferences.preferredCategories
      .sort((a, b) => b.preferenceScore - a.preferenceScore)
      .slice(0, 5),
    destinations: preferences.locationPreferences.frequentDestinations
      .sort((a, b) => b.searchCount - a.searchCount)
      .slice(0, 3),
    priceRange: preferences.contentPreferences.pricePreference.preferredRange,
    searchStyle: preferences.searchBehavior.searchStyle
  };
  
  return recommendations;
};

// Pre-save middleware to calculate confidence score
searchPreferencesSchema.pre('save', function(next) {
  if (this.isModified()) {
    this.calculateConfidenceScore();
  }
  next();
});

// Create and export the model
const SearchPreferences = mongoose.model('SearchPreferences', searchPreferencesSchema);

module.exports = SearchPreferences;