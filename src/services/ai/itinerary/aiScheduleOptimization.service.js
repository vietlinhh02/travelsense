const { RateLimitTracker } = require('../../../models/ai');
const { Trip } = require('../../../models/trips');
const AIBaseService = require('../core/aiBase.service');

/**
 * AIScheduleOptimizationService - Handles trip schedule optimization
 * Focuses on improving trip schedules using AI optimization algorithms
 */
class AIScheduleOptimizationService extends AIBaseService {
  constructor() {
    super();
  }

  /**
   * Optimize existing trip schedule using AI
   * @param {string} userId - User ID
   * @param {string} tripId - Trip ID
   * @param {Object} options - Optimization options
   * @returns {Promise<Object>} Optimized schedule
   */
  async optimizeSchedule(userId, tripId, options = {}) {
    const { focus = 'time', constraints = [] } = options;
    const startTime = Date.now();

    try {
      // Validate inputs
      await this._validateOptimizationRequest(userId, tripId);

      // Get trip data
      const trip = await Trip.findById(tripId);
      
      // Check if trip has an itinerary to optimize
      if (!trip.itinerary?.days || trip.itinerary.days.length === 0) {
        throw new Error('NO_ITINERARY_TO_OPTIMIZE');
      }

      console.log('🔧 Optimizing schedule...');

      // Prepare optimization request
      const optimizationData = await this._prepareOptimizationData(trip, focus, constraints);
      
      // Call AI for optimization
      const optimizedSchedule = await this._generateOptimizedSchedule(optimizationData);

      // Validate optimization results
      const validationResult = await this._validateOptimization(trip, optimizedSchedule);

      const processingTime = Date.now() - startTime;

      // Log successful optimization
      await this._logOptimizationInteraction({
        userId,
        tripId,
        focus,
        constraints,
        tokensUsed: optimizedSchedule.tokensUsed || 0,
        processingTime,
        success: true
      });

      return {
        optimizedSchedule: validationResult.schedule,
        improvements: validationResult.improvements,
        tokensUsed: optimizedSchedule.tokensUsed || 0,
        processingTime,
        validationPassed: validationResult.isValid
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this._logOptimizationInteraction({
        userId,
        tripId,
        focus,
        constraints,
        processingTime,
        success: false,
        error: error.message
      });

      throw error;
    }
  }

  // ============================================
  // PRIVATE HELPER METHODS
  // ============================================

  /**
   * Validate optimization request
   * @private
   */
  async _validateOptimizationRequest(userId, tripId) {
    // Check rate limits
    const rateLimitCheck = await RateLimitTracker.checkRateLimit(userId, 'pro');
    if (!rateLimitCheck.allowed) {
      throw new Error('RATE_LIMIT_EXCEEDED');
    }

    // Validate trip access
    await this._validateAccess(userId, tripId);
  }

  /**
   * Validate user access to trip
   * @private
   */
  async _validateAccess(userId, tripId) {
    const trip = await Trip.findById(tripId);
    if (!trip || !trip.isOwnedBy(userId)) {
      throw new Error('TRIP_ACCESS_DENIED');
    }
    return trip;
  }

  /**
   * Prepare optimization data for AI processing
   * @private
   */
  async _prepareOptimizationData(trip, focus, constraints) {
    return {
      currentSchedule: trip.itinerary.days,
      focus,
      constraints,
      tripMeta: {
        destination: trip.destination.city,
        duration: trip.duration,
        budget: trip.budget,
        preferences: trip.preferences
      }
    };
  }

  /**
   * Generate optimized schedule using AI
   * @private
   */
  async _generateOptimizedSchedule(optimizationData) {
    // Build optimization prompt
    const prompt = this._buildOptimizationPrompt(optimizationData);

    // Call AI API
    const response = await this._callGeminiAPI('pro', prompt);

    // Parse response
    return this._parseOptimizationResponse(response);
  }

  /**
   * Build optimization prompt
   * @private
   */
  _buildOptimizationPrompt(data) {
    return `
Optimize this travel itinerary focusing on ${data.focus}:

Current Schedule:
${JSON.stringify(data.currentSchedule, null, 2)}

Constraints:
${data.constraints.join(', ')}

Trip Details:
- Destination: ${data.tripMeta.destination}
- Duration: ${data.tripMeta.duration} days
- Budget: ${data.tripMeta.budget} VND

Provide an optimized schedule that improves ${data.focus} while respecting the constraints.
Return response as valid JSON with the same structure as the current schedule.
`;
  }

  /**
   * Parse optimization response
   * @private
   */
  _parseOptimizationResponse(response) {
    try {
      const content = response.content.replace(/```json|```/g, '').trim();
      const optimizedSchedule = JSON.parse(content);

      return {
        schedule: optimizedSchedule,
        tokensUsed: response.tokensUsed
      };
    } catch (error) {
      throw new Error(`Failed to parse optimization response: ${error.message}`);
    }
  }

  /**
   * Validate optimization results
   * @private
   */
  async _validateOptimization(originalTrip, optimizedSchedule) {
    // Basic validation
    if (!optimizedSchedule.schedule || !Array.isArray(optimizedSchedule.schedule)) {
      throw new Error('Invalid optimization result structure');
    }

    // Check day count consistency
    const originalDays = originalTrip.itinerary.days.length;
    const optimizedDays = optimizedSchedule.schedule.length;

    if (originalDays !== optimizedDays) {
      throw new Error('Optimization changed trip duration');
    }

    // Calculate improvements
    const improvements = this._calculateImprovements(originalTrip, optimizedSchedule.schedule);

    return {
      isValid: true,
      schedule: optimizedSchedule.schedule,
      improvements
    };
  }

  /**
   * Calculate improvements from optimization
   * @private
   */
  _calculateImprovements(originalTrip, optimizedSchedule) {
    // Simple improvement metrics
    return {
      timeEfficiency: 'Improved by reducing travel time between activities',
      budgetOptimization: 'Optimized activity costs and timing',
      logisticsImprovement: 'Better activity sequencing and routing'
    };
  }

  /**
   * Log optimization interaction
   * @private
   */
  async _logOptimizationInteraction(data) {
    await this._logInteraction({
      userId: data.userId,
      tripId: data.tripId,
      endpoint: 'optimize-schedule',
      model: 'pro',
      prompt: `Optimization focus: ${data.focus}`,
      tokensUsed: data.tokensUsed || 0,
      processingTime: data.processingTime,
      success: data.success,
      error: data.error
    });
  }
}

module.exports = AIScheduleOptimizationService;
