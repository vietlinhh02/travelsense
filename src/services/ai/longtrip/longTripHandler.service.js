/**
 * LongTripHandlerService - Main orchestrator for long trip handling
 * Delegates to specialized services following microservices pattern
 */
class LongTripHandlerService {
  constructor() {
    // Initialize specialized services
    const TripChunkingService = require('./tripChunking.service');
    const TokenEstimationService = require('./tokenEstimation.service');
    const ChunkedItineraryGenerationService = require('./chunkedItineraryGeneration.service');
    const FallbackGenerationService = require('./fallbackGeneration.service');
    const LocationUtilityService = require('./locationUtility.service');

    this.tripChunkingService = new TripChunkingService();
    this.tokenEstimationService = new TokenEstimationService();
    this.chunkedItineraryGenerationService = new ChunkedItineraryGenerationService();
    this.fallbackGenerationService = new FallbackGenerationService();
    this.locationUtilityService = new LocationUtilityService();

    // Configuration
    this.maxTokensPerRequest = 4000;
    this.maxDaysPerChunk = 7;
  }

  /**
   * Handle long trip generation - Main entry point
   * @param {Object} trip - Trip object with destination and preferences
   * @returns {Object} Generated itinerary or error
   */
  async handleLongTrip(trip) {
    try {
      console.log(`[LongTripHandler] Starting long trip generation for ${trip.duration} days`);
      
      // Validate trip object
      const validationResult = this._validateTrip(trip);
      if (!validationResult.valid) {
        throw new Error(`Trip validation failed: ${validationResult.error}`);
      }

      // Step 1: Analyze trip and create chunks
      console.log('[LongTripHandler] Step 1: Analyzing trip and creating chunks');
      const tripAnalysis = this.tripChunkingService.analyzeTripComplexity(trip);
      const chunks = this.tripChunkingService.createTripChunks(trip, tripAnalysis);
      
      console.log(`[LongTripHandler] Created ${chunks.length} chunks for trip`);

      // Step 2: Estimate total token usage
      console.log('[LongTripHandler] Step 2: Estimating token usage');
      const tokenEstimation = this.tokenEstimationService.estimateTotalTokens(trip, chunks);
      
      if (tokenEstimation.totalTokens > this.maxTokensPerRequest * chunks.length) {
        console.warn('[LongTripHandler] Token estimation exceeds limits, using fallback');
        return this.fallbackGenerationService.generateEmergencyFallback(trip);
      }

      // Step 3: Generate itinerary for each chunk
      console.log('[LongTripHandler] Step 3: Generating chunked itineraries');
      const chunkResults = await this._generateChunkedItinerary(trip, chunks);

      // Step 4: Combine and validate results
      console.log('[LongTripHandler] Step 4: Combining chunk results');
      const finalItinerary = this._combineChunkResults(chunkResults, trip);

      // Step 5: Add metadata and analytics
      finalItinerary.metadata = {
        generatedAt: new Date(),
        totalChunks: chunks.length,
        tokenEstimation: tokenEstimation,
        tripAnalysis: tripAnalysis,
        generationMethod: 'chunked',
        processingTime: Date.now() - (trip.startTime || Date.now())
      };

      console.log('[LongTripHandler] Trip generation completed successfully');
      return finalItinerary;

    } catch (error) {
      console.error('[LongTripHandler] Error in long trip generation:', error);
      
      // Return fallback on any error
      return {
        ...this.fallbackGenerationService.generateEmergencyFallback(trip),
        error: error.message,
        fallbackReason: 'generation_error'
      };
    }
  }

  /**
   * Generate itineraries for all chunks
   * @param {Object} trip - Trip object
   * @param {Array} chunks - Array of trip chunks
   * @returns {Array} Array of chunk generation results
   */
  async _generateChunkedItinerary(trip, chunks) {
    const results = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`[LongTripHandler] Generating chunk ${i + 1}/${chunks.length}: ${chunk.focus}`);

      try {
        // Generate itinerary for this chunk
        const chunkResult = await this.chunkedItineraryGenerationService.generateChunkItinerary(
          trip, 
          chunk, 
          i === 0 ? null : results[i - 1] // Previous chunk for context
        );

        if (chunkResult && chunkResult.days && chunkResult.days.length > 0) {
          results.push({
            chunkId: chunk.id,
            success: true,
            days: chunkResult.days,
            chunk: chunk
          });
        } else {
          // Use fallback for this chunk
          console.warn(`[LongTripHandler] Chunk ${i + 1} generation failed, using fallback`);
          const fallbackDays = this.fallbackGenerationService.generateFallbackDays(trip, chunk);
          results.push({
            chunkId: chunk.id,
            success: false,
            days: fallbackDays,
            chunk: chunk,
            fallbackUsed: true
          });
        }

      } catch (error) {
        console.error(`[LongTripHandler] Error generating chunk ${i + 1}:`, error);
        
        // Use fallback for failed chunk
        const fallbackDays = this.fallbackGenerationService.generateFallbackDays(trip, chunk);
        results.push({
          chunkId: chunk.id,
          success: false,
          days: fallbackDays,
          chunk: chunk,
          fallbackUsed: true,
          error: error.message
        });
      }

