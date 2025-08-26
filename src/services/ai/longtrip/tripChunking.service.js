/**
 * TripChunkingService - Handles trip segmentation and chunking strategies
 * Focuses on analyzing trips and creating optimal chunks for processing
 */
class TripChunkingService {
  constructor() {
    // Configuration for trip segmentation
    this.config = {
      maxDaysPerChunk: 7,        // Maximum days per AI generation chunk
      minDaysForChunking: 5,    // Minimum trip duration to trigger chunking
      maxTokensPerPrompt: 6000,  // Safe token limit per prompt
      overlapDays: 2,            // Days of overlap between chunks for continuity
      prioritySegments: {
        arrival: 2,              // First 2 days get detailed treatment
        departure: 1,            // Last day gets simpler treatment
        middle: 6              // Middle chunks of 5 days each
      }
    };
  }

  /**
   * Determine if trip needs chunking and create segmentation strategy
   * @param {Object} trip - Trip object
   * @param {Object} options - Additional options including preferences
   * @returns {Object} Segmentation strategy
   */
  analyzeTrip(trip, options = {}) {
    const duration = trip.duration;
    const preferences = options.preferences || trip.preferences || {};

    if (duration < this.config.minDaysForChunking) {
      return {
        needsChunking: false,
        strategy: 'single_generation',
        chunks: [{ startDay: 1, endDay: duration, priority: 'normal' }]
      };
    }

    return {
      needsChunking: true,
      strategy: 'progressive_chunking',
      chunks: this._createChunks(duration, preferences),
      estimatedTokens: this._estimateTokenUsage(duration, this._createChunks(duration, preferences), trip)
    };
  }

  /**
   * Create smart chunks for long trips with preferences support
   * @param {number} duration - Trip duration in days
   * @param {Object} preferences - User preferences for focus determination
   * @returns {Array} Array of chunk objects
   */
  _createChunks(duration, preferences = {}) {
    const chunks = [];

    // Arrival chunk (first few days) - high detail
    chunks.push({
      id: 'arrival',
      startDay: 1,
      endDay: Math.min(this.config.prioritySegments.arrival, duration),
      priority: 'high',
      focus: 'arrival_orientation',
      detailLevel: 'comprehensive'
    });

    // Adjust chunk size based on pace preference
    let chunkSize = this.config.prioritySegments.middle;
    if (preferences.pace === 'easy') {
      chunkSize = Math.floor(chunkSize * 0.8); // Smaller chunks for relaxed pace
    } else if (preferences.pace === 'intense') {
      chunkSize = Math.ceil(chunkSize * 1.2); // Larger chunks for intense pace
    }

    // Middle chunks - balanced detail
    let currentDay = this.config.prioritySegments.arrival + 1;
    let chunkIndex = 1;

    while (currentDay <= duration - this.config.prioritySegments.departure) {
      const endDay = Math.min(
        currentDay + chunkSize - 1,
        duration - this.config.prioritySegments.departure
      );

      if (currentDay <= endDay) {
        chunks.push({
          id: `middle_${chunkIndex}`,
          startDay: currentDay,
          endDay: endDay,
          priority: 'normal',
          focus: this._determineChunkFocus(chunkIndex, duration, preferences),
          detailLevel: 'balanced'
        });

        currentDay = endDay + 1;
        chunkIndex++;
      } else {
        break;
      }
    }

    // Departure chunk (last day) - simplified
    if (duration > this.config.prioritySegments.arrival) {
      chunks.push({
        id: 'departure',
        startDay: duration,
        endDay: duration,
        priority: 'low',
        focus: 'departure_logistics',
        detailLevel: 'simplified'
      });
    }

    return chunks;
  }

