/**
 * TokenEstimationService - Handles sophisticated token usage estimation
 * Focuses on calculating token requirements for different trip scenarios
 */
class TokenEstimationService {
  constructor() {
    // Token estimation constants
    this.constants = {
      baseTokensPerDay: {
        comprehensive: 400, // High detail with descriptions, tips, logistics
        balanced: 280,      // Moderate detail with good descriptions
        simplified: 180     // Basic detail, essential info only
      },
      activitiesPerDay: {
        comprehensive: 4.5, // More activities, more detail
        balanced: 3.5,      // Standard activities
        simplified: 2.5     // Fewer, simpler activities
      },
      tokensPerActivity: {
        comprehensive: 120, // Detailed descriptions, tips, logistics
        balanced: 85,       // Good descriptions
        simplified: 50      // Basic descriptions
      }
    };
  }

  /**
   * Estimate token usage for multiple chunks
   * @param {Array} chunks - Array of chunks
   * @param {Object} trip - Trip object for context
   * @returns {number} Estimated total tokens
   */
  estimateForChunks(chunks, trip = null) {
    return chunks.reduce((total, chunk) => {
      const chunkTokens = this.estimateChunkTokenUsage(chunk, trip);
      return total + chunkTokens;
    }, 0);
  }

  /**
   * Estimate token usage for a specific chunk
   * @param {Object} chunk - Chunk configuration
   * @param {Object} trip - Trip object for context
   * @returns {number} Estimated tokens for chunk
   */
  estimateChunkTokenUsage(chunk, trip = null) {
    const chunkDuration = chunk.endDay - chunk.startDay + 1;
    
    // Get base values for detail level
    const baseTokensPerDay = this.constants.baseTokensPerDay[chunk.detailLevel] || 280;
    const activitiesPerDay = this.constants.activitiesPerDay[chunk.detailLevel] || 3.5;
    const tokensPerActivity = this.constants.tokensPerActivity[chunk.detailLevel] || 85;
    
    // Apply complexity multipliers
    const focusComplexity = this._getFocusComplexity(chunk.focus);
    const destinationComplexity = this._getDestinationComplexity(trip?.destination?.destination);
    
    // Context overhead for continuation chunks
    const contextOverhead = chunk.id.startsWith('middle_') ? 50 : 0;
    
    // Calculate total tokens for chunk
    const chunkTokens = chunkDuration * (
      baseTokensPerDay + 
      (activitiesPerDay * tokensPerActivity * focusComplexity * destinationComplexity)
    ) + contextOverhead;
    
    return Math.round(chunkTokens);
  }

  /**
   * Estimate tokens for a standard (non-chunked) trip
   * @param {Object} trip - Trip object
   * @param {Object} options - Options for estimation
   * @returns {number} Estimated tokens
   */
  estimateStandardTrip(trip, options = {}) {
    const duration = trip.duration;
    const detailLevel = options.detailLevel || 'balanced';
    
    const baseTokensPerDay = this.constants.baseTokensPerDay[detailLevel] || 280;
    const activitiesPerDay = this.constants.activitiesPerDay[detailLevel] || 3.5;
    const tokensPerActivity = this.constants.tokensPerActivity[detailLevel] || 85;
    
    const complexityMultiplier = this._getDestinationComplexity(trip?.destination?.destination);
    
    const estimatedTokens = duration * (
      baseTokensPerDay + 
      (activitiesPerDay * tokensPerActivity * complexityMultiplier)
    );
    
    return Math.round(estimatedTokens);
  }

  /**
   * Get complexity multiplier based on focus type
   * @param {string} focus - Chunk focus
   * @returns {number} Complexity multiplier
   */
  _getFocusComplexity(focus) {
    const complexityMap = {
      'arrival_orientation': 1.3,    // High complexity: logistics, orientation
      'cultural_immersion': 1.2,     // High complexity: detailed cultural context
      'food_discovery': 1.1,         // Medium-high: restaurant details, cuisine info
      'historical_sites': 1.2,       // High complexity: historical context
      'nature_exploration': 1.0,     // Medium complexity: location descriptions
      'local_experiences': 1.1,      // Medium-high: local context needed
      'entertainment_leisure': 0.9,  // Lower complexity: straightforward activities
      'nightlife_entertainment': 1.0, // Medium complexity: venue details, timing, safety
      'departure_logistics': 0.8     // Lower complexity: simple logistics
    };

    return complexityMap[focus] || 1.0;
  }

