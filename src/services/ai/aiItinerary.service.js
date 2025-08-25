const { AIInteractionLog, RateLimitTracker } = require('../../models/ai');
const { Trip } = require('../../models/trips');
const AIBaseService = require('./aiBase.service');

/**
 * AIItineraryService - Handles itinerary generation and optimization
 * Extends AIBaseService with itinerary-specific functionality
 */
class AIItineraryService extends AIBaseService {
  constructor() {
    super();
  }

  /**
   * Generate trip itinerary using Gemini Pro
   * @param {string} userId - User ID
   * @param {string} tripId - Trip ID
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated itinerary
   */
  async generateItinerary(userId, tripId, options = {}) {
    const { focus } = options;
    const startTime = Date.now();
    let prompt = 'Error occurred before prompt generation';

    try {
      // Check rate limits for Pro model
      const rateLimitCheck = await RateLimitTracker.checkRateLimit(userId, 'pro');
      if (!rateLimitCheck.allowed) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }

      // Validate trip access
      const trip = await Trip.findById(tripId);
      if (!trip || !trip.isOwnedBy(userId)) {
        throw new Error('TRIP_ACCESS_DENIED');
      }

      // Check if trip already has a complete itinerary
      if (trip.itinerary.days && trip.itinerary.days.length > 0) {
        throw new Error('TRIP_ALREADY_HAS_ITINERARY');
      }

      // Analyze trip for long duration handling
      const tripAnalysis = this.longTripHandler.analyzeTrip(trip);
      console.log(` Trip analysis: ${trip.duration} days, chunking needed: ${tripAnalysis.needsChunking}`);

      let itinerary;
      let totalTokensUsed = 0;
      const processingTime = Date.now() - startTime;

      if (tripAnalysis.needsChunking) {
        // Use chunked generation for long trips
        console.log(` Generating long trip itinerary using ${tripAnalysis.strategy}`);

        try {
          itinerary = await this.longTripHandler.generateChunkedItinerary(trip, {
            geminiClient: this.apiClient,
            promptBuilder: this.promptBuilder,
            responseParser: this.responseParser,
            generateStandardItinerary: (trip) => this._generateStandardItinerary(trip, focus)
          });

          // Estimate tokens for chunked generation
          totalTokensUsed = tripAnalysis.estimatedTokens || 0;

        } catch (chunkError) {
          console.warn(' Chunked generation failed, falling back to template service:', chunkError.message);
          itinerary = this.templateService.generateTemplateBasedItinerary(trip);
          totalTokensUsed = 0;
        }

      } else {
        // Use standard generation for normal trips
        console.log(' Generating standard itinerary');

        // Prepare structured prompt using PromptBuilder
        prompt = this.promptBuilder.buildItineraryPrompt(trip, options);

        // Call Gemini Pro for structured output
        const response = await this._callGeminiAPI('pro', prompt);
        totalTokensUsed = response.tokensUsed;

        // Process AI response using ResponseParser and retry AI if needed
        try {
          itinerary = this.responseParser.processItineraryResponse(response.content, trip);
        } catch (parseError) {
          console.warn('AI response parsing failed:', parseError.message);
          console.log(' Retrying AI generation with corrected prompt...');

          // Try AI again with a more specific prompt
          try {
            const retryPrompt = this.promptBuilder.buildItineraryPrompt(trip, {
              ...options,
              retry: true,
              formatEmphasis: 'Please ensure the response is VALID JSON only, no markdown or text'
            });
            const retryResponse = await this._callGeminiAPI('pro', retryPrompt);
            itinerary = this.responseParser.processItineraryResponse(retryResponse.content, trip);
            totalTokensUsed += retryResponse.tokensUsed;
            console.log(' AI retry successful');
          } catch (retryError) {
            console.warn('AI retry failed:', retryError.message);
            console.log(' Using ActivityTemplateService as last resort fallback...');
            itinerary = this.templateService.generateTemplateBasedItinerary(trip);
          }
        }
      }

      // Validate and repair itinerary if needed
      if (itinerary && itinerary.days) {
        const validationResult = this.responseParser.validateItinerary(itinerary, options);

        if (!validationResult.ok) {
          console.log(' Itinerary validation failed, attempting auto-repair...');

          // Try auto-repair once
          try {
            const repairPrompt = this.responseParser.autoRepairPrompt(
              validationResult.issues,
              itinerary,
              options
            );

            const repairResponse = await this._callGeminiAPI('pro', repairPrompt);
            const repairedItinerary = this.responseParser.processItineraryResponse(repairResponse.content, trip);

            if (repairedItinerary && repairedItinerary.days) {
              itinerary = repairedItinerary;
              totalTokensUsed += repairResponse.tokensUsed;
              console.log(' Itinerary successfully repaired');
            }
          } catch (repairError) {
            console.warn(' Auto-repair failed, using original itinerary:', repairError.message);
          }
        }
      }

      // Log interaction
      await this._logInteraction({
        userId,
        tripId,
        endpoint: 'generate-itinerary',
        model: 'pro',
        prompt: tripAnalysis.needsChunking ? 'Chunked generation (multiple prompts)' : prompt,
        responseContent: tripAnalysis.needsChunking ? 'Chunked responses combined' : 'Standard response',
        tokensUsed: totalTokensUsed,
        processingTime,
        success: true,
        metadata: {
          tripDuration: trip.duration,
          chunkingUsed: tripAnalysis.needsChunking,
          chunksGenerated: tripAnalysis.chunks?.length || 0
        }
      });

      return {
        itinerary,
        tokensUsed: totalTokensUsed,
        processingTime,
        rateLimitRemaining: rateLimitCheck.remaining - 1,
        generationStrategy: tripAnalysis.needsChunking ? 'chunked' : 'standard',
        chunksGenerated: tripAnalysis.chunks?.length || 0
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this._logInteraction({
        userId,
        tripId,
        endpoint: 'generate-itinerary',
        model: 'pro',
        prompt,
        success: false,
        error: error.message,
        processingTime
      });

      throw error;
    }
  }

