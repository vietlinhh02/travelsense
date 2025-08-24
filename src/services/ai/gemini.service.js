const { AIInteractionLog, RateLimitTracker } = require('../../models/ai');
const { Trip } = require('../../models/trips');
const GeminiApiClient = require('./geminiApiClient');
const PromptBuilder = require('./promptBuilder');
const ResponseParser = require('./responseParser');
const ActivityTemplateService = require('./activityTemplateService');
const LongTripHandler = require('./longTripHandler');
const { POICacheService } = require('../poi');

class GeminiService {
  constructor() {
    this.apiClient = new GeminiApiClient();
    this.promptBuilder = new PromptBuilder();
    this.responseParser = new ResponseParser();
    this.templateService = new ActivityTemplateService();
    this.longTripHandler = new LongTripHandler();
    this.poiCacheService = new POICacheService();
    
    // Configuration for POI enrichment
    this.config = {
      enablePOIEnrichment: true,
      enrichAfterGeneration: true
    };
  }

  /**
   * Chat with AI for trip planning ideation and suggestions
   * @param {string} userId - User ID
   * @param {Object} chatData - Chat request data
   * @returns {Promise<Object>} AI response
   */
  async chatWithAI(userId, chatData) {
    const { message, context = {}, model = 'flash' } = chatData;
    const startTime = Date.now();
    let prompt = 'Error occurred before prompt generation';

    try {
      // Check rate limits
      const rateLimitCheck = await RateLimitTracker.checkRateLimit(userId, model);
      if (!rateLimitCheck.allowed) {
        throw new Error('RATE_LIMIT_EXCEEDED');
      }

      // Validate trip access if tripId provided
      if (context.tripId) {
        const trip = await Trip.findById(context.tripId);
        if (!trip || !trip.isOwnedBy(userId)) {
          throw new Error('TRIP_ACCESS_DENIED');
        }
      }

      // Prepare conversation context using PromptBuilder
      prompt = this.promptBuilder.buildConversationPrompt(message, context);
      
      // Call Gemini API
      const response = await this._callGeminiAPIWithFallback(model, prompt);
      
      const processingTime = Date.now() - startTime;

      // Log interaction
      await this._logInteraction({
        userId,
        tripId: context.tripId,
        endpoint: 'chat',
        model,
        prompt,
        responseContent: response.content,
        tokensUsed: response.tokensUsed,
        processingTime,
        success: true
      });

      return {
        content: response.content,
        model: model,
        tokensUsed: response.tokensUsed,
        processingTime,
        rateLimitRemaining: rateLimitCheck.remaining - 1
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Log failed interaction
      await this._logInteraction({
        userId,
        tripId: context.tripId,
        endpoint: 'chat',
        model,
        prompt,
        success: false,
        error: error.message,
        processingTime
      });

      throw error;
    }
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
        prompt = this.promptBuilder.buildItineraryPrompt(trip, focus);
        
        // Call Gemini Pro for structured output
        const response = await this._callGeminiAPIWithFallback('pro', prompt);
        totalTokensUsed = response.tokensUsed;

        // Process AI response using ResponseParser and fallback to templates
        try {
          itinerary = this.responseParser.processItineraryResponse(response.content, trip);
        } catch (fallbackError) {
          if (fallbackError.message === 'FALLBACK_TO_TEMPLATE_REQUIRED') {
            console.log(' Using ActivityTemplateService for itinerary generation...');
            itinerary = this.templateService.generateTemplateBasedItinerary(trip);
          } else {
            throw fallbackError;
          }
        }
        
        // Enrich POI data for standard itinerary if enabled
        if (this.config.enablePOIEnrichment && this.config.enrichAfterGeneration && itinerary.days) {
          console.log(' Enriching standard itinerary with POI data');
          itinerary = await this._enrichItineraryPOIData(itinerary, trip);
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
      const response = await this._callGeminiAPIWithFallback('pro', prompt);
      
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
      const response = await this._callGeminiAPIWithFallback('pro', prompt);
      
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
      const response = await this._callGeminiAPIWithFallback('flash', prompt);
      
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

  /**
   * Call Gemini API with fallback to mock response
   * @param {string} model - Model type
   * @param {string} prompt - Prompt to send
   * @returns {Promise<Object>} API response
   */
  async _callGeminiAPIWithFallback(model, prompt) {
    try {
      return await this.apiClient.callGeminiAPI(model, prompt);
    } catch (error) {
      console.error(' Gemini API call failed:', error.response?.data || error.message);
      
      // If API fails, fall back to mock response
      console.log(' Falling back to mock response...');
      return await this.responseParser.generateMockResponse(model, prompt);
    }
  }

  /**
   * Generate standard itinerary (helper method for chunked generation)
   * @param {Object} trip - Trip object
   * @param {string} focus - Focus for generation
   * @returns {Promise<Object>} Generated itinerary
   */
  async _generateStandardItinerary(trip, focus) {
    // Prepare structured prompt using PromptBuilder
    const prompt = this.promptBuilder.buildItineraryPrompt(trip, focus);
    
    // Call Gemini Pro for structured output
    const response = await this._callGeminiAPIWithFallback('pro', prompt);

    // Process AI response using ResponseParser and fallback to templates
    let itinerary;
    try {
      itinerary = this.responseParser.processItineraryResponse(response.content, trip);
    } catch (fallbackError) {
      if (fallbackError.message === 'FALLBACK_TO_TEMPLATE_REQUIRED') {
        console.log(' Using ActivityTemplateService for standard itinerary generation...');
        itinerary = this.templateService.generateTemplateBasedItinerary(trip);
      } else {
        throw fallbackError;
      }
    }
    
    // Enrich POI data for standard itinerary if enabled
    if (this.config.enablePOIEnrichment && this.config.enrichAfterGeneration && itinerary.days) {
      console.log('Enriching _generateStandardItinerary with POI data');
      itinerary = await this._enrichItineraryPOIData(itinerary, trip);
    }
    
    return itinerary;
  }

  /**
   * Private method to log AI interactions
   * @param {Object} logData - Log data
   */
  async _logInteraction(logData) {
    try {
      const log = AIInteractionLog.createLog(logData);
      await log.save();
    } catch (error) {
      console.error('Failed to log AI interaction:', error);
      // Don't throw error to avoid disrupting main flow
    }
  }

  /**
   * Enrich itinerary with POI data using the POI Cache Service
   * @param {Object} itinerary - Generated itinerary object
   * @param {Object} trip - Trip object for context
   * @returns {Promise<Object>} Enriched itinerary
   */
  async _enrichItineraryPOIData(itinerary, trip) {
    try {
      console.log(` Starting POI enrichment for itinerary with ${itinerary.days?.length || 0} days`);
      
      if (!itinerary.days || itinerary.days.length === 0) {
        console.warn(' No days found in itinerary, skipping POI enrichment');
        return itinerary;
      }

      // Extract all activities from all days
      const allActivities = this._extractActivitiesFromDays(itinerary.days);
      
      if (allActivities.length === 0) {
        console.warn(' No activities found in itinerary, skipping POI enrichment');
        return itinerary;
      }

      // Create trip context for better POI extraction
      const tripContext = this._createTripContext(trip);
      
      // Enrich activities with POI data
      const enrichedActivities = await this.poiCacheService.enrichActivities(allActivities, tripContext);
      
      // Map enriched activities back to days
      const enrichedDays = this._mapActivitiesBackToDays(itinerary.days, enrichedActivities);
      
      console.log(` POI enrichment completed for ${enrichedActivities.length} activities`);
      
      return {
        ...itinerary,
        days: enrichedDays,
        poi_enrichment: {
          enabled: true,
          activities_processed: allActivities.length,
          activities_enriched: enrichedActivities.filter(a => a.enrichment_status === 'success').length,
          timestamp: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error(' POI enrichment failed:', error.message);
      
      // Return original itinerary with error info if enrichment fails
      return {
        ...itinerary,
        poi_enrichment: {
          enabled: true,
          error: error.message,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Extract all activities from itinerary days
   * @param {Array} days - Array of day objects
   * @returns {Array} Array of all activities
   */
  _extractActivitiesFromDays(days) {
    const activities = [];
    
    days.forEach((day, dayIndex) => {
      if (day.activities && Array.isArray(day.activities)) {
        day.activities.forEach((activity, activityIndex) => {
          activities.push({
            ...activity,
            _dayIndex: dayIndex,
            _activityIndex: activityIndex
          });
        });
      }
    });
    
    return activities;
  }

  /**
   * Create trip context for POI extraction
   * @param {Object} trip - Trip object
   * @returns {Object} Trip context for POI service
   */
  _createTripContext(trip) {
    return {
      destination: trip.destination?.destination || 'Unknown',
      city: trip.destination?.city || 'Unknown',
      country: trip.destination?.country || 'Unknown',
      duration: trip.duration || 1,
      interests: trip.preferences?.interests || [],
      budget: trip.budget || {},
      startDate: trip.destination?.startDate,
      endDate: trip.destination?.endDate,
      travelers: trip.travelers || {}
    };
  }

  /**
   * Map enriched activities back to the original day structure
   * @param {Array} originalDays - Original days array
   * @param {Array} enrichedActivities - Enriched activities array
   * @returns {Array} Days with enriched activities mapped back
   */
  _mapActivitiesBackToDays(originalDays, enrichedActivities) {
    // Create a map of enriched activities by their original position
    const enrichedMap = new Map();
    enrichedActivities.forEach(activity => {
      if (typeof activity._dayIndex !== 'undefined' && typeof activity._activityIndex !== 'undefined') {
        const key = `${activity._dayIndex}_${activity._activityIndex}`;
        enrichedMap.set(key, activity);
      }
    });
    
    // Map enriched activities back to days
    return originalDays.map((day, dayIndex) => {
      if (!day.activities) return day;
      
      const enrichedDayActivities = day.activities.map((activity, activityIndex) => {
        const key = `${dayIndex}_${activityIndex}`;
        const enrichedActivity = enrichedMap.get(key);
        
        if (enrichedActivity) {
          // Remove internal tracking properties
          const { _dayIndex, _activityIndex, ...cleanActivity } = enrichedActivity;
          return cleanActivity;
        }
        
        return activity;
      });
      
      return {
        ...day,
        activities: enrichedDayActivities
      };
    });
  }

  /**
   * Get service health status
   * @returns {Promise<Object>} Health status
   */
  async getHealthStatus() {
    const apiHealth = await this.apiClient.checkApiHealth();
    
    return {
      status: apiHealth ? 'healthy' : 'degraded',
      apiClient: apiHealth ? 'connected' : 'using_fallback',
      components: {
        apiClient: this.apiClient.hasValidApiKey(),
        promptBuilder: true,
        responseParser: true,
        templateService: true,
        longTripHandler: true,
        poiCacheService: !!this.poiCacheService
      },
      longTripConfig: this.longTripHandler.getConfig(),
      poiEnrichmentConfig: this.config,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new GeminiService();