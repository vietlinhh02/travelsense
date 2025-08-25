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

/**
 * @swagger
 * /api/v1/trips/{id}:
 *   get:
 *     summary: Get detailed trip information
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Trip ID
 *     responses:
 *       200:
 *         description: Trip details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 trip:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     destination:
 *                       type: object
 *                       properties:
 *                         origin:
 *                           type: string
 *                         destination:
 *                           type: string
 *                         startDate:
 *                           type: string
 *                           format: date
 *                         endDate:
 *                           type: string
 *                           format: date
 *                     duration:
 *                       type: integer
 *                     travelers:
 *                       type: object
 *                       properties:
 *                         adults:
 *                           type: integer
 *                         children:
 *                           type: integer
 *                         infants:
 *                           type: integer
 *                     budget:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: number
 *                         currency:
 *                           type: string
 *                     preferences:
 *                       type: object
 *                       properties:
 *                         interests:
 *                           type: array
 *                           items:
 *                             type: string
 *                         constraints:
 *                           type: array
 *                           items:
 *                             type: string
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
 *                                       type: integer
 *                                     cost:
 *                                       type: number
 *                                     category:
 *                                       type: string
 *                     status:
 *                       type: string
 *                       enum: [draft, planned, in-progress, completed]
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Access denied to trip
 *       404:
 *         description: Trip not found
 *       500:
 *         description: Server error
 */

// GET /trips/:id - Get Trip Details
router.get('/:id', authenticateToken, tripIdValidation, tripController.getTripDetails);

/**
 * @swagger
 * /api/v1/trips/{id}:
 *   put:
 *     summary: Update trip information
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Trip ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: Trip name
 *               destination:
 *                 type: object
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
 *                     description: Trip start date
 *                   endDate:
 *                     type: string
 *                     format: date
 *                     description: Trip end date
 *               travelers:
 *                 type: object
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
 *               status:
 *                 type: string
 *                 enum: [draft, planned, in-progress, completed]
 *                 description: Trip status
 *     responses:
 *       200:
 *         description: Trip updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 trip:
 *                   type: object
 *                   description: Updated trip object
 *       400:
 *         description: Bad request - Validation errors
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Access denied to trip
 *       404:
 *         description: Trip not found
 *       500:
 *         description: Server error
 */

// PUT /trips/:id - Update Trip
router.put('/:id', authenticateToken, tripIdValidation, updateTripValidation, tripController.updateTrip);

/**
 * @swagger
 * /api/v1/trips/{id}:
 *   delete:
 *     summary: Delete trip
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Trip ID
 *     responses:
 *       200:
 *         description: Trip deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Access denied to trip
 *       404:
 *         description: Trip not found
 *       500:
 *         description: Server error
 */

// DELETE /trips/:id - Delete Trip
router.delete('/:id', authenticateToken, tripIdValidation, tripController.deleteTrip);

/**
 * @swagger
 * /api/v1/trips/{id}/generate-draft:
 *   post:
 *     summary: Generate draft schedule for existing trip
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Trip ID
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               pace:
 *                 type: string
 *                 enum: [easy, balanced, intense]
 *                 description: Travel pace preference
 *               nightlife:
 *                 type: string
 *                 enum: [none, some, heavy]
 *                 description: Nightlife preference level
 *               dayStart:
 *                 type: string
 *                 pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                 description: Preferred day start time (HH:MM)
 *               dayEnd:
 *                 type: string
 *                 pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                 description: Preferred day end time (HH:MM)
 *               quietMorningAfterLateNight:
 *                 type: boolean
 *                 description: Schedule lighter mornings after late nights
 *               transportPrefs:
 *                 type: array
 *                 maxItems: 10
 *                 items:
 *                   type: string
 *                   maxLength: 50
 *                 description: Preferred transportation methods
 *               walkingLimitKm:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 20
 *                 description: Maximum walking distance in kilometers
 *               dietary:
 *                 type: array
 *                 maxItems: 10
 *                 items:
 *                   type: string
 *                   maxLength: 50
 *                 description: Dietary requirements
 *               mustSee:
 *                 type: array
 *                 maxItems: 20
 *                 items:
 *                   type: string
 *                   maxLength: 100
 *                 description: Must-visit attractions
 *               avoid:
 *                 type: array
 *                 maxItems: 20
 *                 items:
 *                   type: string
 *                   maxLength: 100
 *                 description: Places or activities to avoid
 *     responses:
 *       200:
 *         description: Draft schedule generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 itinerary:
 *                   type: object
 *                   properties:
 *                     days:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                           activities:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 time:
 *                                   type: string
 *                                 title:
 *                                   type: string
 *                                 description:
 *                                   type: string
 *                                 location:
 *                                   type: object
 *                                 duration:
 *                                   type: integer
 *                                 cost:
 *                                   type: number
 *                                 category:
 *                                   type: string
 *       400:
 *         description: Bad request - Trip already has itinerary or validation errors
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Access denied to trip
 *       404:
 *         description: Trip not found
 *       500:
 *         description: Server error
 */