  /**
   * Optimize trip schedule using Gemini Pro
   * @param {string} userId - User ID
   * @param {string} tripId - Trip ID
   * @param {Object} options - Optimization options
   * @returns {Promise<Object>} Optimized schedule
   */
  async optimizeSchedule(userId, tripId, options = {}) {
    const { focus } = options;
    const startTime = Date.now();
    let prompt = 'Error occurred before prompt generation';

    try {
      // Check rate limits for Pro model
      const rateLimitCheck = await RateLimitTracker.checkRateLimit(userId, 'pro');
      if (!rateLimitCheck.allowed) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }

      // Validate trip access
      const trip = await Trip.findById(tripId);
      if (!trip || !trip.isOwnedBy(userId)) {
        throw new Error('TRIP_ACCESS_DENIED');
      }

      // Check if trip has an itinerary to optimize
      if (!trip.itinerary.days || trip.itinerary.days.length === 0) {
        throw new Error('NO_ITINERARY_TO_OPTIMIZE');
      }

      // Prepare optimization prompt using PromptBuilder
      prompt = this.promptBuilder.buildOptimizationPrompt(trip, focus);

      // Call Gemini Pro for optimization
      const response = await this._callGeminiAPI('pro', prompt);

      const processingTime = Date.now() - startTime;

      // Process optimized schedule using ResponseParser
      const optimizedSchedule = this.responseParser.processOptimizationResponse(response.content, trip);

      // Log interaction
      await this._logInteraction({
        userId,
        tripId,
        endpoint: 'optimize-schedule',
        model: 'pro',
        prompt,
        responseContent: response.content,
        tokensUsed: response.tokensUsed,
        processingTime,
        success: true
      });

      return {
        optimizedSchedule,
        tokensUsed: response.tokensUsed,
        processingTime,
        rateLimitRemaining: rateLimitCheck.remaining - 1
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this._logInteraction({
        userId,
        tripId,
        endpoint: 'optimize-schedule',
        model: 'pro',
        prompt,
        success: false,
        error: error.message,
        processingTime
      });

      throw error;
    }
  }

