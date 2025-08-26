const mongoose = require('mongoose');

// Activity schema for itinerary days
const activitySchema = new mongoose.Schema({
  time: {
    type: String,
    required: true,
    trim: true,
    maxlength: 20,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ // HH:MM format validation
  },
  title: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  location: {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    address: {
      type: String,
      trim: true,
      maxlength: 300
    },
    coordinates: {
      lat: {
        type: Number,
        min: -90,
        max: 90
      },
      lng: {
        type: Number,
        min: -180,
        max: 180
      }
    }
  },
  duration: {
    type: Number, // Duration in minutes
    min: 15,
    max: 1440 // Max 24 hours
  },
  cost: {
    type: Number,
    min: 0,
    max: 50000000 // Increased for VND support (50M VND)
  },
  category: {
    type: String,
    enum: ['cultural', 'adventure', 'relaxation', 'food', 'shopping', 'nature', 'nightlife', 'transportation', 'accommodation'],
    required: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  }
}, {
  _id: true, // Enable _id for activities
  versionKey: false
});

// Itinerary day schema
const daySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  activities: [activitySchema]
}, {
  _id: true,
  versionKey: false
});

// Main trip schema
const tripSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 100
  },
  destination: {
    origin: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    destination: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },
    startDate: {
      type: Date,
      required: true,
      validate: {
        validator: function(date) {
          return !this.destination.endDate || date < this.destination.endDate;
        },
        message: 'Start date must be before end date'
      }
    },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator: function(date) {
          return !this.destination.startDate || date > this.destination.startDate;
        },
        message: 'End date must be after start date'
      }
    }
  },
  travelers: {
    adults: {
      type: Number,
      required: true,
      min: 1,
      max: 20,
      validate: {
        validator: Number.isInteger,
        message: 'Adults count must be an integer'
      }
    },
    children: {
      type: Number,
      default: 0,
      min: 0,
      max: 20,
      validate: {
        validator: Number.isInteger,
        message: 'Children count must be an integer'
      }
    },
    infants: {
      type: Number,
      default: 0,
      min: 0,
      max: 20,
      validate: {
        validator: Number.isInteger,
        message: 'Infants count must be an integer'
      }
    }
  },
  budget: {
    total: {
      type: Number,
      min: 0,
      max: 1000000
    },
    currency: {
      type: String,
      uppercase: true,
      trim: true,
      maxlength: 3,
      match: /^[A-Z]{3}$/, // ISO 4217 currency code format
      default: 'USD'
    },
    breakdown: {
      accommodation: {
        type: Number,
        min: 0,
        max: 1000000,
        default: 0
      },
      transportation: {
        type: Number,
        min: 0,
        max: 1000000,
        default: 0
      },
      food: {
        type: Number,
        min: 0,
        max: 1000000,
        default: 0
      },
      activities: {
        type: Number,
        min: 0,
        max: 1000000,
        default: 0
      },
      shopping: {
        type: Number,
        min: 0,
        max: 1000000,
        default: 0
      },
      other: {
        type: Number,
        min: 0,
        max: 1000000,
        default: 0
      }
    }
  },
  preferences: {
    interests: {
      type: [String],
      default: [],
      validate: {
        validator: function(arr) {
          return arr.length <= 20 && arr.every(item => typeof item === 'string' && item.length <= 50);
        },
        message: 'Maximum 20 interests, each with max 50 characters'
      }
    },
    constraints: {
      type: [String],
      default: [],
      validate: {
        validator: function(arr) {
          return arr.length <= 10 && arr.every(item => typeof item === 'string' && item.length <= 100);
        },
        message: 'Maximum 10 constraints, each with max 100 characters'
      }
    },
    specialRequests: {
      type: [String],
      default: [],
      validate: {
        validator: function(arr) {
          return arr.length <= 10 && arr.every(item => typeof item === 'string' && item.length <= 200);
        },
        message: 'Maximum 10 special requests, each with max 200 characters'
      }
    }
  },
  itinerary: {
    days: [daySchema],
    tips: [{
      category: {
        type: String,
        enum: ['general', 'transportation', 'accommodation', 'food', 'culture', 'safety', 'budget', 'weather'],
        required: true
      },
      title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
      },
      content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
      }
    }]
  },
  status: {
    type: String,
    enum: ['draft', 'planned', 'in-progress', 'completed'],
    default: 'draft',
    required: true
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  versionKey: false
});

// Compound indexes for performance
tripSchema.index({ userId: 1, status: 1 });
tripSchema.index({ userId: 1, createdAt: -1 });
tripSchema.index({ userId: 1, 'destination.startDate': 1 });

// Virtual for trip duration in days
tripSchema.virtual('duration').get(function() {
  if (this.destination.startDate && this.destination.endDate) {
    const timeDiff = this.destination.endDate.getTime() - this.destination.startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }
  return 0;
});

// Virtual for total travelers count
tripSchema.virtual('totalTravelers').get(function() {
  return this.travelers.adults + this.travelers.children + this.travelers.infants;
});

// Method to check if user owns this trip
tripSchema.methods.isOwnedBy = function(userId) {
  return this.userId.toString() === userId.toString();
};

// Method to get trip summary
tripSchema.methods.getSummary = function() {
  return {
    _id: this._id,
    name: this.name,
    destination: this.destination.destination,
    startDate: this.destination.startDate,
    endDate: this.destination.endDate,
    duration: this.duration,
    status: this.status,
    totalTravelers: this.totalTravelers,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
};

// Method to get public trip data (excluding sensitive information)
tripSchema.methods.toPublicJSON = function() {
  const trip = this.toObject({ virtuals: true });
  
  // Include all trip data for now - may need to exclude sensitive info later
  return trip;
};

// Static method to find trips by user with filters
tripSchema.statics.findByUserWithFilters = function(userId, filters = {}) {
  let query = { userId };
  
  // Apply status filter
  if (filters.status) {
    query.status = filters.status;
  }
  
  // Apply date range filter
  if (filters.startDate || filters.endDate) {
    query['destination.startDate'] = {};
    if (filters.startDate) {
      query['destination.startDate']['$gte'] = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query['destination.startDate']['$lte'] = new Date(filters.endDate);
    }
  }
  
  return this.find(query);
};

// Pre-save middleware to ensure itinerary days match trip duration
tripSchema.pre('save', function(next) {
  // Only validate if both dates are present and this is a planned trip
  if (this.destination.startDate && this.destination.endDate && this.status !== 'draft') {
    const duration = this.duration;
    const currentDays = this.itinerary.days.length;
    
    // If itinerary days don't match duration, initialize empty days
    if (currentDays < duration) {
      const startDate = new Date(this.destination.startDate);
      for (let i = currentDays; i < duration; i++) {
        const dayDate = new Date(startDate);
        dayDate.setDate(dayDate.getDate() + i);
        this.itinerary.days.push({
          date: dayDate,
          activities: []
        });
      }
    }
  }
  
  next();
});

// Create and export the model
const Trip = mongoose.model('Trip', tripSchema);

module.exports = Trip;