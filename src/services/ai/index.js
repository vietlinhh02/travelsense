// Core Services
const GeminiService = require('./core/gemini.service');
const AIChatService = require('./core/aiChat.service');
const AIValidationService = require('./core/aiValidation.service');

// Itinerary Services
const AITripService = require('./itinerary/aiTrip.service');
const AIActivityService = require('./itinerary/aiActivity.service');
const AIItineraryService = require('./itinerary/aiItinerary.service');
const AIScheduleOptimizationService = require('./itinerary/aiScheduleOptimization.service');
const AIConstraintValidationService = require('./itinerary/aiConstraintValidation.service');
const AIItineraryAnalysisService = require('./itinerary/aiItineraryAnalysis.service');

// Long Trip Handler Microservices
const LongTripHandlerService = require('./longtrip/longTripHandler.service');
const TripChunkingService = require('./longtrip/tripChunking.service');
const TokenEstimationService = require('./longtrip/tokenEstimation.service');
const ChunkedItineraryGenerationService = require('./longtrip/chunkedItineraryGeneration.service');
const FallbackGenerationService = require('./longtrip/fallbackGeneration.service');
const LocationUtilityService = require('./longtrip/locationUtility.service');

// Utility Services
const AISchemaService = require('./utils/aiSchema.service');
const ResponseParser = require('./utils/responseParser');
const PromptBuilder = require('./utils/promptBuilder');
const ActivityTemplateService = require('./utils/activityTemplateService');

// Client Services
const GeminiApiClient = require('./client/geminiApiClient');

// Create instances of AI services
const geminiApiClient = new GeminiApiClient();
const responseParser = new ResponseParser();
const promptBuilder = new PromptBuilder();
const activityTemplateService = new ActivityTemplateService();

// Create instances of long trip handler services FIRST
const longTripHandlerService = new LongTripHandlerService();
const tripChunkingService = new TripChunkingService();
const tokenEstimationService = new TokenEstimationService();
const chunkedItineraryGenerationService = new ChunkedItineraryGenerationService();
const fallbackGenerationService = new FallbackGenerationService();
const locationUtilityService = new LocationUtilityService();

// Initialize AI services with dependencies first
const aiTripService = new AITripService();
const aiActivityService = new AIActivityService();
const aiSchemaService = new AISchemaService();
const aiItineraryService = new AIItineraryService();
const aiScheduleOptimizationService = new AIScheduleOptimizationService();
const aiConstraintValidationService = new AIConstraintValidationService();
const aiItineraryAnalysisService = new AIItineraryAnalysisService();
const aiChatService = new AIChatService();
const aiValidationService = new AIValidationService();

// Initialize AI services with dependencies
const dependencies = {
  apiClient: geminiApiClient,
  responseParser: responseParser,
  promptBuilder: promptBuilder,
  templateService: activityTemplateService,
  longTripHandler: longTripHandlerService
};

// Initialize services that extend AIBaseService
[aiTripService, aiActivityService, aiItineraryService, 
 aiScheduleOptimizationService, aiConstraintValidationService, 
 aiItineraryAnalysisService, aiChatService, aiValidationService].forEach(service => {
  if (service.initialize) {
    service.initialize(dependencies);
  }
});

// Create GeminiService with initialized services and dependencies
const geminiService = new GeminiService({
  tripService: aiTripService,
  activityService: aiActivityService,
  itineraryService: aiItineraryService,
  schemaService: aiSchemaService,
  chatService: aiChatService,
  validationService: aiValidationService,
  apiClient: geminiApiClient,
  responseParser: responseParser,
  promptBuilder: promptBuilder,
  templateService: activityTemplateService,
  longTripHandler: longTripHandlerService
});

module.exports = {
  geminiService,
  aiTripService,
  aiActivityService,
  aiSchemaService,
  aiItineraryService,
  aiScheduleOptimizationService,
  aiConstraintValidationService,
  aiItineraryAnalysisService,
  aiChatService,
  aiValidationService,
  
  // API Client and utilities
  geminiApiClient,
  responseParser,
  promptBuilder,
  activityTemplateService,
  
  // Long trip handler service instances
  longTripHandlerService,
  tripChunkingService,
  tokenEstimationService,
  chunkedItineraryGenerationService,
  fallbackGenerationService,
  locationUtilityService,
  
  // Keep backward compatibility
  GeminiService,
  AITripService,
  AIActivityService,
  AISchemaService,
  AIItineraryService,
  AIScheduleOptimizationService,
  AIConstraintValidationService,
  AIItineraryAnalysisService,
  AIChatService,
  AIValidationService,
  
  // API Client and utility classes
  GeminiApiClient,
  ResponseParser,
  PromptBuilder,
  ActivityTemplateService,
  
  // Long trip handler service classes
  LongTripHandlerService,
  TripChunkingService,
  TokenEstimationService,
  ChunkedItineraryGenerationService,
  FallbackGenerationService,
  LocationUtilityService
};