// POST /trips/:id/generate-draft - Generate Draft Schedule
router.post('/:id/generate-draft', authenticateToken, generateDraftScheduleValidation, tripController.generateDraftSchedule);

/**
 * @swagger
 * /api/v1/trips/{id}/optimize:
 *   post:
 *     summary: Optimize existing trip schedule
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Trip ID
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
 *                 description: Optimization focus (e.g., "minimize travel time", "balance activities")
 *                 example: "minimize travel time between activities"
 *               constraints:
 *                 type: array
 *                 maxItems: 10
 *                 items:
 *                   type: string
 *                   maxLength: 100
 *                 description: Additional optimization constraints
 *     responses:
 *       200:
 *         description: Trip schedule optimized successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 optimizedItinerary:
 *                   type: object
 *                   properties:
 *                     days:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           date:
 *                             type: string
 *                             format: date
 *                           activities:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 time:
 *                                   type: string
 *                                 title:
 *                                   type: string
 *                                 description:
 *                                   type: string
 *                                 location:
 *                                   type: object
 *                                 duration:
 *                                   type: integer
 *                                 cost:
 *                                   type: number
 *                                 category:
 *                                   type: string
 *                 optimizationDetails:
 *                   type: object
 *                   properties:
 *                     focus:
 *                       type: string
 *                     improvements:
 *                       type: array
 *                       items:
 *                         type: string
 *                     travelTimeSaved:
 *                       type: integer
 *                       description: Time saved in minutes
 *       400:
 *         description: Bad request - No itinerary to optimize or validation errors
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Access denied to trip
 *       404:
 *         description: Trip not found
 *       500:
 *         description: Server error
 */

// POST /trips/:id/optimize - Optimize Trip
router.post('/:id/optimize', authenticateToken, optimizeTripValidation, tripController.optimizeTrip);

/**
 * @swagger
 * /api/v1/trips/{id}/export:
 *   post:
 *     summary: Export trip in various formats
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Trip ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - format
 *             properties:
 *               format:
 *                 type: string
 *                 enum: [pdf, json, csv, ical]
 *                 description: Export format
 *               include:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [itinerary, budget, notes, contacts]
 *                 description: What to include in export
 *                 example: ["itinerary", "budget", "notes"]
 *               language:
 *                 type: string
 *                 enum: [vi, en]
 *                 default: vi
 *                 description: Export language
 *     responses:
 *       200:
 *         description: Trip exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 downloadUrl:
 *                   type: string
 *                   description: URL to download the exported file
 *                 expiresAt:
 *                   type: string
 *                   format: date-time
 *                   description: When the download link expires
 *       400:
 *         description: Bad request - Validation errors or unsupported format
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Access denied to trip
 *       404:
 *         description: Trip not found
 *       500:
 *         description: Server error
 */

// POST /trips/:id/export - Export Trip
router.post('/:id/export', authenticateToken, exportTripValidation, tripController.exportTrip);