  /**
   * Get complexity multiplier based on destination
   * @param {string} destination - Destination name
   * @returns {number} Complexity multiplier
   */
  _getDestinationComplexity(destination) {
    if (!destination) return 1.0;
    
    const destLower = destination.toLowerCase();
    
    // Multi-city or multi-country (highest complexity)
    if (destLower.includes('multi') || destLower.includes('tour') ||
        destLower.includes('several') || destLower.includes('various')) {
      return 1.4;
    }
    
    // High complexity destinations (need more context, cultural explanation)
    if (destLower.includes('japan') || destLower.includes('tokyo') || 
        destLower.includes('kyoto') || destLower.includes('china') ||
        destLower.includes('india') || destLower.includes('morocco')) {
      return 1.3;
    }
    
    // Medium-high complexity (unique culture, language barriers)
    if (destLower.includes('vietnam') || destLower.includes('thailand') ||
        destLower.includes('korea') || destLower.includes('russia') ||
        destLower.includes('middle east') || destLower.includes('arabia')) {
      return 1.2;
    }
    
    // Medium complexity (some cultural context needed)
    if (destLower.includes('europe') || destLower.includes('italy') ||
        destLower.includes('france') || destLower.includes('spain') ||
        destLower.includes('germany') || destLower.includes('brazil')) {
      return 1.1;
    }
    
    // Default complexity for familiar destinations
    return 1.0;
  }

  /**
   * Calculate token budget for API calls
   * @param {number} estimatedTokens - Estimated token usage
   * @param {number} safetyMargin - Safety margin percentage (default 20%)
   * @returns {Object} Token budget information
   */
  calculateTokenBudget(estimatedTokens, safetyMargin = 0.2) {
    const budgetWithMargin = Math.round(estimatedTokens * (1 + safetyMargin));
    
    return {
      estimated: estimatedTokens,
      budgetWithMargin,
      safetyMargin: Math.round(estimatedTokens * safetyMargin),
      recommendedModel: estimatedTokens > 4000 ? 'pro' : 'flash',
      chunks: estimatedTokens > 6000 ? Math.ceil(estimatedTokens / 4000) : 1
    };
  }

  /**
   * Analyze token efficiency for different approaches
   * @param {Object} trip - Trip object
   * @returns {Object} Analysis of different approaches
   */
  analyzeTokenEfficiency(trip) {
    const duration = trip.duration;
    
    // Standard approach
    const standardTokens = this.estimateStandardTrip(trip, { detailLevel: 'balanced' });
    
    // Chunked approach
    const chunkingService = require('./tripChunking.service');
    const chunker = new chunkingService();
    const analysis = chunker.analyzeTrip(trip);
    const chunkedTokens = analysis.needsChunking ? analysis.estimatedTokens : standardTokens;
    
    // Simplified approach
    const simplifiedTokens = this.estimateStandardTrip(trip, { detailLevel: 'simplified' });
    
    return {
      standard: {
        tokens: standardTokens,
        approach: 'single_call',
        quality: 'high',
        riskLevel: standardTokens > 6000 ? 'high' : 'low'
      },
      chunked: {
        tokens: chunkedTokens,
        approach: 'chunked',
        quality: 'high',
        riskLevel: 'low',
        chunks: analysis.chunks?.length || 1
      },
      simplified: {
        tokens: simplifiedTokens,
        approach: 'simplified',
        quality: 'medium',
        riskLevel: 'low'
      },
      recommendation: this._getRecommendedApproach(standardTokens, chunkedTokens, simplifiedTokens, duration)
    };
  }

  /**
   * Get recommended approach based on token analysis
   * @param {number} standardTokens - Standard approach tokens
   * @param {number} chunkedTokens - Chunked approach tokens
   * @param {number} simplifiedTokens - Simplified approach tokens
   * @param {number} duration - Trip duration
   * @returns {string} Recommended approach
   */
  _getRecommendedApproach(standardTokens, chunkedTokens, simplifiedTokens, duration) {
    // For short trips, use standard approach
    if (duration <= 4) {
      return standardTokens > 6000 ? 'simplified' : 'standard';
    }
    
    // For medium trips, compare efficiency
    if (duration <= 7) {
      return standardTokens > 5000 ? 'chunked' : 'standard';
    }
    
    // For long trips, always use chunked approach
    return 'chunked';
  }

  /**
   * Get token estimation constants (for external configuration)
   * @returns {Object} Current constants
   */
  getConstants() {
    return { ...this.constants };
  }

  /**
   * Update token estimation constants
   * @param {Object} newConstants - New constants
   */
  updateConstants(newConstants) {
    this.constants = { ...this.constants, ...newConstants };
  }
}

module.exports = TokenEstimationService;