  /**
   * Determine focus theme for middle chunks to maintain variety with nightlife support
   * @param {number} chunkIndex - Chunk index
   * @param {number} totalDuration - Total trip duration
   * @param {Object} preferences - User preferences including nightlife
   * @returns {string} Focus theme
   */
  _determineChunkFocus(chunkIndex, totalDuration, preferences = {}) {
    const baseThemes = [
      'cultural_immersion',
      'local_experiences',
      'nature_exploration',
      'food_discovery',
      'historical_sites',
      'entertainment_leisure'
    ];

    // Add nightlife focus if user prefers nightlife and we're in weekend chunks
    if (preferences.nightlife && preferences.nightlife !== 'none') {
      const isWeekendChunk = this._isWeekendChunk(chunkIndex, totalDuration);
      if (isWeekendChunk || preferences.nightlife === 'heavy') {
        // Insert nightlife focus for weekend or heavy nightlife preference
        baseThemes.splice(2, 0, 'nightlife_entertainment');
      }
    }

    // Consider pace preference
    if (preferences.pace === 'easy') {
      // For easy pace, prefer more relaxed themes
      const relaxedThemes = ['nature_exploration', 'cultural_immersion', 'local_experiences'];
      return relaxedThemes[chunkIndex % relaxedThemes.length];
    } else if (preferences.pace === 'intense') {
      // For intense pace, prefer more varied and active themes
      const activeThemes = ['cultural_immersion', 'food_discovery', 'entertainment_leisure'];
      if (preferences.nightlife === 'heavy') {
        activeThemes.push('nightlife_entertainment');
      }
      return activeThemes[chunkIndex % activeThemes.length];
    }

    return baseThemes[chunkIndex % baseThemes.length];
  }

  /**
   * Check if chunk corresponds to weekend days
   * @param {number} chunkIndex - Chunk index
   * @param {number} totalDuration - Total trip duration
   * @returns {boolean} True if weekend chunk
   */
  _isWeekendChunk(chunkIndex, totalDuration) {
    // Simple heuristic: chunks 1 and 3 in a week-long trip are likely weekends
    // This is a basic implementation - could be enhanced with actual dates
    return chunkIndex === 1 || (chunkIndex === 3 && totalDuration >= 7);
  }

  /**
   * Calculate start date for a specific chunk
   * @param {Date} tripStartDate - Original trip start date
   * @param {number} chunkStartDay - Chunk start day (1-based)
   * @returns {Date} Chunk start date
   */
  calculateChunkStartDate(tripStartDate, chunkStartDay) {
    const chunkDate = new Date(tripStartDate);
    chunkDate.setDate(chunkDate.getDate() + chunkStartDay - 1);
    return chunkDate;
  }

  /**
   * Calculate appropriate token limit for chunk based on detail level
   * @param {Object} chunk - Chunk configuration
   * @returns {number} Max tokens for chunk
   */
  calculateMaxTokensForChunk(chunk) {
    const baseTokens = 2000;
    const multipliers = {
      'comprehensive': 1.5,
      'balanced': 1.0,
      'simplified': 0.7
    };
    
    return Math.floor(baseTokens * (multipliers[chunk.detailLevel] || 1.0));
  }

  /**
   * Estimate total token usage for long trip
   * @param {number} duration - Trip duration
   * @param {Array} chunks - Array of chunks (optional, for more accurate estimation)
   * @param {Object} trip - Trip object for context (optional)
   * @returns {number} Estimated tokens
   */
  _estimateTokenUsage(duration, chunks = null, trip = null) {
    if (chunks) {
      const tokenEstimatorService = require('./tokenEstimation.service');
      const estimator = new tokenEstimatorService();
      return estimator.estimateForChunks(chunks, trip);
    }
    
    // Fallback to basic estimation
    const baseTokensPerDay = 250;
    const averageActivitiesPerDay = 3.5;
    const tokensPerActivity = 80;
    
    return Math.round(duration * (baseTokensPerDay + (averageActivitiesPerDay * tokensPerActivity)));
  }

  /**
   * Get configuration for testing/adjustment
   * @returns {Object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration values
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}

module.exports = TripChunkingService;
