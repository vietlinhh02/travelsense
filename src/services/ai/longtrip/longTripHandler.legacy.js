
/**
 * LongTripHandler - Handles very long trip durations with smart segmentation
 * Responsible for: Trip chunking, progressive generation, token optimization, detail preservation
 */
class LongTripHandler {
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
   * Generate itinerary using chunked approach
   * @param {Object} trip - Trip object
   * @param {Object} aiServices - AI service dependencies
   * @returns {Promise<Object>} Complete itinerary
   */
  async generateChunkedItinerary(trip, aiServices) {
    const analysis = this.analyzeTrip(trip);
    
    if (!analysis.needsChunking) {
      // Use standard generation for short trips
      return await aiServices.generateStandardItinerary(trip);
    }

    console.log(` Generating long trip itinerary in ${analysis.chunks.length} chunks`);
    
    const allDays = [];
    const generationContext = {
      previousDays: [],
      overallTheme: trip.preferences?.interests?.[0] || 'sightseeing',
      budget: trip.budget,
      constraints: trip.preferences?.constraints || []
    };

    // Generate each chunk sequentially for context continuity
    for (const chunk of analysis.chunks) {
      try {
        console.log(` Generating chunk: ${chunk.id} (Days ${chunk.startDay}-${chunk.endDay})`);
        
        const chunkItinerary = await this._generateChunkItinerary(
          trip,
          chunk,
          generationContext,
          aiServices
        );
        
        allDays.push(...chunkItinerary.days);
        
        // Update context for next chunk
        generationContext.previousDays = allDays.slice(-this.config.overlapDays);
        
        // Add delay between chunks to respect API rate limits
        await this._delay(1000);
        
      } catch (error) {
        console.warn(`Chunk ${chunk.id} generation failed, using fallback:`, error.message);
        
        // Generate fallback days for this chunk
        const fallbackDays = this._generateFallbackDays(trip, chunk);
        allDays.push(...fallbackDays);
      }
    }

    console.log(`Long trip generation completed with ${allDays.length} days generated`);
    return { days: allDays.slice(0, trip.duration) };
  }

  /**
   * Generate itinerary for a specific chunk
   * @param {Object} trip - Trip object
   * @param {Object} chunk - Chunk configuration
   * @param {Object} context - Generation context
   * @param {Object} aiServices - AI service dependencies
   * @returns {Promise<Object>} Chunk itinerary
   */
  async _generateChunkItinerary(trip, chunk, context, aiServices) {
    // Create a modified trip object for this chunk
    const chunkTrip = {
      ...trip,
      duration: chunk.endDay - chunk.startDay + 1,
      destination: {
        ...trip.destination,
        startDate: this._calculateChunkStartDate(trip.destination.startDate, chunk.startDay)
      },
      chunkInfo: {
        id: chunk.id,
        focus: chunk.focus,
        detailLevel: chunk.detailLevel,
        dayRange: `${chunk.startDay}-${chunk.endDay}`,
        context: context.previousDays.length > 0 ? 'continuation' : 'beginning'
      }
    };

    // Generate optimized prompt for this chunk
    const prompt = aiServices.promptBuilder.buildChunkedItineraryPrompt(
      chunkTrip,
      chunk,
      context
    );

    // Call AI service with chunk-specific parameters
    const response = await aiServices.geminiClient.callGeminiAPI(
      'flash', // Use faster model for chunks
      prompt,
      {
        generationConfig: {
          maxOutputTokens: this._calculateMaxTokensForChunk(chunk),
          temperature: chunk.priority === 'high' ? 0.7 : 0.8 // More creativity for middle chunks
        }
      }
    );

    // Parse response with chunk context
    return aiServices.responseParser.processChunkedItineraryResponse(
      response.content,
      chunkTrip,
      chunk
    );
  }

  /**
   * Calculate appropriate token limit for chunk based on detail level
   * @param {Object} chunk - Chunk configuration
   * @returns {number} Max tokens for chunk
   */
  _calculateMaxTokensForChunk(chunk) {
    const baseTokens = 2000;
    const multipliers = {
      'comprehensive': 1.5,
      'balanced': 1.0,
      'simplified': 0.7
    };
    
    return Math.floor(baseTokens * (multipliers[chunk.detailLevel] || 1.0));
  }

  /**
   * Calculate start date for a specific chunk
   * @param {Date} tripStartDate - Original trip start date
   * @param {number} chunkStartDay - Chunk start day (1-based)
   * @returns {Date} Chunk start date
   */
  _calculateChunkStartDate(tripStartDate, chunkStartDay) {
    const chunkDate = new Date(tripStartDate);
    chunkDate.setDate(chunkDate.getDate() + chunkStartDay - 1);
    return chunkDate;
  }

