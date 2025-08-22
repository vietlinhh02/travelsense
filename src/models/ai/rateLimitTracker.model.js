const mongoose = require('mongoose');

const rateLimitTrackerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  model: {
    type: String,
    required: true,
    enum: ['flash', 'pro', 'embeddings'],
    index: true
  },
  windowStart: {
    type: Date,
    required: true,
    index: true
  },
  requestCount: {
    type: Number,
    required: true,
    min: 0,
    max: 1000,
    default: 0
  },
  lastRequestAt: {
    type: Date,
    required: true,
    default: Date.now
  }
}, {
  timestamps: true,
  versionKey: false
});

// Compound indexes for efficient rate limit checks
rateLimitTrackerSchema.index({ userId: 1, model: 1 }, { unique: true });
rateLimitTrackerSchema.index({ windowStart: 1, model: 1 });

// TTL index to automatically clean up old rate limit records after 24 hours
rateLimitTrackerSchema.index({ windowStart: 1 }, { expireAfterSeconds: 86400 });

// Rate limit configurations based on Gemini AI specification
const RATE_LIMITS = {
  flash: {
    requestsPerMinute: 15,
    windowMs: 60 * 1000 // 1 minute
  },
  pro: {
    requestsPerMinute: 2,
    windowMs: 60 * 1000 // 1 minute
  },
  embeddings: {
    requestsPerMinute: 10,
    windowMs: 60 * 1000 // 1 minute
  }
};

// Static method to check if request is within rate limit
rateLimitTrackerSchema.statics.checkRateLimit = async function(userId, model) {
  const config = RATE_LIMITS[model];
  if (!config) {
    throw new Error(`Unknown model: ${model}`);
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowMs);

  // Find or create rate limit record
  let rateLimitRecord = await this.findOne({ userId, model });

  if (!rateLimitRecord) {
    // Create new record
    rateLimitRecord = new this({
      userId,
      model,
      windowStart: now,
      requestCount: 0,
      lastRequestAt: now
    });
  }

  // Check if we need to reset the window
  if (rateLimitRecord.windowStart < windowStart) {
    rateLimitRecord.windowStart = now;
    rateLimitRecord.requestCount = 0;
  }

  // Check if within rate limit
  const withinLimit = rateLimitRecord.requestCount < config.requestsPerMinute;
  
  if (withinLimit) {
    // Increment request count
    rateLimitRecord.requestCount += 1;
    rateLimitRecord.lastRequestAt = now;
    await rateLimitRecord.save();
  }

  return {
    allowed: withinLimit,
    remaining: Math.max(0, config.requestsPerMinute - rateLimitRecord.requestCount),
    resetTime: new Date(rateLimitRecord.windowStart.getTime() + config.windowMs),
    retryAfter: withinLimit ? 0 : Math.ceil((rateLimitRecord.windowStart.getTime() + config.windowMs - now.getTime()) / 1000)
  };
};

// Static method to get current rate limit status
rateLimitTrackerSchema.statics.getRateLimitStatus = async function(userId, model) {
  const config = RATE_LIMITS[model];
  if (!config) {
    throw new Error(`Unknown model: ${model}`);
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - config.windowMs);

  const rateLimitRecord = await this.findOne({ userId, model });

  if (!rateLimitRecord || rateLimitRecord.windowStart < windowStart) {
    // No requests in current window or window has reset
    return {
      requestCount: 0,
      remaining: config.requestsPerMinute,
      resetTime: new Date(now.getTime() + config.windowMs),
      windowStart: now
    };
  }

  return {
    requestCount: rateLimitRecord.requestCount,
    remaining: Math.max(0, config.requestsPerMinute - rateLimitRecord.requestCount),
    resetTime: new Date(rateLimitRecord.windowStart.getTime() + config.windowMs),
    windowStart: rateLimitRecord.windowStart
  };
};

// Static method to reset rate limits for a user (admin function)
rateLimitTrackerSchema.statics.resetUserRateLimits = async function(userId) {
  return await this.deleteMany({ userId });
};

// Static method to get all rate limit configurations
rateLimitTrackerSchema.statics.getRateLimitConfigs = function() {
  return RATE_LIMITS;
};

// Static method to get user rate limit summary
rateLimitTrackerSchema.statics.getUserRateLimitSummary = async function(userId) {
  const models = Object.keys(RATE_LIMITS);
  const summary = {};

  for (const model of models) {
    summary[model] = await this.getRateLimitStatus(userId, model);
  }

  return summary;
};

// Instance method to check if record is expired
rateLimitTrackerSchema.methods.isExpired = function() {
  const config = RATE_LIMITS[this.model];
  const now = new Date();
  const expiryTime = new Date(this.windowStart.getTime() + config.windowMs);
  return now > expiryTime;
};

// Instance method to get remaining time in current window
rateLimitTrackerSchema.methods.getTimeToReset = function() {
  const config = RATE_LIMITS[this.model];
  const now = new Date();
  const resetTime = new Date(this.windowStart.getTime() + config.windowMs);
  return Math.max(0, resetTime.getTime() - now.getTime());
};

// Pre-save middleware to validate model and update timestamps
rateLimitTrackerSchema.pre('save', function(next) {
  if (!RATE_LIMITS[this.model]) {
    return next(new Error(`Invalid model: ${this.model}`));
  }
  
  if (this.isNew) {
    this.lastRequestAt = new Date();
  }
  
  next();
});

// Create and export the model
const RateLimitTracker = mongoose.model('RateLimitTracker', rateLimitTrackerSchema);

module.exports = RateLimitTracker;