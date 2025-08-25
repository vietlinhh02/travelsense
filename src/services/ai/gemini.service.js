const GeminiApiClient = require('./geminiApiClient');
const PromptBuilder = require('./promptBuilder');
const ResponseParser = require('./responseParser');
const ActivityTemplateService = require('./activityTemplateService');
const LongTripHandler = require('./longTripHandler');
const AIChatService = require('./aiChat.service');
const AIItineraryService = require('./aiItinerary.service');
const AIValidationService = require('./aiValidation.service');

/**
 * GeminiService - Main AI service combining all AI functionalities
 * Uses composition pattern with specialized service classes
 */
class GeminiService {
  constructor() {
    // Initialize core dependencies
    this.apiClient = new GeminiApiClient();
    this.promptBuilder = new PromptBuilder();
    this.responseParser = new ResponseParser();
    this.templateService = new ActivityTemplateService();
    this.longTripHandler = new LongTripHandler();

    // Initialize specialized services
    this.chatService = new AIChatService();
    this.itineraryService = new AIItineraryService();
    this.validationService = new AIValidationService();

    // Initialize services with dependencies
    this._initializeServices();
  }

  /**
   * Initialize all services with dependencies
   * @private
   */
  _initializeServices() {
    const dependencies = {
      apiClient: this.apiClient,
      promptBuilder: this.promptBuilder,
      responseParser: this.responseParser,
      templateService: this.templateService,
      longTripHandler: this.longTripHandler
    };

    this.chatService.initialize(dependencies);
    this.itineraryService.initialize(dependencies);
    this.validationService.initialize(dependencies);
  }

  // Delegate methods to specialized services

  /**
   * Extract trip information from chat message
   */
  async extractTripInfoFromChat(userId, chatData) {
    return await this.chatService.extractTripInfoFromChat(userId, chatData);
  }

  /**
   * Chat with AI
   */
  async chatWithAI(userId, chatData) {
    return await this.chatService.chatWithAI(userId, chatData);
  }

  /**
   * Generate trip itinerary
   */
  async generateItinerary(userId, tripId, options = {}) {
    return await this.itineraryService.generateItinerary(userId, tripId, options);
  }

  /**
   * Optimize trip schedule
   */
  async optimizeSchedule(userId, tripId, options = {}) {
    return await this.itineraryService.optimizeSchedule(userId, tripId, options);
  }

  /**
   * Validate trip constraints
   */
  async validateConstraints(userId, tripId, options = {}) {
    return await this.itineraryService.validateConstraints(userId, tripId, options);
  }

  /**
   * Generate activity suggestions
   */
  async generateActivitySuggestions(userId, suggestionData) {
    return await this.itineraryService.generateActivitySuggestions(userId, suggestionData);
  }

  /**
   * Get service health status
   */
  async getHealthStatus() {
    return await this.validationService.getHealthStatus();
  }

  /**
   * Get rate limit status
   */
  async getRateLimitStatus(userId) {
    return await this.validationService.getRateLimitStatus(userId);
  }

  /**
   * Get user AI interaction statistics
   */
  async getInteractionStats(userId, timeframe = 30) {
    return await this.validationService.getInteractionStats(userId, timeframe);
  }

  /**
   * Validate AI service configuration
   */
  async validateConfiguration() {
    return await this.validationService.validateConfiguration();
  }

  /**
   * Test AI service connectivity
   */
  async testConnectivity() {
    return await this.validationService.testConnectivity();
  }

  /**
   * Validate trip data structure
   */
  validateTripData(trip) {
    return this.validationService.validateTripData(trip);
  }

  /**
   * Validate itinerary structure
   */
  validateItineraryStructure(itinerary) {
    return this.validationService.validateItineraryStructure(itinerary);
  }
}

module.exports = GeminiService;