  /**
   * Generate fallback days when AI generation fails
   * @param {Object} trip - Trip object
   * @param {Object} chunk - Chunk configuration
   * @returns {Array} Fallback days
   */
  _generateFallbackDays(trip, chunk) {
    const days = [];
    const startDate = this._calculateChunkStartDate(trip.destination.startDate, chunk.startDay);
    
    for (let i = 0; i < (chunk.endDay - chunk.startDay + 1); i++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(dayDate.getDate() + i);
      
      days.push({
        date: dayDate,
        activities: [{
          time: '09:00',
          title: `Day ${chunk.startDay + i} - Flexible Exploration`,
          description: `Open day for personal exploration and spontaneous discoveries in ${trip.destination.destination}`,
          location: {
            name: 'Local Area',
            address: trip.destination.destination,
            coordinates: this._generateCoordinates(trip.destination.destination)
          },
          duration: 480, // Full day
          cost: 0,
          category: 'leisure',
          notes: `Fallback activity for chunk ${chunk.id}`
        }]
      });
    }
    
    return days;
  }

  /**
   * Estimate total token usage for long trip with sophisticated calculation
   * @param {number} duration - Trip duration
   * @param {Array} chunks - Array of chunks (optional, for more accurate estimation)
   * @param {Object} trip - Trip object for context (optional)
   * @returns {number} Estimated tokens
   */
  _estimateTokenUsage(duration, chunks = null, trip = null) {
    if (chunks) {
      // Detailed estimation based on actual chunks
      return chunks.reduce((total, chunk) => {
        const chunkTokens = this._estimateChunkTokenUsage(chunk, trip);
        return total + chunkTokens;
      }, 0);
    }
    
    // Fallback to improved general estimation
    const baseTokensPerDay = 250; // Base tokens for simple day
    const complexityMultiplier = this._getDestinationComplexity(trip?.destination?.destination);
    const averageActivitiesPerDay = 3.5;
    const tokensPerActivity = 80;
    
    const estimatedTokens = duration * (
      baseTokensPerDay + 
      (averageActivitiesPerDay * tokensPerActivity * complexityMultiplier)
    );
    
    return Math.round(estimatedTokens);
  }

  /**
   * Estimate token usage for a specific chunk
   * @param {Object} chunk - Chunk configuration
   * @param {Object} trip - Trip object for context
   * @returns {number} Estimated tokens for chunk
   */
  _estimateChunkTokenUsage(chunk, trip = null) {
    const chunkDuration = chunk.endDay - chunk.startDay + 1;
    
    // Base tokens per day by detail level
    const baseTokensByDetailLevel = {
      'comprehensive': 400, // High detail with descriptions, tips, logistics
      'balanced': 280,      // Moderate detail with good descriptions
      'simplified': 180     // Basic detail, essential info only
    };
    
    const baseTokensPerDay = baseTokensByDetailLevel[chunk.detailLevel] || 280;
    
    // Activities per day by detail level
    const activitiesPerDayByLevel = {
      'comprehensive': 4.5, // More activities, more detail
      'balanced': 3.5,      // Standard activities
      'simplified': 2.5     // Fewer, simpler activities
    };
    
    const activitiesPerDay = activitiesPerDayByLevel[chunk.detailLevel] || 3.5;
    
    // Tokens per activity by detail level
    const tokensPerActivityByLevel = {
      'comprehensive': 120, // Detailed descriptions, tips, logistics
      'balanced': 85,       // Good descriptions
      'simplified': 50      // Basic descriptions
    };
    
    const tokensPerActivity = tokensPerActivityByLevel[chunk.detailLevel] || 85;
    
    // Focus complexity multiplier
    const focusComplexity = this._getFocusComplexity(chunk.focus);
    
    // Destination complexity multiplier
    const destinationComplexity = this._getDestinationComplexity(trip?.destination?.destination);
    
    // Context overhead (for continuation chunks)
    const contextOverhead = chunk.id.startsWith('middle_') ? 50 : 0;
    
    // Calculate total tokens for chunk
    const chunkTokens = chunkDuration * (
      baseTokensPerDay + 
      (activitiesPerDay * tokensPerActivity * focusComplexity * destinationComplexity)
    ) + contextOverhead;
    
    return Math.round(chunkTokens);
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
   * Generate coordinates for location
   * @param {string} destination - Destination name
   * @returns {Object} Coordinates
   */
  _generateCoordinates(destination) {
    const coords = {
      'tokyo': { lat: 35.6762, lng: 139.6503 },
      'saigon': { lat: 10.7769, lng: 106.7009 },
      'ho chi minh': { lat: 10.7769, lng: 106.7009 },
      'vietnam': { lat: 10.7769, lng: 106.7009 }
    };
    
    const destLower = destination.toLowerCase();
    for (const [key, value] of Object.entries(coords)) {
      if (destLower.includes(key)) {
        return { 
          lat: value.lat + (Math.random() - 0.5) * 0.01, 
          lng: value.lng + (Math.random() - 0.5) * 0.01 
        };
      }
    }
    
    return { lat: 0, lng: 0 };
  }

  /**
   * Add delay between API calls
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise} Promise that resolves after delay
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get configuration for testing/adjustment
   * @returns {Object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }


}

module.exports = LongTripHandler;