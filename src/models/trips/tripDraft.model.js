const mongoose = require('mongoose');

/**
 * TripDraft Schema - Temporary storage for trip planning conversations
 * Tracks conversation state and collects trip information progressively
 */
const tripDraftSchema = new mongoose.Schema({
  // User who owns this draft
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Conversation session ID (can be regenerated)
  sessionId: {
    type: String,
    required: true,
    index: true
  },

  // Current status
  status: {
    type: String,
    enum: ['collecting', 'ready', 'materialized', 'expired'],
    default: 'collecting'
  },

  // Extracted trip information
  extracted: {
    // Basic trip info
    origin: String,
    destinations: [String],
    dates: {
      start: Date,
      end: Date
    },
    duration: Number,
    travelers: {
      adults: { type: Number, default: 2 },
      children: { type: Number, default: 0 },
      infants: { type: Number, default: 0 }
    },
    budget: {
      total: Number,
      currency: { type: String, default: 'USD' }
    },

    // Preferences
    interests: [String],
    pace: {
      type: String,
      enum: ['easy', 'balanced', 'intense']
    },
    nightlife: {
      type: String,
      enum: ['none', 'some', 'heavy']
    },
    dayStart: String, // HH:MM format
    dayEnd: String,   // HH:MM format
    quietMorningAfterLateNight: Boolean,
    transportPrefs: [String],
    walkingLimitKm: Number,
    dietary: [String],
    mobility: {
      type: String,
      enum: ['none', 'stroller', 'wheelchair']
    },
    mustSee: [String],
    avoid: [String],
    notes: String
  },

  // Missing required fields for trip creation
  missing: [String],

  // Ambiguities that need clarification
  ambiguities: [{
    field: String,
    issue: String,
    suggestion: String
  }],

  // Conversation history (last 10 messages)
  conversationHistory: [{
    role: {
      type: String,
      enum: ['user', 'assistant']
    },
    content: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    extractedData: Object // What AI extracted from this message
  }],

  // Trip creation readiness score (0-100)
  readinessScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  // When this draft was created
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  // When this draft was last updated
  updatedAt: {
    type: Date,
    default: Date.now
  },

  // When this draft expires (default 24 hours)
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  }
});

// Indexes for efficient queries
tripDraftSchema.index({ userId: 1, status: 1 });
tripDraftSchema.index({ userId: 1, sessionId: 1 });
tripDraftSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Update updatedAt on save
tripDraftSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Calculate readiness score based on available information
tripDraftSchema.methods.calculateReadiness = function() {
  let score = 0;
  const extracted = this.extracted || {};

  // Required fields (50 points total)
  if (extracted.destinations && extracted.destinations.length > 0) score += 20;
  if (extracted.origin) score += 10;
  if (extracted.dates && (extracted.dates.start || extracted.duration)) score += 20;

  // Nice-to-have fields (50 points total)
  if (extracted.travelers && extracted.travelers.adults > 0) score += 10;
  if (extracted.budget && extracted.budget.total > 0) score += 10;
  if (extracted.interests && extracted.interests.length > 0) score += 10;
  if (extracted.pace) score += 5;
  if (extracted.nightlife) score += 5;
  if (extracted.dayStart || extracted.dayEnd) score += 5;
  if (extracted.mustSee && extracted.mustSee.length > 0) score += 5;

  this.readinessScore = Math.min(score, 100);

  // Update status based on score
  if (this.readinessScore >= 70) {
    this.status = 'ready';
  } else {
    this.status = 'collecting';
  }

  return this.readinessScore;
};

// Check if draft is ready to create trip
tripDraftSchema.methods.isReadyForTripCreation = function() {
  const extracted = this.extracted || {};

  // Must have destination and either dates or duration
  const hasDestination = extracted.destinations && extracted.destinations.length > 0;
  const hasTimeframe = (extracted.dates && extracted.dates.start) || extracted.duration;

  return hasDestination && hasTimeframe && this.status === 'ready';
};

// Add new message to conversation history
tripDraftSchema.methods.addMessage = function(role, content, extractedData = null) {
  this.conversationHistory.push({
    role,
    content,
    extractedData,
    timestamp: new Date()
  });

  // Keep only last 10 messages
  if (this.conversationHistory.length > 10) {
    this.conversationHistory = this.conversationHistory.slice(-10);
  }

  return this;
};

// Update extracted information
tripDraftSchema.methods.updateExtracted = function(newExtracted, newMissing = [], newAmbiguities = []) {
  // Merge new extracted data with existing
  this.extracted = {
    ...this.extracted,
    ...newExtracted
  };

  // Update missing fields
  this.missing = newMissing;

  // Update ambiguities
  this.ambiguities = newAmbiguities.map(ambiguity => ({
    field: ambiguity.field,
    issue: ambiguity.issue,
    suggestion: ambiguity.suggestion,
    timestamp: new Date()
  }));

  // Recalculate readiness
  this.calculateReadiness();

  return this;
};

// Get next question to ask user
tripDraftSchema.methods.getNextQuestion = function() {
  if (this.missing && this.missing.length > 0) {
    const nextField = this.missing[0];

    const questions = {
      destinations: "Bạn muốn đi đâu? (ví dụ: Tokyo, Paris, Bangkok)",
      origin: "Bạn xuất phát từ đâu? (ví dụ: Ho Chi Minh City)",
      dates: "Bạn muốn đi vào thời gian nào? (ví dụ: 15/12/2024 - 20/12/2024)",
      duration: "Bạn muốn đi bao nhiêu ngày?",
      travelers: "Bạn đi với bao nhiêu người? (người lớn, trẻ em)",
      budget: "Ngân sách của bạn là bao nhiêu?"
    };

    return questions[nextField] || `Bạn có thể cho tôi biết thêm về ${nextField}?`;
  }

  if (this.ambiguities && this.ambiguities.length > 0) {
    return this.ambiguities[0].suggestion || "Bạn có thể làm rõ thêm ý bạn không?";
  }

  return null;
};

// Static methods
tripDraftSchema.statics.findActiveByUserId = function(userId) {
  return this.find({
    userId,
    status: { $in: ['collecting', 'ready'] },
    expiresAt: { $gt: new Date() }
  }).sort({ updatedAt: -1 });
};

tripDraftSchema.statics.findBySessionId = function(sessionId) {
  return this.findOne({
    sessionId,
    expiresAt: { $gt: new Date() }
  });
};

tripDraftSchema.statics.cleanupExpired = function() {
  return this.deleteMany({
    expiresAt: { $lte: new Date() }
  });
};

// Export the model
module.exports = mongoose.model('TripDraft', tripDraftSchema);
