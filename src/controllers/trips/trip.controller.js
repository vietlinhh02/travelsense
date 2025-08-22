const { validationResult } = require('express-validator');
const { tripService } = require('../../services/trips');
const { responseService } = require('../../services/common');

// Create Trip
const createTrip = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Extract fields from request body
    const { name, destination, travelers, budget, preferences } = req.body;

    // Create trip using service
    const trip = await tripService.createTrip(userId, {
      name,
      destination,
      travelers,
      budget,
      preferences
    });

    console.log(`Trip created successfully: ${trip.name} for user ${userId}`);
    
    responseService.sendSuccess(res, { trip }, 'Trip created successfully', 201);
  } catch (error) {
    console.error('Create trip error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Get User Trips
const getUserTrips = async (req, res) => {
  try {
    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Extract query parameters
    const { status, limit, offset, sortBy, sortOrder } = req.query;

    // Get trips using service
    const result = await tripService.getUserTrips(userId, {
      status,
      limit,
      offset,
      sortBy,
      sortOrder
    });

    console.log(`Retrieved ${result.trips.length} trips for user ${userId}`);
    
    responseService.sendSuccess(res, result);
  } catch (error) {
    console.error('Get user trips error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Get Trip Details
const getTripDetails = async (req, res) => {
  try {
    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Extract trip ID from URL parameters
    const { id: tripId } = req.params;

    // Get trip details using service
    const trip = await tripService.getTripDetails(tripId, userId);

    console.log(`Trip details retrieved: ${trip.name} for user ${userId}`);
    
    responseService.sendSuccess(res, { trip });
  } catch (error) {
    console.error('Get trip details error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Update Trip
const updateTrip = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Extract trip ID from URL parameters
    const { id: tripId } = req.params;

    // Extract fields from request body
    const { name, destination, travelers, budget, preferences } = req.body;

    // Update trip using service
    const trip = await tripService.updateTrip(tripId, userId, {
      name,
      destination,
      travelers,
      budget,
      preferences
    });

    console.log(`Trip updated successfully: ${trip.name} for user ${userId}`);
    
    responseService.sendSuccess(res, { trip }, 'Trip updated successfully');
  } catch (error) {
    console.error('Update trip error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Delete Trip
const deleteTrip = async (req, res) => {
  try {
    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Extract trip ID from URL parameters
    const { id: tripId } = req.params;

    // Delete trip using service
    await tripService.deleteTrip(tripId, userId);

    console.log(`Trip deleted successfully: ${tripId} for user ${userId}`);
    
    // Return 204 No Content (successful deletion)
    res.status(204).send();
  } catch (error) {
    console.error('Delete trip error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Generate Draft Schedule
const generateDraftSchedule = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Extract trip ID from URL parameters
    const { id: tripId } = req.params;

    // Extract fields from request body
    const { focus } = req.body;

    // Generate draft schedule using service
    const trip = await tripService.generateDraftSchedule(tripId, userId, { focus });

    console.log(`Draft schedule generated for trip: ${trip.name} for user ${userId}`);
    
    responseService.sendSuccess(res, { trip }, 'Draft schedule generated successfully');
  } catch (error) {
    console.error('Generate draft schedule error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Optimize Trip
const optimizeTrip = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Extract trip ID from URL parameters
    const { id: tripId } = req.params;

    // Extract fields from request body
    const { focus } = req.body;

    // Optimize trip using service
    const trip = await tripService.optimizeTrip(tripId, userId, { focus });

    console.log(`Trip optimized successfully: ${trip.name} for user ${userId}`);
    
    responseService.sendSuccess(res, { trip }, 'Trip optimized successfully');
  } catch (error) {
    console.error('Optimize trip error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Export Trip
const exportTrip = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Extract trip ID from URL parameters
    const { id: tripId } = req.params;

    // Extract fields from request body
    const { format, options } = req.body;

    // Export trip using service
    const exportData = await tripService.exportTrip(tripId, userId, {
      format,
      ...options
    });

    console.log(`Trip exported successfully: ${tripId} in ${format} format for user ${userId}`);
    
    responseService.sendSuccess(res, exportData, `Trip exported successfully in ${format} format`);
  } catch (error) {
    console.error('Export trip error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Add Activity to Day
const addActivityToDay = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Extract IDs from URL parameters
    const { id: tripId, dayId } = req.params;

    // Extract activity data from request body
    const activityData = req.body;

    // Add activity using service
    const trip = await tripService.addActivityToDay(tripId, userId, dayId, activityData);

    console.log(`Activity added to trip: ${tripId} for user ${userId}`);
    
    responseService.sendSuccess(res, { trip }, 'Activity added successfully');
  } catch (error) {
    console.error('Add activity error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Update Activity
const updateActivity = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const firstError = errors.array()[0];
      return responseService.sendError(res, firstError.msg, 400);
    }

    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Extract IDs from URL parameters
    const { id: tripId, dayId, activityId } = req.params;

    // Extract update data from request body
    const updateData = req.body;

    // Update activity using service
    const trip = await tripService.updateActivity(tripId, userId, dayId, activityId, updateData);

    console.log(`Activity updated in trip: ${tripId} for user ${userId}`);
    
    responseService.sendSuccess(res, { trip }, 'Activity updated successfully');
  } catch (error) {
    console.error('Update activity error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

// Delete Activity
const deleteActivity = async (req, res) => {
  try {
    // User ID comes from JWT token (set by authenticateToken middleware)
    const userId = req.user.userId;

    // Extract IDs from URL parameters
    const { id: tripId, dayId, activityId } = req.params;

    // Delete activity using service
    const trip = await tripService.deleteActivity(tripId, userId, dayId, activityId);

    console.log(`Activity deleted from trip: ${tripId} for user ${userId}`);
    
    responseService.sendSuccess(res, { trip }, 'Activity deleted successfully');
  } catch (error) {
    console.error('Delete activity error:', error);
    responseService.handleServiceError(res, error, 'Server error');
  }
};

module.exports = {
  createTrip,
  getUserTrips,
  getTripDetails,
  updateTrip,
  deleteTrip,
  generateDraftSchedule,
  optimizeTrip,
  exportTrip,
  addActivityToDay,
  updateActivity,
  deleteActivity
};