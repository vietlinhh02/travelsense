/**
 * LongTripHandler - Handles very long trip durations with smart segmentation
 * Responsible for: Trip chunking, progressive generation, token optimization, detail preservation
 */
class LongTripHandler {
  constructor() {
    // Configuration for trip segmentation
    this.config = {
      maxDaysPerChunk: 7,        // Maximum days per AI generation chunk
      minDaysForChunking: 10,    // Minimum trip duration to trigger chunking
      maxTokensPerPrompt: 6000,  // Safe token limit per prompt
      overlapDays: 1,            // Days of overlap between chunks for continuity
      prioritySegments: {
        arrival: 2,              // First 2 days get detailed treatment
        departure: 1,            // Last day gets simpler treatment
        middle: 5                // Middle chunks of 5 days each
      }
    };
  }

  /**
   * Determine if trip needs chunking and create segmentation strategy
   * @param {Object} trip - Trip object
   * @returns {Object} Segmentation strategy
   */
  analyzeTrip(trip) {
    const duration = trip.duration;
    
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
      chunks: this._createChunks(duration),
      estimatedTokens: this._estimateTokenUsage(duration)
    };
  }

  /**
   * Create smart chunks for long trips
   * @param {number} duration - Trip duration in days
   * @returns {Array} Array of chunk objects
   */
  _createChunks(duration) {
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

    // Middle chunks - balanced detail
    let currentDay = this.config.prioritySegments.arrival + 1;
    let chunkIndex = 1;
    
    while (currentDay <= duration - this.config.prioritySegments.departure) {
      const endDay = Math.min(
        currentDay + this.config.prioritySegments.middle - 1,
        duration - this.config.prioritySegments.departure
      );
      
      if (currentDay <= endDay) {
        chunks.push({
          id: `middle_${chunkIndex}`,
          startDay: currentDay,
          endDay: endDay,
          priority: 'normal',
          focus: this._determineChunkFocus(chunkIndex, duration),
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
   * Determine focus theme for middle chunks to maintain variety
   * @param {number} chunkIndex - Chunk index
   * @param {number} totalDuration - Total trip duration
   * @returns {string} Focus theme
   */
  _determineChunkFocus(chunkIndex, totalDuration) {
    const themes = [
      'cultural_immersion',
      'local_experiences',
      'nature_exploration', 
      'food_discovery',
      'historical_sites',
      'entertainment_leisure'
    ];
    
    return themes[chunkIndex % themes.length];
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

    console.log(`🔄 Generating long trip itinerary in ${analysis.chunks.length} chunks`);
    
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
        console.log(`📝 Generating chunk: ${chunk.id} (Days ${chunk.startDay}-${chunk.endDay})`);
        
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
        console.warn(`⚠️ Chunk ${chunk.id} generation failed, using fallback:`, error.message);
        
        // Generate fallback days for this chunk
        const fallbackDays = this._generateFallbackDays(trip, chunk);
        allDays.push(...fallbackDays);
      }
    }

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
   * Estimate total token usage for long trip
   * @param {number} duration - Trip duration
   * @returns {number} Estimated tokens
   */
  _estimateTokenUsage(duration) {
    const tokensPerDay = 300; // Estimated tokens per day
    return duration * tokensPerDay;
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

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration values
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}

module.exports = LongTripHandler;