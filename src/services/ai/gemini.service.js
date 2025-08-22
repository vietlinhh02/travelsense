const { AIInteractionLog, RateLimitTracker } = require('../../models/ai');
const { Trip } = require('../../models/trips');
const GeminiApiClient = require('./geminiApiClient');
const PromptBuilder = require('./promptBuilder');
const ResponseParser = require('./responseParser');
const ActivityTemplateService = require('./activityTemplateService');

class GeminiService {
  constructor() {
    this.apiClient = new GeminiApiClient();
    this.promptBuilder = new PromptBuilder();
    this.responseParser = new ResponseParser();
    this.templateService = new ActivityTemplateService();
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

      // Prepare structured prompt using PromptBuilder
      prompt = this.promptBuilder.buildItineraryPrompt(trip, focus);
      
      // Call Gemini Pro for structured output
      const response = await this._callGeminiAPIWithFallback('pro', prompt);
      
      const processingTime = Date.now() - startTime;

      // Process AI response using ResponseParser and fallback to templates
      let itinerary;
      try {
        itinerary = this.responseParser.processItineraryResponse(response.content, trip);
      } catch (fallbackError) {
        if (fallbackError.message === 'FALLBACK_TO_TEMPLATE_REQUIRED') {
          console.log('🔄 Using ActivityTemplateService for itinerary generation...');
          itinerary = this.templateService.generateTemplateBasedItinerary(trip);
        } else {
          throw fallbackError;
        }
      }

      // Log interaction
      await this._logInteraction({
        userId,
        tripId,
        endpoint: 'generate-itinerary',
        model: 'pro',
        prompt,
        responseContent: response.content,
        tokensUsed: response.tokensUsed,
        processingTime,
        success: true
      });

      return {
        itinerary,
        tokensUsed: response.tokensUsed,
        processingTime,
        rateLimitRemaining: rateLimitCheck.remaining - 1
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
      console.error('❌ Gemini API call failed:', error.response?.data || error.message);
      
      // If API fails, fall back to mock response
      console.log('🔄 Falling back to mock response...');
      return await this.responseParser.generateMockResponse(model, prompt);
    }
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
        templateService: true
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = new GeminiService();