const { POICacheService } = require('../poi');

/**
 * LongTripHandler - Handles very long trip durations with smart segmentation
 * Responsible for: Trip chunking, progressive generation, token optimization, detail preservation, POI enrichment
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
      },
      poi: {
        enableEnrichment: true,  // Enable POI enrichment
        enrichAfterGeneration: true, // Enrich after AI generation
        maxPoisPerChunk: 10      // Limit POIs per chunk for performance
      }
    };
    
    // Initialize POI Cache Service
    this.poiCacheService = new POICacheService();
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
      estimatedTokens: this._estimateTokenUsage(duration, this._createChunks(duration), trip)
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
   * Generate itinerary using chunked approach with POI enrichment
   * @param {Object} trip - Trip object
   * @param {Object} aiServices - AI service dependencies
   * @returns {Promise<Object>} Complete enriched itinerary
   */
  async generateChunkedItinerary(trip, aiServices) {
    const analysis = this.analyzeTrip(trip);
    
    if (!analysis.needsChunking) {
      // Use standard generation for short trips, then enrich
      const standardItinerary = await aiServices.generateStandardItinerary(trip);
      
      if (this.config.poi.enableEnrichment && standardItinerary.days) {
        console.log('🌟 Enriching standard itinerary with POI data');
        const tripContext = this._createTripContext(trip);
        const allActivities = this._extractActivitiesFromDays(standardItinerary.days);
        const enrichedActivities = await this.poiCacheService.enrichActivities(allActivities, tripContext);
        const enrichedDays = this._mapActivitiesBackToDays(standardItinerary.days, enrichedActivities);
        return { ...standardItinerary, days: enrichedDays };
      }
      
      return standardItinerary;
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
        
        // Enrich POI data for this chunk if enabled
        let enrichedChunkDays = chunkItinerary.days;
        if (this.config.poi.enableEnrichment && this.config.poi.enrichAfterGeneration) {
          console.log(`🌟 Enriching POI data for chunk: ${chunk.id}`);
          enrichedChunkDays = await this._enrichChunkWithPOI(chunkItinerary.days, trip, chunk);
        }
        
        allDays.push(...enrichedChunkDays);
        
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

    console.log(`✅ Long trip generation completed with ${allDays.length} days generated`);
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

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration values
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Enrich a chunk's days with POI data
   * @param {Array} chunkDays - Days from the chunk
   * @param {Object} trip - Trip object for context
   * @param {Object} chunk - Chunk configuration
   * @returns {Promise<Array>} Enriched days
   */
  async _enrichChunkWithPOI(chunkDays, trip, chunk) {
    try {
      const tripContext = this._createTripContext(trip, chunk);
      const allActivities = this._extractActivitiesFromDays(chunkDays);
      
      // Limit activities for performance if needed
      const limitedActivities = this.config.poi.maxPoisPerChunk ? 
        allActivities.slice(0, this.config.poi.maxPoisPerChunk) : allActivities;
      
      const enrichedActivities = await this.poiCacheService.enrichActivities(limitedActivities, tripContext);
      const enrichedDays = this._mapActivitiesBackToDays(chunkDays, enrichedActivities);
      
      return enrichedDays;
    } catch (error) {
      console.error(`❌ POI enrichment failed for chunk ${chunk.id}:`, error.message);
      // Return original days if enrichment fails
      return chunkDays;
    }
  }

  /**
   * Create trip context for POI extraction
   * @param {Object} trip - Trip object
   * @param {Object} chunk - Optional chunk context
   * @returns {Object} Trip context for POI extraction
   */
  _createTripContext(trip, chunk = null) {
    return {
      destination: trip.destination?.destination || 'Unknown',
      city: this._extractCityFromDestination(trip.destination?.destination),
      country: this._extractCountryFromDestination(trip.destination?.destination),
      duration: trip.duration,
      travelers: trip.travelers,
      budget: trip.budget,
      interests: trip.preferences?.interests || [],
      constraints: trip.preferences?.constraints || [],
      chunkFocus: chunk?.focus,
      chunkDetailLevel: chunk?.detailLevel
    };
  }

  /**
   * Extract activities from days array
   * @param {Array} days - Array of day objects
   * @returns {Array} Array of activities
   */
  _extractActivitiesFromDays(days) {
    const activities = [];
    
    days.forEach(day => {
      if (day.activities && Array.isArray(day.activities)) {
        day.activities.forEach(activity => {
          activities.push({
            ...activity,
            dayDate: day.date,
            dayIndex: days.indexOf(day)
          });
        });
      }
    });
    
    return activities;
  }

  /**
   * Map enriched activities back to days structure
   * @param {Array} originalDays - Original days array
   * @param {Array} enrichedActivities - Enriched activities array
   * @returns {Array} Days with enriched activities
   */
  _mapActivitiesBackToDays(originalDays, enrichedActivities) {
    const enrichedDays = originalDays.map(day => ({ ...day }));
    
    enrichedActivities.forEach(enrichedActivity => {
      const dayIndex = enrichedActivity.dayIndex;
      const activityIndex = enrichedDays[dayIndex]?.activities?.findIndex(act => 
        act.title === enrichedActivity.title && act.time === enrichedActivity.time
      );
      
      if (dayIndex !== undefined && activityIndex !== -1) {
        enrichedDays[dayIndex].activities[activityIndex] = {
          ...enrichedActivity,
          // Remove temporary indexing properties
          dayDate: undefined,
          dayIndex: undefined
        };
      }
    });
    
    return enrichedDays;
  }

  /**
   * Extract city from destination string
   * @param {string} destination - Destination string
   * @returns {string} Extracted city name
   */
  _extractCityFromDestination(destination) {
    if (!destination) return 'Unknown City';
    
    const destLower = destination.toLowerCase();
    
    // Known city patterns
    const cityPatterns = {
      'ho chi minh': 'Ho Chi Minh City',
      'saigon': 'Ho Chi Minh City',
      'hanoi': 'Hanoi',
      'hue': 'Hue',
      'da nang': 'Da Nang',
      'tokyo': 'Tokyo',
      'kyoto': 'Kyoto',
      'osaka': 'Osaka',
      'paris': 'Paris',
      'london': 'London',
      'new york': 'New York',
      'bangkok': 'Bangkok',
      'singapore': 'Singapore'
    };
    
    for (const [pattern, city] of Object.entries(cityPatterns)) {
      if (destLower.includes(pattern)) {
        return city;
      }
    }
    
    // Fallback: take first part before comma or use whole string
    const parts = destination.split(',');
    return parts[0].trim();
  }

  /**
   * Extract country from destination string
   * @param {string} destination - Destination string
   * @returns {string} Extracted country name
   */
  _extractCountryFromDestination(destination) {
    if (!destination) return 'Unknown Country';
    
    const destLower = destination.toLowerCase();
    
    // Known country patterns
    const countryPatterns = {
      'vietnam': 'Vietnam',
      'japan': 'Japan',
      'france': 'France',
      'united kingdom': 'United Kingdom',
      'uk': 'United Kingdom',
      'usa': 'United States',
      'united states': 'United States',
      'thailand': 'Thailand',
      'singapore': 'Singapore',
      'china': 'China',
      'south korea': 'South Korea',
      'korea': 'South Korea',
      'italy': 'Italy',
      'spain': 'Spain',
      'germany': 'Germany'
    };
    
    for (const [pattern, country] of Object.entries(countryPatterns)) {
      if (destLower.includes(pattern)) {
        return country;
      }
    }
    
    // Fallback: look for last part after comma or use a default
    const parts = destination.split(',');
    if (parts.length > 1) {
      return parts[parts.length - 1].trim();
    }
    
    return 'Unknown Country';
  }

  /**
   * Get POI enrichment statistics
   * @returns {Object} POI enrichment stats
   */
  getPOIStats() {
    return this.poiCacheService.getServiceStats();
  }

  /**
   * Enable or disable POI enrichment
   * @param {boolean} enabled - Whether to enable POI enrichment
   */
  setPOIEnrichment(enabled) {
    this.config.poi.enableEnrichment = enabled;
    console.log(`🔧 POI enrichment ${enabled ? 'enabled' : 'disabled'}`);
  }
}

module.exports = LongTripHandler;