const express = require('express');
const router = express.Router();
const { aiController } = require('../../../controllers/ai');
const tripDraftController = require('../../../controllers/ai/tripDraft.controller');
const {
  extractTripInfoValidation,
  chatWithAIValidation,
  generateItineraryValidation,
  optimizeScheduleValidation,
  validateConstraintsValidation,
  suggestActivitiesValidation,
  getInteractionStatsValidation
} = require('../../../validations/ai.validation');
const { authenticateToken } = require('../../../validations/user.validation');

/**
 * @swagger
 * tags:
 *   name: AI
 *   description: AI-powered trip planning and assistance endpoints using Gemini API
 */

/**
 * @swagger
 * /api/v1/ai/extract-trip-info:
 *   post:
 *     summary: Extract trip information from natural language chat
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 1000
 *                 description: Natural language message describing trip plans
 *                 example: "Tôi muốn đi Tokyo 5 ngày với ngân sách 2000 USD, thích ăn sushi và thăm đền chùa"
 *               context:
 *                 type: object
 *                 properties:
 *                   intent:
 *                     type: string
 *                     enum: [create_trip, modify_trip, ask_info, other]
 *                     description: User intent for the conversation
 *               userDefaults:
 *                 type: object
 *                 properties:
 *                   language:
 *                     type: string
 *                     enum: [vi, en]
 *                     default: vi
 *                   timezone:
 *                     type: string
 *                     default: "Asia/Bangkok"
 *                   currency:
 *                     type: string
 *                     default: "VND"
 *     responses:
 *       200:
 *         description: Trip information extracted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Trip information extracted successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     language:
 *                       type: string
 *                     timezone:
 *                       type: string
 *                     currency:
 *                       type: string
 *                     intent:
 *                       type: string
 *                     extracted:
 *                       type: object
 *                       properties:
 *                         origin:
 *                           type: string
 *                         destinations:
 *                           type: array
 *                           items:
 *                             type: string
 *                         dates:
 *                           type: object
 *                           properties:
 *                             start:
 *                               type: string
 *                             end:
 *                               type: string
 *                         duration:
 *                           type: number
 *                         travelers:
 *                           type: object
 *                         budget:
 *                           type: object
 *                         interests:
 *                           type: array
 *                           items:
 *                             type: string
 *                         pace:
 *                           type: string
 *                           enum: [easy, balanced, intense]
 *                         nightlife:
 *                           type: string
 *                           enum: [none, some, heavy]
 *                         dayStart:
 *                           type: string
 *                         dayEnd:
 *                           type: string
 *                         quietMorningAfterLateNight:
 *                           type: boolean
 *                         transportPrefs:
 *                           type: array
 *                           items:
 *                             type: string
 *                         walkingLimitKm:
 *                           type: number
 *                         dietary:
 *                           type: array
 *                           items:
 *                             type: string
 *                         mustSee:
 *                           type: array
 *                           items:
 *                             type: string
 *                         avoid:
 *                           type: array
 *                           items:
 *                             type: string
 *                         notes:
 *                           type: string
 *                     missing:
 *                       type: array
 *                       items:
 *                         type: string
 *                     ambiguities:
 *                       type: array
 *                       items:
 *                         type: string
 *                     tokensUsed:
 *                       type: number
 *                     processingTime:
 *                       type: number
 *                     rateLimitRemaining:
 *                       type: number
 *       400:
 *         description: Bad request - Validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// POST /ai/extract-trip-info - Extract Trip Information from Chat
router.post('/extract-trip-info', authenticateToken, extractTripInfoValidation, aiController.extractTripInfo);

/**
 * @swagger
 * /api/v1/ai/chat:
 *   post:
 *     summary: Chat with AI for trip planning assistance
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2000
 *                 description: User message for AI chat
 *                 example: "I'm planning a 5-day trip to Tokyo. What are the must-see attractions?"
 *               context:
 *                 type: object
 *                 properties:
 *                   tripId:
 *                     type: string
 *                     format: objectId
 *                     description: Related trip ID for context-aware responses
 *                   conversationHistory:
 *                     type: array
 *                     maxItems: 10
 *                     items:
 *                       type: object
 *                       properties:
 *                         role:
 *                           type: string
 *                           enum: [user, assistant]
 *                         content:
 *                           type: string
 *                     description: Previous conversation messages for context
 *               model:
 *                 type: string
 *                 enum: [flash, pro]
 *                 default: flash
 *                 description: AI model to use (flash for quick responses, pro for detailed analysis)
 *     responses:
 *       200:
 *         description: AI chat response generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "AI chat completed successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     content:
 *                       type: string
 *                       description: AI generated response
 *                     model:
 *                       type: string
 *                       description: Model used for generation
 *                     tokensUsed:
 *                       type: number
 *                       description: Number of tokens consumed
 *                     processingTime:
 *                       type: number
 *                       description: Response time in milliseconds
 *                     rateLimitRemaining:
 *                       type: number
 *                       description: Remaining API calls for this time window
 *       400:
 *         description: Bad request - Validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// POST /ai/chat - Chat with AI
router.post('/chat', authenticateToken, chatWithAIValidation, aiController.chatWithAI);

/**
 * @swagger
 * /api/v1/ai/trips/{tripId}/generate-itinerary:
 *   post:
 *     summary: Generate detailed trip itinerary using AI
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *         description: Trip ID to generate itinerary for
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               focus:
 *                 type: string
 *                 maxLength: 200
 *                 description: Specific focus for itinerary generation
 *                 example: "family-friendly activities with cultural experiences"
 *               pace:
 *                 type: string
 *                 enum: [easy, balanced, intense]
 *                 description: Travel pace preference (easy=relaxed, balanced=moderate, intense=packed)
 *                 example: "balanced"
 *               nightlife:
 *                 type: string
 *                 enum: [none, some, heavy]
 *                 description: Nightlife preference level
 *                 example: "some"
 *               dayStart:
 *                 type: string
 *                 pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
 *                 description: Preferred day start time (HH:MM format)
 *                 example: "09:00"
 *               dayEnd:
 *                 type: string
 *                 pattern: "^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
 *                 description: Preferred day end time (HH:MM format)
 *                 example: "22:00"
 *               quietMorningAfterLateNight:
 *                 type: boolean
 *                 description: Whether to schedule lighter mornings after late nights
 *                 example: true
 *               transportPrefs:
 *                 type: array
 *                 maxItems: 10
 *                 items:
 *                   type: string
 *                   maxLength: 50
 *                 description: Preferred transportation methods
 *                 example: ["metro", "taxi", "walk"]
 *               walkingLimitKm:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 20
 *                 description: Maximum walking distance in kilometers
 *                 example: 5
 *               dietary:
 *                 type: array
 *                 maxItems: 10
 *                 items:
 *                   type: string
 *                   maxLength: 50
 *                 description: Dietary requirements or preferences
 *                 example: ["vegetarian", "halal", "gluten-free"]
 *               mustSee:
 *                 type: array
 *                 maxItems: 20
 *                 items:
 *                   type: string
 *                   maxLength: 100
 *                 description: Must-visit attractions or experiences
 *                 example: ["Eiffel Tower", "Louvre Museum", "Seine River Cruise"]
 *               avoid:
 *                 type: array
 *                 maxItems: 20
 *                 items:
 *                   type: string
 *                   maxLength: 100
 *                 description: Places or activities to avoid
 *                 example: ["crowded tourist spots", "spicy food", "early mornings"]
 *     responses:
 *       200:
 *         description: Itinerary generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Itinerary generated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     itinerary:
 *                       type: object
 *                       properties:
 *                         days:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               date:
 *                                 type: string
 *                                 format: date
 *                               activities:
 *                                 type: array
 *                                 items:
 *                                   type: object
 *                                   properties:
 *                                     time:
 *                                       type: string
 *                                     title:
 *                                       type: string
 *                                     description:
 *                                       type: string
 *                                     location:
 *                                       type: object
 *                                     duration:
 *                                       type: number
 *                                     cost:
 *                                       type: number
 *                                     category:
 *                                       type: string
 *                     tokensUsed:
 *                       type: number
 *                     processingTime:
 *                       type: number
 *                     rateLimitRemaining:
 *                       type: number
 *       400:
 *         description: Bad request - Trip already has itinerary or validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Access denied to trip
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Trip not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// POST /ai/trips/:tripId/generate-itinerary - Generate Trip Itinerary
router.post('/trips/:tripId/generate-itinerary', authenticateToken, generateItineraryValidation, aiController.generateItinerary);

/**
 * @swagger
 * /api/v1/ai/trips/{tripId}/optimize-schedule:
 *   post:
 *     summary: Optimize existing trip schedule using AI
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *         description: Trip ID to optimize schedule for
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               focus:
 *                 type: string
 *                 maxLength: 200
 *                 description: Optimization focus
 *                 example: "minimize travel time between activities"
 *     responses:
 *       200:
 *         description: Schedule optimized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Schedule optimized successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     optimizedSchedule:
 *                       type: object
 *                       description: Optimized itinerary structure
 *                     tokensUsed:
 *                       type: number
 *                     processingTime:
 *                       type: number
 *                     rateLimitRemaining:
 *                       type: number
 *       400:
 *         description: Bad request - No itinerary to optimize or validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Access denied to trip
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Trip not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// POST /ai/trips/:tripId/optimize-schedule - Optimize Trip Schedule
router.post('/trips/:tripId/optimize-schedule', authenticateToken, optimizeScheduleValidation, aiController.optimizeSchedule);

/**
 * @swagger
 * /api/v1/ai/trips/{tripId}/validate-constraints:
 *   post:
 *     summary: Validate trip against user constraints using AI
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: tripId
 *         required: true
 *         schema:
 *           type: string
 *           format: objectId
 *         description: Trip ID to validate constraints for
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               checkType:
 *                 type: string
 *                 enum: [all, budget, schedule, preferences, logistics]
 *                 default: all
 *                 description: Type of constraint validation to perform
 *     responses:
 *       200:
 *         description: Constraints validated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Constraints validated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     validationResults:
 *                       type: object
 *                       properties:
 *                         valid:
 *                           type: boolean
 *                           description: Overall validation status
 *                         violations:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: List of constraint violations
 *                         warnings:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: List of potential issues
 *                         suggestions:
 *                           type: array
 *                           items:
 *                             type: string
 *                           description: AI-generated improvement suggestions
 *                     tokensUsed:
 *                       type: number
 *                     processingTime:
 *                       type: number
 *                     rateLimitRemaining:
 *                       type: number
 *       400:
 *         description: Bad request - Validation errors
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Access denied to trip
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Trip not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// POST /ai/trips/:tripId/validate-constraints - Validate Trip Constraints
router.post('/trips/:tripId/validate-constraints', authenticateToken, validateConstraintsValidation, aiController.validateConstraints);

/**
 * @swagger
 * /api/v1/ai/suggest-activities:
 *   post:
 *     summary: Generate activity suggestions using AI
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tripId:
 *                 type: string
 *                 format: objectId
 *                 description: Optional trip ID for context-aware suggestions
 *               date:
 *                 type: string
 *                 format: date
 *                 description: Specific date for activity suggestions
 *               timePeriod:
 *                 type: string
 *                 enum: [morning, afternoon, evening, night, full-day]
 *                 description: Time period for activities
 *               interests:
 *                 type: array
 *                 maxItems: 20
 *                 items:
 *                   type: string
 *                   maxLength: 50
 *                 description: User interests for activity suggestions
 *                 example: ["museums", "local cuisine", "photography"]
 *               constraints:
 *                 type: array
 *                 maxItems: 10
 *                 items:
 *                   type: string
 *                   maxLength: 100
 *                 description: Activity constraints
 *                 example: ["wheelchair accessible", "budget under $50", "indoor activities"]
 *     responses:
 *       200:
 *         description: Activity suggestions generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Activity suggestions generated successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           title:
 *                             type: string
 *                           description:
 *                             type: string
 *                           category:
 *                             type: string
 *                           duration:
 *                             type: number
 *                           estimatedCost:
 *                             type: number
 *                           location:
 *                             type: string
 *                           tags:
 *                             type: array
 *                             items:
 *                               type: string
 *                     tokensUsed:
 *                       type: number
 *                     processingTime:
 *                       type: number
 *                     rateLimitRemaining:
 *                       type: number
 *       400:
 *         description: Bad request - Validation errors or date outside trip range
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Access denied to trip
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Trip not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// POST /ai/suggest-activities - Generate Activity Suggestions
router.post('/suggest-activities', authenticateToken, suggestActivitiesValidation, aiController.suggestActivities);

/**
 * @swagger
 * /api/v1/ai/rate-limits:
 *   get:
 *     summary: Get current rate limit status for AI services
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Rate limit status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Rate limit status retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     rateLimits:
 *                       type: object
 *                       properties:
 *                         flash:
 *                           type: object
 *                           properties:
 *                             limit:
 *                               type: number
 *                               description: Requests per minute limit
 *                             remaining:
 *                               type: number
 *                               description: Remaining requests in current window
 *                             resetTime:
 *                               type: string
 *                               format: date-time
 *                               description: When the rate limit resets
 *                         pro:
 *                           type: object
 *                           properties:
 *                             limit:
 *                               type: number
 *                             remaining:
 *                               type: number
 *                             resetTime:
 *                               type: string
 *                               format: date-time
 *                         embeddings:
 *                           type: object
 *                           properties:
 *                             limit:
 *                               type: number
 *                             remaining:
 *                               type: number
 *                             resetTime:
 *                               type: string
 *                               format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// GET /ai/rate-limits - Get Rate Limit Status
router.get('/rate-limits', authenticateToken, aiController.getRateLimitStatus);

/**
 * @swagger
 * /api/v1/ai/stats:
 *   get:
 *     summary: Get user AI interaction statistics
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 365
 *           default: 30
 *         description: Number of days to include in statistics
 *     responses:
 *       200:
 *         description: Interaction statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Interaction statistics retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     stats:
 *                       type: object
 *                       properties:
 *                         totalInteractions:
 *                           type: number
 *                           description: Total number of AI interactions
 *                         totalTokensUsed:
 *                           type: number
 *                           description: Total tokens consumed
 *                         averageProcessingTime:
 *                           type: number
 *                           description: Average response time in milliseconds
 *                         successRate:
 *                           type: number
 *                           description: Success rate percentage
 *                         endpointBreakdown:
 *                           type: object
 *                           description: Usage breakdown by endpoint
 *                         modelBreakdown:
 *                           type: object
 *                           description: Usage breakdown by AI model
 *                         dailyUsage:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               date:
 *                                 type: string
 *                                 format: date
 *                               interactions:
 *                                 type: number
 *                               tokens:
 *                                 type: number
 *       400:
 *         description: Bad request - Invalid timeframe parameter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// GET /ai/stats - Get AI Interaction Statistics
router.get('/stats', authenticateToken, getInteractionStatsValidation, aiController.getInteractionStats);

/**
 * @swagger
 * /api/v1/ai/health:
 *   get:
 *     summary: Get AI service health status
 *     tags: [AI]
 *     responses:
 *       200:
 *         description: AI service health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "AI service is healthy"
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     services:
 *                       type: object
 *                       properties:
 *                         geminiFlash:
 *                           type: string
 *                           enum: [available, unavailable, limited]
 *                         geminiPro:
 *                           type: string
 *                           enum: [available, unavailable, limited]
 *                         embeddings:
 *                           type: string
 *                           enum: [available, unavailable, limited]
 *                     rateLimits:
 *                       type: object
 *                       properties:
 *                         flash:
 *                           type: object
 *                           properties:
 *                             requestsPerMinute:
 *                               type: number
 *                         pro:
 *                           type: object
 *                           properties:
 *                             requestsPerMinute:
 *                               type: number
 *                         embeddings:
 *                           type: object
 *                           properties:
 *                             requestsPerMinute:
 *                               type: number
 *       500:
 *         description: AI service is unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

// GET /ai/health - AI Service Health Check
router.get('/health', aiController.getHealthStatus);

/**
 * @swagger
 * /api/v1/ai/drafts:
 *   get:
 *     summary: Get user's active trip drafts
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active drafts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Active drafts retrieved successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     drafts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           sessionId:
 *                             type: string
 *                           status:
 *                             type: string
 *                           readinessScore:
 *                             type: number
 *                           extracted:
 *                             type: object
 *                           missing:
 *                             type: array
 *                             items:
 *                               type: string
 *                           isReady:
 *                             type: boolean
 *                           nextQuestion:
 *                             type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */

