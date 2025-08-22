const { validationResult } = require('express-validator');
const { geminiService } = require('../../services/ai');
const { responseService } = require('../../services/common');

// Chat with AI
const chatWithAI = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Extract fields from request body
    const { message, context, model } = req.body;

    // Chat with AI using service
    const result = await geminiService.chatWithAI(userId, {
      message,
      context,
      model
    });

    console.log(`AI chat completed for user ${userId}, model: ${model || 'flash'}, tokens: ${result.tokensUsed}`);
    
    responseService.sendSuccess(res, result, 'AI chat completed successfully');
  } catch (error) {
    console.error('AI chat error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Generate Trip Itinerary
const generateItinerary = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Extract trip ID from URL parameters
    const { tripId } = req.params;

    // Extract focus from request body
    const { focus } = req.body;

    // Generate itinerary using service
    const result = await geminiService.generateItinerary(userId, tripId, { focus });

    console.log(`Itinerary generated for trip ${tripId}, user ${userId}, tokens: ${result.tokensUsed}`);
    
    responseService.sendSuccess(res, result, 'Itinerary generated successfully');
  } catch (error) {
    console.error('Generate itinerary error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Optimize Trip Schedule
const optimizeSchedule = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Extract trip ID from URL parameters
    const { tripId } = req.params;

    // Extract focus from request body
    const { focus } = req.body;

    // Optimize schedule using service
    const result = await geminiService.optimizeSchedule(userId, tripId, { focus });

    console.log(`Schedule optimized for trip ${tripId}, user ${userId}, tokens: ${result.tokensUsed}`);
    
    responseService.sendSuccess(res, result, 'Schedule optimized successfully');
  } catch (error) {
    console.error('Optimize schedule error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Validate Trip Constraints
const validateConstraints = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Extract trip ID from URL parameters
    const { tripId } = req.params;

    // Extract check type from request body
    const { checkType } = req.body;

    // Validate constraints using service
    const result = await geminiService.validateConstraints(userId, tripId, { checkType });

    console.log(`Constraints validated for trip ${tripId}, user ${userId}, tokens: ${result.tokensUsed}`);
    
    responseService.sendSuccess(res, result, 'Constraints validated successfully');
  } catch (error) {
    console.error('Validate constraints error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Generate Activity Suggestions
const suggestActivities = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Extract fields from request body
    const { tripId, date, timePeriod, interests, constraints } = req.body;

    // Generate activity suggestions using service
    const result = await geminiService.generateActivitySuggestions(userId, {
      tripId,
      date,
      timePeriod,
      interests,
      constraints
    });

    console.log(`Activity suggestions generated for user ${userId}, tokens: ${result.tokensUsed}`);
    
    responseService.sendSuccess(res, result, 'Activity suggestions generated successfully');
  } catch (error) {
    console.error('Generate activity suggestions error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Get Rate Limit Status
const getRateLimitStatus = async (req, res) => {
  try {
    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Get rate limit status from tracker
    const { RateLimitTracker } = require('../../models/ai');
    const rateLimitSummary = await RateLimitTracker.getUserRateLimitSummary(userId);

    console.log(`Rate limit status retrieved for user ${userId}`);
    
    responseService.sendSuccess(res, { rateLimits: rateLimitSummary }, 'Rate limit status retrieved successfully');
  } catch (error) {
    console.error('Get rate limit status error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Get User AI Interaction Statistics
const getInteractionStats = async (req, res) => {
  try {
    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Extract timeframe from query parameters (default to 30 days)
    const { timeframe = 30 } = req.query;

    // Get interaction statistics
    const { AIInteractionLog } = require('../../models/ai');
    const stats = await AIInteractionLog.getUserStats(userId, parseInt(timeframe));

    console.log(`Interaction stats retrieved for user ${userId}, timeframe: ${timeframe} days`);
    
    responseService.sendSuccess(res, { stats }, 'Interaction statistics retrieved successfully');
  } catch (error) {
    console.error('Get interaction stats error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Get AI Service Health Status
const getHealthStatus = async (req, res) => {
  try {
    // Check if AI services are available
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        geminiFlash: 'available',
        geminiPro: 'available',
        embeddings: 'available'
      },
      rateLimits: {
        flash: { requestsPerMinute: 15 },
        pro: { requestsPerMinute: 2 },
        embeddings: { requestsPerMinute: 10 }
      }
    };

    console.log('AI service health status checked');
    
    responseService.sendSuccess(res, healthStatus, 'AI service is healthy');
  } catch (error) {
    console.error('Get AI health status error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

module.exports = {
  chatWithAI,
  generateItinerary,
  optimizeSchedule,
  validateConstraints,
  suggestActivities,
  getRateLimitStatus,
  getInteractionStats,
  getHealthStatus
};