/**
 * @swagger
 * /api/v1/trips/{id}/days/{dayId}/activities:
 *   post:
 *     summary: Add activity to specific day
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Trip ID
 *       - in: path
 *         name: dayId
 *         required: true
 *         schema:
 *           type: string
 *         description: Day identifier (e.g., "2024-01-15")
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - time
 *               - title
 *             properties:
 *               time:
 *                 type: string
 *                 pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                 description: Activity time (HH:MM format)
 *                 example: "14:30"
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 description: Activity title
 *                 example: "Visit Eiffel Tower"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Activity description
 *               location:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     maxLength: 200
 *                     description: Location name
 *                   address:
 *                     type: string
 *                     maxLength: 500
 *                     description: Location address
 *                   latitude:
 *                     type: number
 *                     minimum: -90
 *                     maximum: 90
 *                     description: Latitude coordinate
 *                   longitude:
 *                     type: number
 *                     minimum: -180
 *                     maximum: 180
 *                     description: Longitude coordinate
 *               duration:
 *                 type: integer
 *                 minimum: 15
 *                 maximum: 1440
 *                 description: Duration in minutes
 *                 example: 120
 *               cost:
 *                 type: object
 *                 properties:
 *                   amount:
 *                     type: number
 *                     minimum: 0
 *                     description: Cost amount
 *                   currency:
 *                     type: string
 *                     pattern: '^[A-Z]{3}$'
 *                     description: Currency code
 *                     example: "EUR"
 *               category:
 *                 type: string
 *                 maxLength: 50
 *                 description: Activity category
 *                 example: "attraction"
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *                 description: Additional notes
 *               bookingRequired:
 *                 type: boolean
 *                 description: Whether booking is required
 *               bookingUrl:
 *                 type: string
 *                 maxLength: 500
 *                 description: URL for booking
 *     responses:
 *       200:
 *         description: Activity added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 activity:
 *                   type: object
 *                   description: Added activity object
 *                 day:
 *                   type: string
 *                   description: Day the activity was added to
 *       400:
 *         description: Bad request - Validation errors or time conflict
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Access denied to trip
 *       404:
 *         description: Trip or day not found
 *       500:
 *         description: Server error
 */

// POST /trips/:id/days/:dayId/activities - Add Activity to Day
router.post('/:id/days/:dayId/activities', authenticateToken, activityValidation, tripController.addActivityToDay);

/**
 * @swagger
 * /api/v1/trips/{id}/days/{dayId}/activities/{activityId}:
 *   put:
 *     summary: Update activity in specific day
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Trip ID
 *       - in: path
 *         name: dayId
 *         required: true
 *         schema:
 *           type: string
 *         description: Day identifier (e.g., "2024-01-15")
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
 *         description: Activity ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               time:
 *                 type: string
 *                 pattern: '^([01]?[0-9]|2[0-3]):[0-5][0-9]$'
 *                 description: Activity time (HH:MM format)
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 description: Activity title
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Activity description
 *               location:
 *                 type: object
 *                 properties:
 *                   name:
 *                     type: string
 *                     maxLength: 200
 *                     description: Location name
 *                   address:
 *                     type: string
 *                     maxLength: 500
 *                     description: Location address
 *                   latitude:
 *                     type: number
 *                     minimum: -90
 *                     maximum: 90
 *                     description: Latitude coordinate
 *                   longitude:
 *                     type: number
 *                     minimum: -180
 *                     maximum: 180
 *                     description: Longitude coordinate
 *               duration:
 *                 type: integer
 *                 minimum: 15
 *                 maximum: 1440
 *                 description: Duration in minutes
 *               cost:
 *                 type: object
 *                 properties:
 *                   amount:
 *                     type: number
 *                     minimum: 0
 *                     description: Cost amount
 *                   currency:
 *                     type: string
 *                     pattern: '^[A-Z]{3}$'
 *                     description: Currency code
 *               category:
 *                 type: string
 *                 maxLength: 50
 *                 description: Activity category
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *                 description: Additional notes
 *               bookingRequired:
 *                 type: boolean
 *                 description: Whether booking is required
 *               bookingUrl:
 *                 type: string
 *                 maxLength: 500
 *                 description: URL for booking
 *     responses:
 *       200:
 *         description: Activity updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 activity:
 *                   type: object
 *                   description: Updated activity object
 *                 day:
 *                   type: string
 *                   description: Day the activity belongs to
 *       400:
 *         description: Bad request - Validation errors or time conflict
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Access denied to trip
 *       404:
 *         description: Trip, day, or activity not found
 *       500:
 *         description: Server error
 */

// PUT /trips/:id/days/:dayId/activities/:activityId - Update Activity
router.put('/:id/days/:dayId/activities/:activityId', authenticateToken, updateActivityValidation, tripController.updateActivity);

/**
 * @swagger
 * /api/v1/trips/{id}/days/{dayId}/activities/{activityId}:
 *   delete:
 *     summary: Delete activity from specific day
 *     tags: [Trips]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Trip ID
 *       - in: path
 *         name: dayId
 *         required: true
 *         schema:
 *           type: string
 *         description: Day identifier (e.g., "2024-01-15")
 *       - in: path
 *         name: activityId
 *         required: true
 *         schema:
 *           type: string
 *         description: Activity ID
 *     responses:
 *       200:
 *         description: Activity deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 day:
 *                   type: string
 *                   description: Day the activity was removed from
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Access denied to trip
 *       404:
 *         description: Trip, day, or activity not found
 *       500:
 *         description: Server error
 */

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