const AIScheduleOptimizationService = require('./aiScheduleOptimization.service');
const AIConstraintValidationService = require('./aiConstraintValidation.service');
const AIItineraryAnalysisService = require('./aiItineraryAnalysis.service');

/**
 * AIItineraryService - Main orchestrator for itinerary post-generation operations
 * Delegates specialized tasks to focused service classes
 * 
 * Core Services:
 * - Schedule Optimization: Trip schedule optimization and improvements
 * - Constraint Validation: Trip feasibility and constraint checking
 * - Itinerary Analysis: Trip analysis and insights generation
 * 
 * Note: Primary itinerary generation is handled by AITripService
 */
class AIItineraryService {
  constructor() {
    // Initialize specialized services
    this.scheduleOptimizationService = new AIScheduleOptimizationService();
    this.constraintValidationService = new AIConstraintValidationService();
    this.itineraryAnalysisService = new AIItineraryAnalysisService();

    console.log('✅ AIItineraryService orchestrator initialized');
  }

  // ============================================
  // MAIN SERVICE DELEGATE METHODS
  // ============================================

  /**
   * Generate trip itinerary - DEPRECATED
   * @deprecated Use AITripService.generateItinerary() instead
   * @param {string} userId - User ID
   * @param {string} tripId - Trip ID
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Generated itinerary
   */
  async generateItinerary(userId, tripId, options = {}) {
    console.warn('⚠️ AIItineraryService.generateItinerary() is deprecated. Use AITripService.generateItinerary() instead.');
    
    // Delegate to AITripService for backward compatibility
    const AITripService = require('./aiTrip.service');
    const tripService = new AITripService();
    return await tripService.generateItinerary(userId, tripId, options);
  }

  /**
   * Optimize existing trip schedule - Delegate to optimization service
   * @param {string} userId - User ID
   * @param {string} tripId - Trip ID
   * @param {Object} options - Optimization options
   * @returns {Promise<Object>} Optimized schedule
   */
  async optimizeSchedule(userId, tripId, options = {}) {
    return await this.scheduleOptimizationService.optimizeSchedule(userId, tripId, options);
  }

  /**
   * Validate trip constraints - Delegate to validation service
   * @param {string} userId - User ID
   * @param {string} tripId - Trip ID
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} Validation results
   */
  async validateConstraints(userId, tripId, options = {}) {
    return await this.constraintValidationService.validateConstraints(userId, tripId, options);
  }

  /**
   * Analyze itinerary - Delegate to analysis service
   * @param {string} userId - User ID
   * @param {string} tripId - Trip ID
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Analysis results
   */
  async analyzeItinerary(userId, tripId, options = {}) {
    return await this.itineraryAnalysisService.analyzeItinerary(userId, tripId, options);
  }

  /**
   * Get trip statistics - Delegate to analysis service
   * @param {string} userId - User ID
   * @param {string} tripId - Trip ID
   * @returns {Promise<Object>} Trip statistics
   */
  async getTripStatistics(userId, tripId) {
    return await this.itineraryAnalysisService.getTripStatistics(userId, tripId);
  }

  /**
   * Generate trip recommendations - Delegate to analysis service
   * @param {string} userId - User ID
   * @param {string} tripId - Trip ID
   * @returns {Promise<Object>} Trip recommendations
   */
  async generateRecommendations(userId, tripId) {
    return await this.itineraryAnalysisService.generateRecommendations(userId, tripId);
  }
}

module.exports = AIItineraryService;