// GET /ai/drafts - Get User's Active Drafts
router.get('/drafts', authenticateToken, tripDraftController.getUserActiveDrafts);

/**
 * @swagger
 * /api/v1/ai/drafts/{draftId}:
 *   get:
 *     summary: Get specific draft by ID
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: draftId
 *         required: true
 *         schema:
 *           type: string
 *         description: Draft ID
 *     responses:
 *       200:
 *         description: Draft retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Draft not found
 *       500:
 *         description: Server error
 */

// GET /ai/drafts/:draftId - Get Draft by ID
router.get('/drafts/:draftId', authenticateToken, tripDraftController.getDraftById);

/**
 * @swagger
 * /api/v1/ai/drafts/{draftId}/materialize:
 *   post:
 *     summary: Materialize draft into actual trip
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: draftId
 *         required: true
 *         schema:
 *           type: string
 *         description: Draft ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tripData:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                   itinerary:
 *                     type: object
 *     responses:
 *       200:
 *         description: Trip created successfully
 *       400:
 *         description: Draft not ready for trip creation
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Draft not found
 *       500:
 *         description: Server error
 */

// POST /ai/drafts/:draftId/materialize - Materialize Draft
router.post('/drafts/:draftId/materialize', authenticateToken, tripDraftController.materializeDraft);

/**
 * @swagger
 * /api/v1/ai/drafts/{draftId}:
 *   delete:
 *     summary: Delete draft
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: draftId
 *         required: true
 *         schema:
 *           type: string
 *         description: Draft ID
 *     responses:
 *       200:
 *         description: Draft deleted successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Draft not found
 *       500:
 *         description: Server error
 */

// DELETE /ai/drafts/:draftId - Delete Draft
router.delete('/drafts/:draftId', authenticateToken, tripDraftController.deleteDraft);

module.exports = router;