const mongoose = require('mongoose');

const aiInteractionLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trip',
    required: false,
    index: true
  },
  endpoint: {
    type: String,
    required: true,
    enum: [
      'chat',
      'generate-itinerary',
      'optimize-schedule',
      'validate-constraints',
      'suggest-activities',
      'generate-embeddings'
    ],
    index: true
  },
  model: {
    type: String,
    required: true,
    enum: ['flash', 'pro', 'embeddings'],
    index: true
  },
  request: {
    prompt: {
      type: String,
      required: true,
      maxlength: 10000
    },
    parameters: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  response: {
    content: {
      type: String,
      required: false,
      maxlength: 50000
    },
    tokensUsed: {
      type: Number,
      min: 0,
      max: 100000
    },
    processingTime: {
      type: Number, // In milliseconds
      min: 0,
      max: 300000 // Max 5 minutes
    }
  },
  success: {
    type: Boolean,
    required: true,
    default: false,
    index: true
  },
  error: {
    type: String,
    maxlength: 1000
  },
  metadata: {
    ipAddress: {
      type: String,
      maxlength: 45 // IPv6 support
    },
    userAgent: {
      type: String,
      maxlength: 500
    },
    sessionId: {
      type: String,
      maxlength: 100
    }
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  versionKey: false
});

// Compound indexes for efficient queries
aiInteractionLogSchema.index({ userId: 1, createdAt: -1 });
aiInteractionLogSchema.index({ endpoint: 1, model: 1, createdAt: -1 });
aiInteractionLogSchema.index({ success: 1, createdAt: -1 });
aiInteractionLogSchema.index({ tripId: 1, createdAt: -1 });

// TTL index to automatically delete logs after 90 days
aiInteractionLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

// Static method to create a new interaction log
aiInteractionLogSchema.statics.createLog = function(logData) {
  return new this({
    userId: logData.userId,
    tripId: logData.tripId,
    endpoint: logData.endpoint,
    model: logData.model,
    request: {
      prompt: logData.prompt,
      parameters: logData.parameters || {}
    },
    response: {
      content: logData.responseContent,
      tokensUsed: logData.tokensUsed,
      processingTime: logData.processingTime
    },
    success: logData.success,
    error: logData.error,
    metadata: {
      ipAddress: logData.ipAddress,
      userAgent: logData.userAgent,
      sessionId: logData.sessionId
    }
  });
};

// Static method to get user interaction statistics
aiInteractionLogSchema.statics.getUserStats = async function(userId, timeframe = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeframe);

  const stats = await this.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: null,
        totalRequests: { $sum: 1 },
        successfulRequests: {
          $sum: { $cond: ['$success', 1, 0] }
        },
        failedRequests: {
          $sum: { $cond: ['$success', 0, 1] }
        },
        totalTokensUsed: { $sum: '$response.tokensUsed' },
        avgProcessingTime: { $avg: '$response.processingTime' },
        endpointBreakdown: {
          $push: '$endpoint'
        },
        modelBreakdown: {
          $push: '$model'
        }
      }
    }
  ]);

  return stats[0] || {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    totalTokensUsed: 0,
    avgProcessingTime: 0,
    endpointBreakdown: [],
    modelBreakdown: []
  };
};

// Static method to get endpoint usage statistics
aiInteractionLogSchema.statics.getEndpointStats = async function(timeframe = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeframe);

  return await this.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          endpoint: '$endpoint',
          model: '$model'
        },
        requestCount: { $sum: 1 },
        successRate: {
          $avg: { $cond: ['$success', 1, 0] }
        },
        avgTokensUsed: { $avg: '$response.tokensUsed' },
        avgProcessingTime: { $avg: '$response.processingTime' }
      }
    },
    {
      $sort: { requestCount: -1 }
    }
  ]);
};

// Instance method to sanitize log for export
aiInteractionLogSchema.methods.toSafeJSON = function() {
  const log = this.toObject();
  
  // Remove potentially sensitive information
  if (log.request && log.request.prompt) {
    log.request.prompt = log.request.prompt.substring(0, 500) + '...';
  }
  
  if (log.response && log.response.content) {
    log.response.content = log.response.content.substring(0, 500) + '...';
  }
  
  return log;
};

// Create and export the model
const AIInteractionLog = mongoose.model('AIInteractionLog', aiInteractionLogSchema);

module.exports = AIInteractionLog;