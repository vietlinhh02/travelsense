const { AIInteractionLog, RateLimitTracker } = require('../../models/ai');
const { Trip } = require('../../models/trips');

class GeminiService {
  constructor() {
    // Mock Gemini API - In production, replace with actual Gemini SDK
    this.geminiFlashEndpoint = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash';
    this.geminiProEndpoint = 'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro';
    this.embeddingsEndpoint = 'https://generativelanguage.googleapis.com/v1/models/text-embedding-004';
    
    // In production, this should come from environment variables
    this.apiKey = process.env.GEMINI_API_KEY || 'mock-api-key';
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

      // Prepare conversation context
      const conversationContext = this._prepareConversationContext(message, context);
      
      // Call appropriate Gemini model
      const response = await this._callGeminiAPI(model, conversationContext);
      
      const processingTime = Date.now() - startTime;

      // Log interaction
      await this._logInteraction({
        userId,
        tripId: context.tripId,
        endpoint: 'chat',
        model,
        prompt: conversationContext,
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
        prompt: message,
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

      // Prepare structured prompt for itinerary generation
      const prompt = this._prepareItineraryPrompt(trip, focus);
      
      // Call Gemini Pro for structured output
      const response = await this._callGeminiAPI('pro', prompt);
      
      const processingTime = Date.now() - startTime;

      // Process and validate AI response
      const itinerary = this._processItineraryResponse(response.content, trip);

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

      // Prepare optimization prompt
      const prompt = this._prepareOptimizationPrompt(trip, focus);
      
      // Call Gemini Pro for optimization
      const response = await this._callGeminiAPI('pro', prompt);
      
      const processingTime = Date.now() - startTime;

      // Process optimized schedule
      const optimizedSchedule = this._processOptimizationResponse(response.content, trip);

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

      // Prepare validation prompt
      const prompt = this._prepareValidationPrompt(trip, checkType);
      
      // Call Gemini Pro for validation
      const response = await this._callGeminiAPI('pro', prompt);
      
      const processingTime = Date.now() - startTime;

      // Process validation results
      const validationResults = this._processValidationResponse(response.content);

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

      // Prepare suggestion prompt
      const prompt = this._prepareSuggestionPrompt(trip, { date, timePeriod, interests, constraints });
      
      // Call Gemini Flash for suggestions
      const response = await this._callGeminiAPI('flash', prompt);
      
      const processingTime = Date.now() - startTime;

      // Process activity suggestions
      const suggestions = this._processSuggestionResponse(response.content);

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
        success: false,
        error: error.message,
        processingTime
      });

      throw error;
    }
  }

  /**
   * Private method to call Gemini API (mocked for now)
   * @param {string} model - Model to use (flash, pro, embeddings)
   * @param {string} prompt - Prompt to send
   * @returns {Promise<Object>} API response
   */
  async _callGeminiAPI(model, prompt) {
    // Mock implementation - replace with actual Gemini API calls in production
    await this._simulateNetworkDelay();

    // Mock different responses based on model
    const mockResponses = {
      flash: {
        content: `Mock Gemini Flash response for: ${prompt.substring(0, 100)}...`,
        tokensUsed: Math.floor(Math.random() * 500) + 100
      },
      pro: {
        content: `Mock Gemini Pro response for: ${prompt.substring(0, 100)}...`,
        tokensUsed: Math.floor(Math.random() * 1000) + 200
      },
      embeddings: {
        content: '[0.1, 0.2, 0.3, ...]', // Mock embedding vector
        tokensUsed: Math.floor(Math.random() * 50) + 10
      }
    };

    return mockResponses[model] || mockResponses.flash;
  }

  /**
   * Private method to simulate network delay
   */
  async _simulateNetworkDelay() {
    const delay = Math.floor(Math.random() * 2000) + 500; // 500-2500ms
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Private method to prepare conversation context
   */
  _prepareConversationContext(message, context) {
    let prompt = `User message: ${message}\n\n`;
    
    if (context.tripId) {
      prompt += `Context: This is related to trip planning.\n`;
    }
    
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      prompt += `Previous conversation:\n`;
      context.conversationHistory.slice(-3).forEach(exchange => {
        prompt += `${exchange.role}: ${exchange.content}\n`;
      });
      prompt += `\n`;
    }
    
    prompt += `Please provide helpful trip planning advice.`;
    
    return prompt;
  }

  /**
   * Private method to prepare itinerary generation prompt
   */
  _prepareItineraryPrompt(trip, focus) {
    let prompt = `Generate a detailed itinerary for the following trip:\n\n`;
    prompt += `Destination: From ${trip.destination.origin} to ${trip.destination.destination}\n`;
    prompt += `Duration: ${trip.duration} days\n`;
    prompt += `Travelers: ${trip.travelers.adults} adults`;
    
    if (trip.travelers.children > 0) {
      prompt += `, ${trip.travelers.children} children`;
    }
    if (trip.travelers.infants > 0) {
      prompt += `, ${trip.travelers.infants} infants`;
    }
    
    prompt += `\n`;
    
    if (trip.budget && trip.budget.total) {
      prompt += `Budget: ${trip.budget.total} ${trip.budget.currency}\n`;
    }
    
    if (trip.preferences && trip.preferences.interests.length > 0) {
      prompt += `Interests: ${trip.preferences.interests.join(', ')}\n`;
    }
    
    if (trip.preferences && trip.preferences.constraints.length > 0) {
      prompt += `Constraints: ${trip.preferences.constraints.join(', ')}\n`;
    }
    
    if (focus) {
      prompt += `Focus: ${focus}\n`;
    }
    
    prompt += `\nPlease create a day-by-day itinerary with specific activities, times, and locations.`;
    
    return prompt;
  }

  /**
   * Private method to prepare optimization prompt
   */
  _prepareOptimizationPrompt(trip, focus) {
    let prompt = `Optimize the following trip schedule:\n\n`;
    prompt += `Current itinerary for ${trip.name}:\n`;
    
    trip.itinerary.days.forEach((day, index) => {
      prompt += `Day ${index + 1} (${day.date.toDateString()}):\n`;
      day.activities.forEach(activity => {
        prompt += `- ${activity.time}: ${activity.title} at ${activity.location.name}\n`;
      });
      prompt += `\n`;
    });
    
    if (focus) {
      prompt += `Optimization focus: ${focus}\n`;
    }
    
    prompt += `Please optimize this schedule for better flow and efficiency.`;
    
    return prompt;
  }

  /**
   * Private method to prepare validation prompt
   */
  _prepareValidationPrompt(trip, checkType) {
    let prompt = `Validate the following trip against user constraints:\n\n`;
    prompt += `Trip: ${trip.name}\n`;
    prompt += `Destination: ${trip.destination.destination}\n`;
    
    if (trip.preferences && trip.preferences.constraints.length > 0) {
      prompt += `User constraints: ${trip.preferences.constraints.join(', ')}\n`;
    }
    
    if (trip.budget && trip.budget.total) {
      prompt += `Budget: ${trip.budget.total} ${trip.budget.currency}\n`;
    }
    
    prompt += `Validation type: ${checkType}\n`;
    prompt += `Please identify any constraint violations or potential conflicts.`;
    
    return prompt;
  }

  /**
   * Private method to prepare activity suggestion prompt
   */
  _prepareSuggestionPrompt(trip, options) {
    let prompt = `Suggest activities `;
    
    if (trip) {
      prompt += `for a trip to ${trip.destination.destination} `;
    }
    
    if (options.date) {
      prompt += `on ${options.date} `;
    }
    
    if (options.timePeriod) {
      prompt += `during ${options.timePeriod} `;
    }
    
    prompt += `\n\n`;
    
    const interests = options.interests || (trip && trip.preferences.interests) || [];
    if (interests.length > 0) {
      prompt += `Interests: ${interests.join(', ')}\n`;
    }
    
    const constraints = options.constraints || (trip && trip.preferences.constraints) || [];
    if (constraints.length > 0) {
      prompt += `Constraints: ${constraints.join(', ')}\n`;
    }
    
    prompt += `Please suggest relevant activities with descriptions and practical information.`;
    
    return prompt;
  }

  /**
   * Private method to process itinerary response
   */
  _processItineraryResponse(content, trip) {
    // Mock processing - in production, parse structured AI response
    const days = [];
    const duration = trip.duration;
    const startDate = new Date(trip.destination.startDate);
    
    for (let i = 0; i < duration; i++) {
      const dayDate = new Date(startDate);
      dayDate.setDate(dayDate.getDate() + i);
      
      days.push({
        date: dayDate,
        activities: [
          {
            time: '09:00',
            title: `AI-generated morning activity for day ${i + 1}`,
            description: `Based on your preferences for ${trip.destination.destination}`,
            location: {
              name: trip.destination.destination,
              address: '',
              coordinates: { lat: 0, lng: 0 }
            },
            duration: 120,
            cost: 0,
            category: 'cultural',
            notes: 'Generated by Gemini AI'
          }
        ]
      });
    }
    
    return { days };
  }

  /**
   * Private method to process optimization response
   */
  _processOptimizationResponse(content, trip) {
    // Mock processing - return optimized version of existing itinerary
    return trip.itinerary;
  }

  /**
   * Private method to process validation response
   */
  _processValidationResponse(content) {
    // Mock validation results
    return {
      valid: true,
      violations: [],
      warnings: [],
      suggestions: ['Consider adding buffer time between activities']
    };
  }

  /**
   * Private method to process suggestion response
   */
  _processSuggestionResponse(content) {
    // Mock activity suggestions
    return [
      {
        title: 'AI-suggested Cultural Activity',
        description: 'Based on your interests and location',
        category: 'cultural',
        duration: 120,
        estimatedCost: 25,
        location: 'City Center',
        tags: ['popular', 'family-friendly']
      }
    ];
  }

  /**
   * Private method to log AI interactions
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
}

module.exports = new GeminiService();