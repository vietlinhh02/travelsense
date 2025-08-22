const express = require('express');
const router = express.Router();
const { tripController } = require('../../../controllers/trips');
const {
  createTripValidation,
  updateTripValidation,
  tripIdValidation,
  generateDraftScheduleValidation,
  optimizeTripValidation,
  exportTripValidation,
  activityValidation,
  updateActivityValidation,
  deleteActivityValidation,
  getTripsQueryValidation
} = require('../../../validations/trip.validation');
const { authenticateToken } = require('../../../validations/user.validation');

/**
 * @swagger
 * tags:
 *   name: Trips
 *   description: Trip management and itinerary planning endpoints
 */

/**
 * @swagger
 * /api/v1/trips:
 *   post:
 *     summary: Create a new trip
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - destination
 *               - travelers
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: Trip name
 *               destination:
 *                 type: object
 *                 required:
 *                   - origin
 *                   - destination
 *                   - startDate
 *                   - endDate
 *                 properties:
 *                   origin:
 *                     type: string
 *                     maxLength: 100
 *                     description: Starting location
 *                   destination:
 *                     type: string
 *                     maxLength: 100
 *                     description: Destination location
 *                   startDate:
 *                     type: string
 *                     format: date
 *                     description: Trip start date (cannot be in the past)
 *                   endDate:
 *                     type: string
 *                     format: date
 *                     description: Trip end date (must be after start date)
 *               travelers:
 *                 type: object
 *                 required:
 *                   - adults
 *                 properties:
 *                   adults:
 *                     type: number
 *                     minimum: 1
 *                     maximum: 20
 *                     description: Number of adults
 *                   children:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 20
 *                     description: Number of children
 *                   infants:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 20
 *                     description: Number of infants
 *               budget:
 *                 type: object
 *                 properties:
 *                   total:
 *                     type: number
 *                     minimum: 0
 *                     maximum: 1000000
 *                     description: Total budget amount
 *                   currency:
 *                     type: string
 *                     pattern: '^[A-Z]{3}$'
 *                     description: Currency code (ISO 4217)
 *               preferences:
 *                 type: object
 *                 properties:
 *                   interests:
 *                     type: array
 *                     maxItems: 20
 *                     items:
 *                       type: string
 *                       maxLength: 50
 *                     description: User interests
 *                   constraints:
 *                     type: array
 *                     maxItems: 10
 *                     items:
 *                       type: string
 *                       maxLength: 100
 *                     description: Travel constraints
 *                   specialRequests:
 *                     type: array
 *                     maxItems: 10
 *                     items:
 *                       type: string
 *                       maxLength: 200
 *                     description: Special requests
 *     responses:
 *       201:
 *         description: Trip created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 trip:
 *                   type: object
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
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   get:
 *     summary: Get user trips with optional filtering and pagination
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, planned, in-progress, completed]
 *         description: Filter trips by status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: number
 *           minimum: 1
 *           maximum: 50
 *           default: 10
 *         description: Number of trips to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: number
 *           minimum: 0
 *           default: 0
 *         description: Number of trips to skip for pagination
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, name, destination.startDate]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Trips retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 trips:
 *                   type: array
 *                 pagination:
 *                   type: object
 *       400:
 *         description: Bad request - Invalid query parameters
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

// POST /trips - Create Trip
router.post('/', authenticateToken, createTripValidation, tripController.createTrip);

// GET /trips - Get User Trips
router.get('/', authenticateToken, getTripsQueryValidation, tripController.getUserTrips);

// GET /trips/:id - Get Trip Details
router.get('/:id', authenticateToken, tripIdValidation, tripController.getTripDetails);

// PUT /trips/:id - Update Trip
router.put('/:id', authenticateToken, tripIdValidation, updateTripValidation, tripController.updateTrip);

// DELETE /trips/:id - Delete Trip
router.delete('/:id', authenticateToken, tripIdValidation, tripController.deleteTrip);

// POST /trips/:id/generate-draft - Generate Draft Schedule
router.post('/:id/generate-draft', authenticateToken, generateDraftScheduleValidation, tripController.generateDraftSchedule);

// POST /trips/:id/optimize - Optimize Trip
router.post('/:id/optimize', authenticateToken, optimizeTripValidation, tripController.optimizeTrip);

// POST /trips/:id/export - Export Trip
router.post('/:id/export', authenticateToken, exportTripValidation, tripController.exportTrip);

// POST /trips/:id/days/:dayId/activities - Add Activity to Day
router.post('/:id/days/:dayId/activities', authenticateToken, activityValidation, tripController.addActivityToDay);

// PUT /trips/:id/days/:dayId/activities/:activityId - Update Activity
router.put('/:id/days/:dayId/activities/:activityId', authenticateToken, updateActivityValidation, tripController.updateActivity);

// DELETE /trips/:id/days/:dayId/activities/:activityId - Delete Activity
router.delete('/:id/days/:dayId/activities/:activityId', authenticateToken, deleteActivityValidation, tripController.deleteActivity);

// Health check endpoint for trips service
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'trips'
  });
});

module.exports = router;