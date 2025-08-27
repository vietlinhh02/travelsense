const { Trip } = require('../../../models/trips');
const AIBaseService = require('../core/aiBase.service');

/**
 * AIItineraryAnalysisService - Handles itinerary analysis and insights
 * Focuses on analyzing trip data and providing insights
 */
class AIItineraryAnalysisService extends AIBaseService {
  constructor() {
    super();
  }

  /**
   * Analyze itinerary and provide insights
   * @param {string} userId - User ID
   * @param {string} tripId - Trip ID
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeItinerary(userId, tripId, options = {}) {
    const { includeRecommendations = true, detailedCategories = true } = options;
    const startTime = Date.now();

    try {
      await this._validateAccess(userId, tripId);

      const trip = await Trip.findById(tripId);
      
      if (!trip.itinerary?.days) {
        throw new Error('NO_ITINERARY_TO_ANALYZE');
      }

      console.log('Analyzing itinerary...');

      // Perform comprehensive analysis
      const analysis = await this._performItineraryAnalysis(trip, {
        includeRecommendations,
        detailedCategories
      });

      const processingTime = Date.now() - startTime;

      return {
        analysis,
        processingTime,
        tripDuration: trip.duration,
        totalActivities: analysis.activityCount,
        analysisDate: new Date().toISOString()
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get trip statistics
   * @param {string} userId - User ID
   * @param {string} tripId - Trip ID
   * @returns {Promise<Object>} Trip statistics
   */
  async getTripStatistics(userId, tripId) {
    try {
      await this._validateAccess(userId, tripId);

      const trip = await Trip.findById(tripId);
      
      if (!trip.itinerary?.days) {
        throw new Error('NO_ITINERARY_TO_ANALYZE');
      }

      return this._calculateTripStatistics(trip);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Generate trip recommendations
   * @param {string} userId - User ID
   * @param {string} tripId - Trip ID
   * @returns {Promise<Object>} Trip recommendations
   */
  async generateRecommendations(userId, tripId) {
    try {
      await this._validateAccess(userId, tripId);

      const trip = await Trip.findById(tripId);
      
      if (!trip.itinerary?.days) {
        throw new Error('NO_ITINERARY_TO_ANALYZE');
      }

      const days = trip.itinerary.days || [];
      return {
        recommendations: this._generateAnalysisRecommendations(days),
        improvements: this._generateImprovementSuggestions(days, trip),
        warnings: this._generateWarnings(days, trip)
      };

    } catch (error) {
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
   * Perform comprehensive itinerary analysis
   * @private
   */
  async _performItineraryAnalysis(trip, options) {
    const days = trip.itinerary.days || [];
    
    const basicStats = this._calculateBasicStats(days);
    const categories = options.detailedCategories ? this._analyzeActivityCategories(days) : {};
    const recommendations = options.includeRecommendations ? this._generateAnalysisRecommendations(days) : [];

    return {
      // Basic statistics
      ...basicStats,

      // Category analysis
      categories,

      // Time distribution analysis
      timeDistribution: this._analyzeTimeDistribution(days),

      // Activity patterns
      activityPatterns: this._analyzeActivityPatterns(days),

      // Trip pacing analysis
      pacingAnalysis: this._analyzeTripPacing(days, trip.duration),

      // Recommendations
      recommendations,

      // Quality score
      qualityScore: this._calculateQualityScore(days, trip)
    };
  }

  /**
   * Calculate basic statistics
   * @private
   */
  _calculateBasicStats(days) {
    const totalActivities = days.reduce((total, day) => total + (day.activities?.length || 0), 0);
    
    return {
      activityCount: totalActivities,
      averageActivitiesPerDay: days.length > 0 ? totalActivities / days.length : 0,
      busyDays: days.filter(day => day.activities?.length > 5).length,
      lightDays: days.filter(day => day.activities?.length < 3).length,
      emptyDays: days.filter(day => !day.activities || day.activities.length === 0).length,
      totalDays: days.length
    };
  }

  /**
   * Calculate trip statistics
   * @private
   */
  _calculateTripStatistics(trip) {
    const days = trip.itinerary.days || [];
    const activities = days.flatMap(day => day.activities || []);

    return {
      trip: {
        duration: trip.duration,
        destination: trip.destination.city,
        startDate: trip.destination.startDate,
        endDate: trip.destination.endDate
      },
      activities: {
        total: activities.length,
        perDay: activities.length / days.length,
        byCategory: this._analyzeActivityCategories(days)
      },
      days: {
        total: days.length,
        busy: days.filter(day => day.activities?.length > 5).length,
        moderate: days.filter(day => day.activities?.length >= 3 && day.activities?.length <= 5).length,
        light: days.filter(day => day.activities?.length > 0 && day.activities?.length < 3).length,
        empty: days.filter(day => !day.activities || day.activities.length === 0).length
      }
    };
  }

  /**
   * Analyze activity categories
   * @private
   */
  _analyzeActivityCategories(days) {
    const categories = {};
    let totalActivities = 0;
    
    days.forEach(day => {
      day.activities?.forEach(activity => {
        const category = activity.category || 'other';
        categories[category] = (categories[category] || 0) + 1;
        totalActivities++;
      });
    });

    // Convert to percentages
    const categoryPercentages = {};
    Object.keys(categories).forEach(category => {
      categoryPercentages[category] = {
        count: categories[category],
        percentage: totalActivities > 0 ? Math.round((categories[category] / totalActivities) * 100) : 0
      };
    });

    return categoryPercentages;
  }

  /**
   * Analyze time distribution
   * @private
   */
  _analyzeTimeDistribution(days) {
    const timeSlots = {
      morning: 0,
      afternoon: 0,
      evening: 0,
      night: 0
    };

    days.forEach(day => {
      day.activities?.forEach(activity => {
        const timeSlot = this._getTimeSlot(activity.time || activity.startTime);
        if (timeSlots[timeSlot] !== undefined) {
          timeSlots[timeSlot]++;
        }
      });
    });

    return timeSlots;
  }

  /**
   * Get time slot from time string
   * @private
   */
  _getTimeSlot(timeString) {
    if (!timeString) return 'morning';
    
    const hour = parseInt(timeString.split(':')[0]) || 9;
    
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon';
    if (hour >= 18 && hour < 22) return 'evening';
    return 'night';
  }

  /**
   * Analyze activity patterns
   * @private
   */
  _analyzeActivityPatterns(days) {
    const patterns = {
      consistentSchedule: this._checkConsistentSchedule(days),
      varietyScore: this._calculateVarietyScore(days),
      restDayDistribution: this._analyzeRestDayDistribution(days)
    };

    return patterns;
  }

  /**
   * Check for consistent schedule patterns
   * @private
   */
  _checkConsistentSchedule(days) {
    const activityCounts = days.map(day => day.activities?.length || 0);
    const mean = activityCounts.reduce((a, b) => a + b, 0) / activityCounts.length;
    const variance = activityCounts.reduce((acc, count) => acc + Math.pow(count - mean, 2), 0) / activityCounts.length;
    
    return {
      isConsistent: variance < 2,
      variance: Math.round(variance * 100) / 100,
      averageActivitiesPerDay: Math.round(mean * 10) / 10
    };
  }

  /**
   * Calculate variety score
   * @private
   */
  _calculateVarietyScore(days) {
    const allCategories = new Set();
    days.forEach(day => {
      day.activities?.forEach(activity => {
        allCategories.add(activity.category || 'other');
      });
    });

    return {
      uniqueCategories: allCategories.size,
      varietyScore: Math.min(100, allCategories.size * 20) // Max 100
    };
  }

  /**
   * Analyze rest day distribution
   * @private
   */
  _analyzeRestDayDistribution(days) {
    const lightDayIndices = [];
    days.forEach((day, index) => {
      if (!day.activities || day.activities.length < 3) {
        lightDayIndices.push(index);
      }
    });

    return {
      restDayCount: lightDayIndices.length,
      restDayIndices: lightDayIndices,
      isWellDistributed: this._checkRestDayDistribution(lightDayIndices, days.length)
    };
  }

  /**
   * Check if rest days are well distributed
   * @private
   */
  _checkRestDayDistribution(restDayIndices, totalDays) {
    if (restDayIndices.length === 0) return false;
    if (totalDays <= 3) return true;

    // Check if rest days are not all clustered together
    const gaps = [];
    for (let i = 1; i < restDayIndices.length; i++) {
      gaps.push(restDayIndices[i] - restDayIndices[i - 1]);
    }

    const averageGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : totalDays;
    return averageGap >= 2; // Rest days should be at least 2 days apart
  }

  /**
   * Analyze trip pacing
   * @private
   */
  _analyzeTripPacing(days, duration) {
    const activityCounts = days.map(day => day.activities?.length || 0);
    const firstHalf = activityCounts.slice(0, Math.ceil(duration / 2));
    const secondHalf = activityCounts.slice(Math.ceil(duration / 2));

    const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    return {
      frontLoaded: firstHalfAvg > secondHalfAvg * 1.2,
      backLoaded: secondHalfAvg > firstHalfAvg * 1.2,
      balanced: Math.abs(firstHalfAvg - secondHalfAvg) < 1,
      firstHalfAverage: Math.round(firstHalfAvg * 10) / 10,
      secondHalfAverage: Math.round(secondHalfAvg * 10) / 10
    };
  }

  /**
   * Generate analysis recommendations
   * @private
   */
  _generateAnalysisRecommendations(days) {
    const recommendations = [];
    
    const totalDays = days.length;
    const busyDays = days.filter(day => day.activities?.length > 5).length;
    const emptyDays = days.filter(day => !day.activities || day.activities.length === 0).length;
    
    if (busyDays > totalDays * 0.6) {
      recommendations.push({
        type: 'pacing',
        priority: 'high',
        message: 'Consider reducing activities on some days to avoid fatigue',
        details: `${busyDays} out of ${totalDays} days are very busy`
      });
    }

    if (totalDays > 3 && !days.some(day => day.activities?.length < 3)) {
      recommendations.push({
        type: 'rest',
        priority: 'medium',
        message: 'Add at least one relaxed day with fewer activities',
        details: 'No light days found in itinerary'
      });
    }

    if (emptyDays > 0) {
      recommendations.push({
        type: 'content',
        priority: 'medium',
        message: `Add activities to ${emptyDays} empty day(s)`,
        details: 'Empty days found in itinerary'
      });
    }

    return recommendations;
  }

  /**
   * Generate improvement suggestions
   * @private
   */
  _generateImprovementSuggestions(days, trip) {
    const suggestions = [];

    // Check for activity variety
    const categories = this._analyzeActivityCategories(days);
    const categoryCount = Object.keys(categories).length;

    if (categoryCount < 3) {
      suggestions.push({
        type: 'variety',
        suggestion: 'Add more diverse activities (cultural, outdoor, food, etc.)',
        impact: 'medium'
      });
    }

    // Check for time distribution
    const timeDistribution = this._analyzeTimeDistribution(days);
    const eveningActivities = timeDistribution.evening + timeDistribution.night;
    const totalActivities = Object.values(timeDistribution).reduce((a, b) => a + b, 0);

    if (totalActivities > 0 && eveningActivities / totalActivities < 0.2) {
      suggestions.push({
        type: 'timing',
        suggestion: 'Consider adding more evening activities for better experience',
        impact: 'low'
      });
    }

    return suggestions;
  }

  /**
   * Generate warnings
   * @private
   */
  _generateWarnings(days, trip) {
    const warnings = [];

    // Check for consecutive busy days
    let consecutiveBusy = 0;
    let maxConsecutiveBusy = 0;

    days.forEach(day => {
      if (day.activities?.length > 6) {
        consecutiveBusy++;
        maxConsecutiveBusy = Math.max(maxConsecutiveBusy, consecutiveBusy);
      } else {
        consecutiveBusy = 0;
      }
    });

    if (maxConsecutiveBusy > 3) {
      warnings.push({
        type: 'fatigue',
        severity: 'high',
        message: `${maxConsecutiveBusy} consecutive very busy days may cause exhaustion`,
        recommendation: 'Add rest periods between busy days'
      });
    }

    return warnings;
  }

  /**
   * Calculate quality score
   * @private
   */
  _calculateQualityScore(days, trip) {
    let score = 100;
    
    // Deduct for empty days
    const emptyDays = days.filter(day => !day.activities || day.activities.length === 0).length;
    score -= emptyDays * 10;

    // Deduct for too many busy days
    const busyDays = days.filter(day => day.activities?.length > 7).length;
    score -= busyDays * 5;

    // Add points for good variety
    const categories = Object.keys(this._analyzeActivityCategories(days)).length;
    score += Math.min(20, categories * 4);

    // Add points for balanced pacing
    const pacing = this._analyzeTripPacing(days, trip.duration);
    if (pacing.balanced) score += 10;

    return Math.max(0, Math.min(100, score));
  }
}

module.exports = AIItineraryAnalysisService;