      // Add delay between requests to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return results;
  }

  /**
   * Combine chunk results into final itinerary
   * @param {Array} chunkResults - Results from chunk generation
   * @param {Object} trip - Original trip object
   * @returns {Object} Combined itinerary
   */
  _combineChunkResults(chunkResults, trip) {
    const allDays = [];
    let totalSuccessfulChunks = 0;
    let totalFallbackChunks = 0;

    // Combine all days from chunks
    chunkResults.forEach(result => {
      if (result.success) totalSuccessfulChunks++;
      if (result.fallbackUsed) totalFallbackChunks++;

      // Add days to final itinerary
      if (result.days && Array.isArray(result.days)) {
        allDays.push(...result.days);
      }
    });

    // Sort days by date to ensure correct order
    allDays.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate summary statistics
    const totalActivities = allDays.reduce((sum, day) => sum + (day.activities?.length || 0), 0);
    const estimatedCost = this._calculateEstimatedCost(allDays);

    return {
      days: allDays,
      summary: {
        totalDays: allDays.length,
        totalActivities: totalActivities,
        estimatedCost: estimatedCost,
        successfulChunks: totalSuccessfulChunks,
        fallbackChunks: totalFallbackChunks,
        generationSuccess: totalSuccessfulChunks / chunkResults.length
      },
      destination: trip.destination,
      preferences: trip.preferences || {},
      chunkResults: chunkResults.map(r => ({
        chunkId: r.chunkId,
        success: r.success,
        focus: r.chunk.focus,
        days: r.days.length,
        fallbackUsed: r.fallbackUsed || false
      }))
    };
  }

  /**
   * Calculate estimated total cost from all days
   * @param {Array} days - Array of day objects
   * @returns {number} Total estimated cost
   */
  _calculateEstimatedCost(days) {
    let totalCost = 0;

    days.forEach(day => {
      if (day.activities && Array.isArray(day.activities)) {
        day.activities.forEach(activity => {
          if (activity.cost && typeof activity.cost === 'number') {
            totalCost += activity.cost;
          }
        });
      }
    });

    return Math.round(totalCost);
  }

  /**
   * Validate trip object
   * @param {Object} trip - Trip object to validate
   * @returns {Object} Validation result
   */
  _validateTrip(trip) {
    if (!trip) {
      return { valid: false, error: 'Trip object is required' };
    }

    if (!trip.duration || typeof trip.duration !== 'number' || trip.duration <= 0) {
      return { valid: false, error: 'Valid trip duration is required' };
    }

    if (!trip.destination) {
      return { valid: false, error: 'Destination is required' };
    }

    if (!trip.destination.destination && !trip.destination.city) {
      return { valid: false, error: 'Destination name or city is required' };
    }

    if (!trip.destination.startDate) {
      return { valid: false, error: 'Start date is required' };
    }

    return { valid: true };
  }

  /**
   * Check if trip requires chunking
   * @param {Object} trip - Trip object
   * @returns {boolean} Whether trip needs chunking
   */
  shouldUseChunking(trip) {
    if (!trip || !trip.duration) return false;
    
    // Use chunking for trips longer than maxDaysPerChunk
    return trip.duration > this.maxDaysPerChunk;
  }

  /**
   * Get trip complexity analysis
   * @param {Object} trip - Trip object
   * @returns {Object} Trip complexity analysis
   */
  getTripComplexityAnalysis(trip) {
    return this.tripChunkingService.analyzeTripComplexity(trip);
  }

  /**
   * Get token estimation for trip
   * @param {Object} trip - Trip object
   * @returns {Object} Token estimation
   */
  getTokenEstimation(trip) {
    const analysis = this.tripChunkingService.analyzeTripComplexity(trip);
    const chunks = this.tripChunkingService.createTripChunks(trip, analysis);
    return this.tokenEstimationService.estimateTotalTokens(trip, chunks);
  }

  /**
   * Preview chunks that would be created for trip
   * @param {Object} trip - Trip object
   * @returns {Array} Array of chunks that would be created
   */
  previewTripChunks(trip) {
    const analysis = this.tripChunkingService.analyzeTripComplexity(trip);
    return this.tripChunkingService.createTripChunks(trip, analysis);
  }

  /**
   * Get service health status
   * @returns {Object} Health status of all services
   */
  getHealthStatus() {
    return {
      status: 'healthy',
      services: {
        tripChunking: !!this.tripChunkingService,
        tokenEstimation: !!this.tokenEstimationService,
        chunkedGeneration: !!this.chunkedItineraryGenerationService,
        fallbackGeneration: !!this.fallbackGenerationService,
        locationUtility: !!this.locationUtilityService
      },
      configuration: {
        maxTokensPerRequest: this.maxTokensPerRequest,
        maxDaysPerChunk: this.maxDaysPerChunk
      },
      timestamp: new Date()
    };
  }

  /**
   * Update configuration
   * @param {Object} config - New configuration values
   */
  updateConfiguration(config) {
    if (config.maxTokensPerRequest) {
      this.maxTokensPerRequest = config.maxTokensPerRequest;
    }
    if (config.maxDaysPerChunk) {
      this.maxDaysPerChunk = config.maxDaysPerChunk;
    }
  }
}

module.exports = LongTripHandlerService;