  /**
   * Validate trip constraints using Gemini Pro
   * @param {string} userId - User ID
   * @param {string} tripId - Trip ID
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation results
   */
  async validateConstraints(userId, tripId, options = {}) {
    const { checkType = 'all' } = options;
    const startTime = Date.now();
    let prompt = 'Error occurred before prompt generation';

    try {
      // Check rate limits for Pro model
      const rateLimitCheck = await RateLimitTracker.checkRateLimit(userId, 'pro');
      if (!rateLimitCheck.allowed) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }

      // Validate trip access
      const trip = await Trip.findById(tripId);
      if (!trip || !trip.isOwnedBy(userId)) {
        throw new Error('TRIP_ACCESS_DENIED');
      }

      // Prepare validation prompt using PromptBuilder
      prompt = this.promptBuilder.buildValidationPrompt(trip, checkType);

      // Call Gemini Pro for validation
      const response = await this._callGeminiAPI('pro', prompt);

      const processingTime = Date.now() - startTime;

      // Process validation results using ResponseParser
      const validationResults = this.responseParser.processValidationResponse(response.content);

      // Log interaction
      await this._logInteraction({
        userId,
        tripId,
        endpoint: 'validate-constraints',
        model: 'pro',
        prompt,
        responseContent: response.content,
        tokensUsed: response.tokensUsed,
        processingTime,
        success: true
      });

      return {
        validationResults,
        tokensUsed: response.tokensUsed,
        processingTime,
        rateLimitRemaining: rateLimitCheck.remaining - 1
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this._logInteraction({
        userId,
        tripId,
        endpoint: 'validate-constraints',
        model: 'pro',
        prompt,
        success: false,
        error: error.message,
        processingTime
      });

      throw error;
    }
  }

  /**
   * Generate activity suggestions using Gemini Flash
   * @param {string} userId - User ID
   * @param {Object} suggestionData - Suggestion request data
   * @returns {Promise<Object>} Activity suggestions
   */
  async generateActivitySuggestions(userId, suggestionData) {
    const { tripId, date, timePeriod, interests, constraints } = suggestionData;
    const startTime = Date.now();
    let prompt = 'Error occurred before prompt generation';

    try {
      // Check rate limits for Flash model
      const rateLimitCheck = await RateLimitTracker.checkRateLimit(userId, 'flash');
      if (!rateLimitCheck.allowed) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }

      // Validate trip access if tripId provided
      let trip = null;
      if (tripId) {
        trip = await Trip.findById(tripId);
        if (!trip || !trip.isOwnedBy(userId)) {
          throw new Error('TRIP_ACCESS_DENIED');
        }

        // Validate date is within trip range if provided
        if (date) {
          const requestDate = new Date(date);
          if (requestDate < trip.destination.startDate || requestDate > trip.destination.endDate) {
            throw new Error('DATE_OUTSIDE_TRIP_RANGE');
          }
        }
      }

      // Prepare suggestion prompt using PromptBuilder
      prompt = this.promptBuilder.buildSuggestionPrompt(trip, { date, timePeriod, interests, constraints });

      // Call Gemini Flash for suggestions
      const response = await this._callGeminiAPI('flash', prompt);

      const processingTime = Date.now() - startTime;

      // Process activity suggestions using ResponseParser
      const suggestions = this.responseParser.processSuggestionResponse(response.content);

      // Log interaction
      await this._logInteraction({
        userId,
        tripId,
        endpoint: 'suggest-activities',
        model: 'flash',
        prompt,
        responseContent: response.content,
        tokensUsed: response.tokensUsed,
        processingTime,
        success: true
      });

      return {
        suggestions,
        tokensUsed: response.tokensUsed,
        processingTime,
        rateLimitRemaining: rateLimitCheck.remaining - 1
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;

      await this._logInteraction({
        userId,
        tripId,
        endpoint: 'suggest-activities',
        model: 'flash',
        prompt,
        success: false,
        error: error.message,
        processingTime
      });

      throw error;
    }
  }
}

module.exports = AIItineraryService;
