/**
 * AIBaseService - Base AI service class with common functionality
 * Provides shared methods for all AI services
 */
class AIBaseService {
  constructor() {
    this.apiClient = null;
    this.promptBuilder = null;
    this.responseParser = null;
    this.templateService = null;
    this.longTripHandler = null;
  }

  /**
   * Initialize service with dependencies
   * @param {Object} dependencies - Service dependencies
   */
  initialize(dependencies = {}) {
    this.apiClient = dependencies.apiClient;
    this.promptBuilder = dependencies.promptBuilder;
    this.responseParser = dependencies.responseParser;
    this.templateService = dependencies.templateService;
    this.longTripHandler = dependencies.longTripHandler;
  }

  /**
   * Call Gemini API with fallback handling
   * @param {string} model - Model type
   * @param {string} prompt - Prompt to send
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} API response
   */
  async _callGeminiAPI(model, prompt, options = {}) {
    return await this.apiClient.callGeminiAPI(model, prompt, options);
  }

  /**
   * Log AI interaction
   * @param {Object} logData - Log data
   */
  async _logInteraction(logData) {
    // This will be implemented by extending class
    console.log('AI Interaction:', logData.endpoint, logData.model);
  }

  /**
   * Generate standard itinerary (helper method)
   * @param {Object} trip - Trip object
   * @param {string} focus - Focus for generation
   * @returns {Promise<Object>} Generated itinerary
   */
  async _generateStandardItinerary(trip, focus) {
    // Prepare structured prompt using PromptBuilder
    const prompt = this.promptBuilder.buildItineraryPrompt(trip, { focus });

    // Call Gemini Pro for structured output
    const response = await this._callGeminiAPI('flash', prompt);

    // Process AI response using ResponseParser and fallback to templates
    let itinerary;
    try {
      itinerary = this.responseParser.processItineraryResponse(response.content, trip);
    } catch (fallbackError) {
      console.warn('AI response parsing failed:', fallbackError.message);
      console.log(' Using ActivityTemplateService as fallback for standard itinerary generation...');
      itinerary = this.templateService.generateTemplateBasedItinerary(trip);
    }

    return itinerary;
  }
}

module.exports = AIBaseService;
