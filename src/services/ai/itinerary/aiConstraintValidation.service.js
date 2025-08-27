const { Trip } = require('../../../models/trips');
const AIBaseService = require('../core/aiBase.service');

/**
 * AIConstraintValidationService - Handles trip constraint validation
 * Focuses on validating trip feasibility and constraints
 */
class AIConstraintValidationService extends AIBaseService {
  constructor() {
    super();
  }

  /**
   * Validate trip constraints and feasibility
   * @param {string} userId - User ID
   * @param {string} tripId - Trip ID
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation results
   */
  async validateConstraints(userId, tripId, options = {}) {
    const { checkType = 'all', strictMode = false } = options;
    const startTime = Date.now();

    try {
      // Validate access
      await this._validateAccess(userId, tripId);

      // Get trip data
      const trip = await Trip.findById(tripId);

      console.log('Validating trip constraints...');

      // Perform validation checks
      const validationResults = await this._performConstraintValidation(trip, checkType, strictMode);

      const processingTime = Date.now() - startTime;

      // Log validation
      await this._logValidationInteraction({
        userId,
        tripId,
        checkType,
        strictMode,
        processingTime,
        success: true,
        issuesFound: validationResults.issues.length
      });

      return {
        isValid: validationResults.isValid,
        issues: validationResults.issues,
        suggestions: validationResults.suggestions,
        score: validationResults.score,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this._logValidationInteraction({
        userId,
        tripId,
        checkType,
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
   * Perform constraint validation
   * @private
   */
  async _performConstraintValidation(trip, checkType, strictMode) {
    const issues = [];
    const suggestions = [];
    let score = 100;

    // Budget validation
    if (checkType === 'all' || checkType === 'budget') {
      const budgetIssues = this._validateBudget(trip);
      issues.push(...budgetIssues);
    }

    // Time validation
    if (checkType === 'all' || checkType === 'time') {
      const timeIssues = this._validateTiming(trip);
      issues.push(...timeIssues);
    }

    // Logistics validation
    if (checkType === 'all' || checkType === 'logistics') {
      const logisticsIssues = this._validateLogistics(trip);
      issues.push(...logisticsIssues);
    }

    // Generate suggestions based on issues
    if (issues.length > 0) {
      suggestions.push(...this._generateValidationSuggestions(issues, strictMode));
    }

    // Calculate score
    score = Math.max(0, score - (issues.length * 10));

    return {
      isValid: issues.length === 0,
      issues,
      suggestions,
      score
    };
  }

  /**
   * Validate budget constraints
   * @private
   */
  _validateBudget(trip) {
    const issues = [];
    
    if (trip.budget && trip.budget.total) {
      // Basic budget validation logic
      const estimatedCost = this._estimateTripCost(trip);
      if (estimatedCost > trip.budget.total * 1.2) {
        issues.push({
          type: 'budget',
          severity: 'high',
          message: 'Trip cost may exceed budget by more than 20%',
          estimatedCost,
          budgetLimit: trip.budget.total
        });
      } else if (estimatedCost > trip.budget.total) {
        issues.push({
          type: 'budget',
          severity: 'medium',
          message: 'Trip cost may slightly exceed budget',
          estimatedCost,
          budgetLimit: trip.budget.total
        });
      }
    }

    return issues;
  }

  /**
   * Validate timing constraints
   * @private
   */
  _validateTiming(trip) {
    const issues = [];

    if (trip.itinerary?.days) {
      trip.itinerary.days.forEach((day, index) => {
        if (day.activities?.length > 8) {
          issues.push({
            type: 'time',
            severity: 'medium',
            message: `Day ${index + 1} has too many activities (${day.activities.length})`,
            dayIndex: index,
            activityCount: day.activities.length
          });
        } else if (day.activities?.length < 1) {
          issues.push({
            type: 'time',
            severity: 'low',
            message: `Day ${index + 1} has no activities planned`,
            dayIndex: index,
            activityCount: 0
          });
        }
      });
    }

    return issues;
  }

  /**
   * Validate logistics constraints
   * @private
   */
  _validateLogistics(trip) {
    const issues = [];
    
    // Basic logistics validation
    if (trip.itinerary?.days) {
      // Check for reasonable activity distribution
      const totalActivities = trip.itinerary.days.reduce((total, day) => total + (day.activities?.length || 0), 0);
      const avgActivitiesPerDay = totalActivities / trip.duration;
      
      if (avgActivitiesPerDay > 6) {
        issues.push({
          type: 'logistics',
          severity: 'medium',
          message: 'High activity density may cause fatigue',
          avgActivitiesPerDay: Math.round(avgActivitiesPerDay * 10) / 10
        });
      }

      // Check for consecutive busy days
      let consecutiveBusyDays = 0;
      let maxConsecutiveBusy = 0;

      trip.itinerary.days.forEach(day => {
        if (day.activities?.length > 5) {
          consecutiveBusyDays++;
          maxConsecutiveBusy = Math.max(maxConsecutiveBusy, consecutiveBusyDays);
        } else {
          consecutiveBusyDays = 0;
        }
      });

      if (maxConsecutiveBusy > 3) {
        issues.push({
          type: 'logistics',
          severity: 'medium',
          message: `${maxConsecutiveBusy} consecutive busy days may cause exhaustion`,
          consecutiveBusyDays: maxConsecutiveBusy
        });
      }
    }

    return issues;
  }

  /**
   * Generate validation suggestions
   * @private
   */
  _generateValidationSuggestions(issues, strictMode) {
    const suggestions = [];

    // Group issues by type
    const issuesByType = issues.reduce((acc, issue) => {
      if (!acc[issue.type]) acc[issue.type] = [];
      acc[issue.type].push(issue);
      return acc;
    }, {});

    // Generate budget suggestions
    if (issuesByType.budget) {
      suggestions.push({
        type: 'budget',
        suggestion: 'Consider reducing accommodation costs or number of paid activities',
        priority: 'high'
      });
    }

    // Generate time suggestions
    if (issuesByType.time) {
      const busyDays = issuesByType.time.filter(i => i.activityCount > 8);
      const emptyDays = issuesByType.time.filter(i => i.activityCount === 0);

      if (busyDays.length > 0) {
        suggestions.push({
          type: 'time',
          suggestion: 'Redistribute activities from busy days to lighter days',
          priority: 'medium'
        });
      }

      if (emptyDays.length > 0) {
        suggestions.push({
          type: 'time',
          suggestion: 'Add activities to empty days for better trip experience',
          priority: 'low'
        });
      }
    }

    // Generate logistics suggestions
    if (issuesByType.logistics) {
      suggestions.push({
        type: 'logistics',
        suggestion: 'Add rest days between busy periods to prevent fatigue',
        priority: 'medium'
      });
    }

    return suggestions;
  }

  /**
   * Estimate trip cost
   * @private
   */
  _estimateTripCost(trip) {
    // Basic cost estimation logic
    const baseCostPerDay = 1000000; // 1M VND per day
    let estimatedCost = trip.duration * baseCostPerDay;

    // Adjust based on activities
    if (trip.itinerary?.days) {
      const totalActivities = trip.itinerary.days.reduce((total, day) => total + (day.activities?.length || 0), 0);
      estimatedCost += totalActivities * 200000; // 200K VND per activity
    }

    return estimatedCost;
  }

  /**
   * Log validation interaction
   * @private
   */
  async _logValidationInteraction(data) {
    await this._logInteraction({
      userId: data.userId,
      tripId: data.tripId,
      endpoint: 'validate-constraints',
      model: 'pro',
      prompt: `Validation type: ${data.checkType}`,
      tokensUsed: 0,
      processingTime: data.processingTime,
      success: data.success,
      error: data.error,
      metadata: {
        issuesFound: data.issuesFound || 0,
        strictMode: data.strictMode
      }
    });
  }
}

module.exports = AIConstraintValidationService;
