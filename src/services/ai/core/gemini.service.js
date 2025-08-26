const AIChatService = require('./aiChat.service');
const AIItineraryService = require('../itinerary/aiItinerary.service');
const AIValidationService = require('./aiValidation.service');
const AITripService = require('../itinerary/aiTrip.service');
const AIActivityService = require('../itinerary/aiActivity.service');
const AISchemaService = require('../utils/aiSchema.service');

/**
 * GeminiService - Main AI service orchestrator
 * Delegates specialized tasks to focused service classes
 * 
 * Core Services:
 * - Chat: AI conversations and message processing
 * - Trip: Itinerary generation and trip management
 * - Activity: Activity suggestions and recommendations
 * - Validation: Health checks and validation
 * - Schema: Structured output templates and schemas
 */
class GeminiService {
  constructor(services = {}) {
    // Use provided services or create new instances
    this.chatService = services.chatService || new AIChatService();
    this.itineraryService = services.itineraryService || new AIItineraryService();
    this.validationService = services.validationService || new AIValidationService();
    this.tripService = services.tripService || new AITripService();
    this.activityService = services.activityService || new AIActivityService();
    this.schemaService = services.schemaService || new AISchemaService();

    // Initialize services with dependencies if provided
    if (services.apiClient) {
      this._initializeServicesWithDependencies(services);
    } else {
      this._initializeServices();
    }
  }

  /**
   * Initialize all services with dependencies
   * @private
   */
  _initializeServices() {
    // Services are already initialized and self-contained
    console.log('✅ All AI services initialized successfully');
  }

  /**
   * Initialize services with provided dependencies
   * @private
   */
  _initializeServicesWithDependencies(services) {
    const dependencies = {
      apiClient: services.apiClient,
      responseParser: services.responseParser,
      promptBuilder: services.promptBuilder,
      templateService: services.templateService,
      longTripHandler: services.longTripHandler
    };

    console.log('🔧 Initializing GeminiService dependencies...');

    // Initialize services that extend AIBaseService and have initialize method
    const servicesToInitialize = [
      this.tripService, 
      this.activityService, 
      this.itineraryService,
      this.chatService,
      this.validationService
    ];

    servicesToInitialize.forEach(service => {
      if (service && typeof service.initialize === 'function') {
        service.initialize(dependencies);
      } else {
        console.warn(`⚠️ Service ${service?.constructor?.name || 'unknown'} does not have initialize method`);
      }
    });

    console.log('✅ All AI services initialized with dependencies');
  }

  // ============================================
  // MAIN SERVICE DELEGATE METHODS
  // ============================================

  /**
   * Chat with AI - Delegate to chat service
   */
  async chatWithAI(userId, chatData) {
    return await this.chatService.chatWithAI(userId, chatData);
  }

  /**
   * Generate trip itinerary - Delegate to trip service
   */
  async generateItinerary(userId, tripId, options = {}) {
    return await this.tripService.generateItinerary(userId, tripId, options);
  }

  /**
   * Optimize trip schedule - Delegate to itinerary service
   */
  async optimizeSchedule(userId, tripId, options = {}) {
    return await this.itineraryService.optimizeSchedule(userId, tripId, options);
  }

  /**
   * Validate trip constraints - Delegate to itinerary service
   */
  async validateConstraints(userId, tripId, options = {}) {
    return await this.itineraryService.validateConstraints(userId, tripId, options);
  }

  /**
   * Generate activity suggestions - Delegate to activity service
   */
  async generateActivitySuggestions(userId, suggestionData) {
    return await this.activityService.generateActivitySuggestions(userId, suggestionData);
  }

  /**
   * Update trip information from chat message - Delegate to chat service
   */
  async updateTripInfoFromChat(userId, tripId, message) {
    return await this.chatService.updateTripInfoFromChat(userId, tripId, message);
  }

  /**
   * Get service health status - Delegate to validation service
   */
  async getHealthStatus() {
    return await this.validationService.getHealthStatus();
  }

  /**
   * Get rate limit status - Delegate to validation service
   */
  async getRateLimitStatus(userId) {
    return await this.validationService.getRateLimitStatus(userId);
  }

  /**
   * Get user AI interaction statistics - Delegate to validation service
   */
  async getInteractionStats(userId, timeframe = 30) {
    return await this.validationService.getInteractionStats(userId, timeframe);
  }

  /**
   * Classify content using enum - Delegate to activity service
   */
  async classifyWithEnum(content, categories) {
    return await this.activityService.classifyWithEnum(content, categories);
  }

  // ============================================
  // SCHEMA METHODS - Delegate to schema service
  // ============================================

  /**
   * Create a custom schema for JSON output
   */
  createJSONSchema(schemaDefinition) {
    return this.schemaService.createJSONSchema(schemaDefinition);
  }

  /**
   * Create an enum schema for single value selection
   */
  createEnumSchema(enumValues) {
    return this.schemaService.createEnumSchema(enumValues);
  }

  /**
   * Get a predefined template by name
   */
  getTemplate(templateName) {
    return this.schemaService.getTemplate(templateName);
  }

  /**
   * Create an array schema with specified item type
   */
  createArraySchema(itemSchema, options = {}) {
    return this.schemaService.createArraySchema(itemSchema, options);
  }

  /**
   * Create an object schema with specified properties
   */
  createObjectSchema(properties, required = [], propertyOrdering = null) {
    return this.schemaService.createObjectSchema(properties, required, propertyOrdering);
  }

  /**
   * Create a complete itinerary schema with date validation
   */
  createItinerarySchema(maxDays = 14, validDates = null) {
    return this.schemaService.createItinerarySchema(maxDays, validDates);
  }

  /**
   * Get common enums
   */
  getEnum(enumType) {
    return this.schemaService.getEnum(enumType);
  }
}

module.exports = GeminiService;