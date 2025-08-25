const { AIInteractionLog, RateLimitTracker } = require('../../models/ai');
const AIBaseService = require('./aiBase.service');

/**
 * AIValidationService - Handles AI-powered validation and health checks
 * Extends AIBaseService with validation-specific functionality
 */
class AIValidationService extends AIBaseService {
  constructor() {
    super();
  }

  /**
   * Get service health status
   * @returns {Promise<Object>} Health status
   */
  async getHealthStatus() {
    const apiHealth = await this.apiClient.checkApiHealth();

    return {
      status: apiHealth ? 'healthy' : 'degraded',
      apiClient: apiHealth ? 'connected' : 'using_fallback',
      components: {
        apiClient: this.apiClient.hasValidApiKey(),
        promptBuilder: true,
        responseParser: true,
        templateService: true,
        longTripHandler: true
      },
      longTripConfig: this.longTripHandler.getConfig(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get rate limit status for user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Rate limit status
   */
  async getRateLimitStatus(userId) {
    try {
      // Get rate limit status from tracker
      const { RateLimitTracker } = require('../../models/ai');
      const rateLimitSummary = await RateLimitTracker.getUserRateLimitSummary(userId);

      console.log(`Rate limit status retrieved for user ${userId}`);

      return {
        rateLimits: rateLimitSummary,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Get rate limit status error:', error);
      throw new Error('Failed to get rate limit status');
    }
  }

  /**
   * Get user AI interaction statistics
   * @param {string} userId - User ID
   * @param {number} timeframe - Timeframe in days
   * @returns {Promise<Object>} Interaction statistics
   */
  async getInteractionStats(userId, timeframe = 30) {
    try {
      // Get interaction statistics
      const { AIInteractionLog } = require('../../models/ai');
      const stats = await AIInteractionLog.getUserStats(userId, timeframe);

      console.log(`Interaction stats retrieved for user ${userId}, timeframe: ${timeframe} days`);

      return {
        stats,
        timeframe,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Get interaction stats error:', error);
      throw new Error('Failed to get interaction statistics');
    }
  }

  /**
   * Validate AI service configuration
   * @returns {Promise<Object>} Configuration validation results
   */
  async validateConfiguration() {
    const issues = [];
    const warnings = [];

    // Check API key
    if (!this.apiClient.hasValidApiKey()) {
      issues.push({
        type: 'configuration',
        message: 'Gemini API key is not configured or invalid'
      });
    }

    // Check model availability
    try {
      const health = await this.getHealthStatus();
      if (health.status !== 'healthy') {
        warnings.push({
          type: 'service_health',
          message: `AI service health is ${health.status}`
        });
      }
    } catch (error) {
      issues.push({
        type: 'service_unavailable',
        message: 'Unable to check AI service health'
      });
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Test AI service connectivity
   * @returns {Promise<Object>} Connectivity test results
   */
  async testConnectivity() {
    const startTime = Date.now();
    const results = {
      apiClient: false,
      flashModel: false,
      proModel: false,
      responseTime: 0,
      errors: []
    };

    try {
      // Test API client
      results.apiClient = this.apiClient.hasValidApiKey();

      if (results.apiClient) {
        // Test Flash model
        try {
          const flashTest = await this._callGeminiAPI('flash', 'Hello', {
            generationConfig: { maxOutputTokens: 10 }
          });
          results.flashModel = !!flashTest.content;
        } catch (error) {
          results.errors.push(`Flash model test failed: ${error.message}`);
        }

        // Test Pro model
        try {
          const proTest = await this._callGeminiAPI('pro', 'Hello', {
            generationConfig: { maxOutputTokens: 10 }
          });
          results.proModel = !!proTest.content;
        } catch (error) {
          results.errors.push(`Pro model test failed: ${error.message}`);
        }
      }

      results.responseTime = Date.now() - startTime;

      return results;
    } catch (error) {
      results.errors.push(`Connectivity test failed: ${error.message}`);
      results.responseTime = Date.now() - startTime;

      return results;
    }
  }

  /**
   * Validate trip data structure
   * @param {Object} trip - Trip object to validate
   * @returns {Object} Validation results
   */
  validateTripData(trip) {
    const issues = [];
    const warnings = [];

    // Required fields
    if (!trip.name || trip.name.trim().length === 0) {
      issues.push({ field: 'name', message: 'Trip name is required' });
    }

    if (!trip.destination) {
      issues.push({ field: 'destination', message: 'Trip destination is required' });
    } else {
      if (!trip.destination.destination || trip.destination.destination.trim().length === 0) {
        issues.push({ field: 'destination.destination', message: 'Destination name is required' });
      }

      if (!trip.destination.startDate) {
        issues.push({ field: 'destination.startDate', message: 'Start date is required' });
      }

      if (!trip.destination.endDate) {
        issues.push({ field: 'destination.endDate', message: 'End date is required' });
      }
    }

    if (!trip.duration || trip.duration < 1) {
      issues.push({ field: 'duration', message: 'Trip duration must be at least 1 day' });
    }

    if (!trip.travelers || trip.travelers.adults < 1) {
      issues.push({ field: 'travelers', message: 'At least 1 adult traveler is required' });
    }

    // Warnings for missing optional data
    if (!trip.budget || !trip.budget.total) {
      warnings.push({ field: 'budget', message: 'No budget specified - cost estimates may be unavailable' });
    }

    if (!trip.preferences || !trip.preferences.interests || trip.preferences.interests.length === 0) {
      warnings.push({ field: 'interests', message: 'No interests specified - recommendations may be generic' });
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validate itinerary structure
   * @param {Object} itinerary - Itinerary to validate
   * @returns {Object} Validation results
   */
  validateItineraryStructure(itinerary) {
    const issues = [];
    const warnings = [];

    if (!itinerary || !itinerary.days || !Array.isArray(itinerary.days)) {
      issues.push({ type: 'structure', message: 'Itinerary must have a days array' });
      return { valid: false, issues, warnings };
    }

    if (itinerary.days.length === 0) {
      issues.push({ type: 'content', message: 'Itinerary has no days' });
      return { valid: false, issues, warnings };
    }

    itinerary.days.forEach((day, dayIndex) => {
      if (!day.date) {
        issues.push({ type: 'date', message: `Day ${dayIndex + 1} missing date`, day: dayIndex });
      }

      if (!day.activities || !Array.isArray(day.activities)) {
        issues.push({ type: 'activities', message: `Day ${dayIndex + 1} missing activities array`, day: dayIndex });
      } else if (day.activities.length === 0) {
        warnings.push({ type: 'empty_day', message: `Day ${dayIndex + 1} has no activities`, day: dayIndex });
      } else {
        day.activities.forEach((activity, activityIndex) => {
          if (!activity.time) {
            issues.push({
              type: 'activity_time',
              message: `Activity ${activityIndex + 1} on day ${dayIndex + 1} missing time`,
              day: dayIndex,
              activity: activityIndex
            });
          }

          if (!activity.title || activity.title.trim().length === 0) {
            issues.push({
              type: 'activity_title',
              message: `Activity ${activityIndex + 1} on day ${dayIndex + 1} missing title`,
              day: dayIndex,
              activity: activityIndex
            });
          }

          if (!activity.location || !activity.location.name) {
            warnings.push({
              type: 'activity_location',
              message: `Activity ${activityIndex + 1} on day ${dayIndex + 1} missing location`,
              day: dayIndex,
              activity: activityIndex
            });
          }
        });
      }
    });

    return {
      valid: issues.length === 0,
      issues,
      warnings,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Log AI interaction
   * @param {Object} logData - Log data
   */
  async _logInteraction(logData) {
    try {
      const log = AIInteractionLog.createLog(logData);
      await log.save();
    } catch (error) {
      console.error('Failed to log AI interaction:', error);
      // Don't throw error to avoid disrupting main flow
    }
  }
}

module.exports = AIValidationService;
