const { Trip } = require('../../models/trips');
const crypto = require('crypto');

class TripService {
  /**
   * Create a new trip
   * @param {string} userId - User ID creating the trip
   * @param {Object} tripData - Trip creation data
   * @returns {Promise<Object>} Created trip data
   */
  async createTrip(userId, tripData) {
    try {
      // Validate that start date is before end date
      const startDate = new Date(tripData.destination.startDate);
      const endDate = new Date(tripData.destination.endDate);
      
      if (startDate >= endDate) {
        throw new Error('START_DATE_AFTER_END_DATE');
      }
      
      // Validate that start date is not in the past (allow same day)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (startDate < today) {
        throw new Error('START_DATE_IN_PAST');
      }
      
      // Create trip with user ID
      const trip = new Trip({
        ...tripData,
        userId,
        status: 'draft',
        itinerary: {
          days: []
        }
      });
      
      await trip.save();
      
      return trip.toPublicJSON();
    } catch (error) {
      if (error.name === 'ValidationError') {
        // Extract first validation error
        const firstError = Object.values(error.errors)[0];
        throw new Error(`VALIDATION_ERROR: ${firstError.message}`);
      }
      throw error;
    }
  }

  /**
   * Get trips for a user with optional filtering and pagination
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Trips list with pagination metadata
   */
  async getUserTrips(userId, options = {}) {
    try {
      const {
        status,
        limit = 10,
        offset = 0,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = options;
      
      // Validate status parameter
      if (status && !['draft', 'planned', 'in-progress', 'completed'].includes(status)) {
        throw new Error('INVALID_STATUS');
      }
      
      // Validate limit parameter
      const parsedLimit = parseInt(limit);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
        throw new Error('INVALID_LIMIT');
      }
      const parsedOffset = Math.max(parseInt(offset), 0);
      
      // Validate sortBy parameter
      const validSortFields = ['createdAt', 'updatedAt', 'name', 'destination.startDate'];
      if (!validSortFields.includes(sortBy)) {
        throw new Error('INVALID_SORT_BY');
      }
      
      // Build query filters
      const filters = { userId };
      if (status) {
        filters.status = status;
      }
      
      // Build sort object
      const sortDirection = sortOrder === 'asc' ? 1 : -1;
      const sort = { [sortBy]: sortDirection };
      
      // Execute query with pagination
      const [trips, totalCount] = await Promise.all([
        Trip.find(filters)
          .sort(sort)
          .limit(parsedLimit)
          .skip(parsedOffset)
          .lean(),
        Trip.countDocuments(filters)
      ]);
      
      // Calculate pagination metadata
      const totalPages = Math.ceil(totalCount / parsedLimit);
      const currentPage = Math.floor(parsedOffset / parsedLimit) + 1;
      const hasNext = currentPage < totalPages;
      const hasPrev = currentPage > 1;
      
      return {
        trips: trips.map(trip => {
          // Calculate virtual fields for lean objects
          if (trip.destination.startDate && trip.destination.endDate) {
            const timeDiff = trip.destination.endDate.getTime() - trip.destination.startDate.getTime();
            trip.duration = Math.ceil(timeDiff / (1000 * 3600 * 24));
          }
          trip.totalTravelers = trip.travelers.adults + trip.travelers.children + trip.travelers.infants;
          return trip;
        }),
        pagination: {
          currentPage,
          totalPages,
          totalCount,
          limit: parsedLimit,
          offset: parsedOffset,
          hasNext,
          hasPrev
        }
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get detailed trip information
   * @param {string} tripId - Trip ID
   * @param {string} userId - User ID requesting the trip
   * @returns {Promise<Object>} Trip details
   */
  async getTripDetails(tripId, userId) {
    try {
      const trip = await Trip.findById(tripId);
      
      if (!trip) {
        throw new Error('TRIP_NOT_FOUND');
      }
      
      if (!trip.isOwnedBy(userId)) {
        throw new Error('TRIP_ACCESS_DENIED');
      }
      
      return trip.toPublicJSON();
    } catch (error) {
      if (error.name === 'CastError') {
        throw new Error('INVALID_TRIP_ID');
      }
      throw error;
    }
  }

  /**
   * Update trip information
   * @param {string} tripId - Trip ID
   * @param {string} userId - User ID updating the trip
   * @param {Object} updateData - Update data
   * @returns {Promise<Object>} Updated trip data
   */
  async updateTrip(tripId, userId, updateData) {
    try {
      const trip = await Trip.findById(tripId);
      
      if (!trip) {
        throw new Error('TRIP_NOT_FOUND');
      }
      
      if (!trip.isOwnedBy(userId)) {
        throw new Error('TRIP_ACCESS_DENIED');
      }
      
      // Validate date constraints if dates are being updated
      if (updateData.destination) {
        const startDate = updateData.destination.startDate 
          ? new Date(updateData.destination.startDate) 
          : trip.destination.startDate;
        const endDate = updateData.destination.endDate 
          ? new Date(updateData.destination.endDate) 
          : trip.destination.endDate;
        
        if (startDate && endDate && startDate >= endDate) {
          throw new Error('START_DATE_AFTER_END_DATE');
        }
        
        // Don't allow changing start date to past for trips that haven't started
        if (updateData.destination.startDate && trip.status === 'draft') {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (startDate < today) {
            throw new Error('START_DATE_IN_PAST');
          }
        }
      }
      
      // Update trip fields
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          if (typeof updateData[key] === 'object' && updateData[key] !== null && !Array.isArray(updateData[key])) {
            // Handle nested objects (destination, travelers, budget, preferences)
            trip[key] = { ...trip[key], ...updateData[key] };
          } else {
            trip[key] = updateData[key];
          }
        }
      });
      
      await trip.save();
      
      return trip.toPublicJSON();
    } catch (error) {
      if (error.name === 'CastError') {
        throw new Error('INVALID_TRIP_ID');
      }
      if (error.name === 'ValidationError') {
        const firstError = Object.values(error.errors)[0];
        throw new Error(`VALIDATION_ERROR: ${firstError.message}`);
      }
      throw error;
    }
  }

  /**
   * Delete a trip permanently
   * @param {string} tripId - Trip ID
   * @param {string} userId - User ID deleting the trip
   * @returns {Promise<void>}
   */
  async deleteTrip(tripId, userId) {
    try {
      const trip = await Trip.findById(tripId);
      
      if (!trip) {
        throw new Error('TRIP_NOT_FOUND');
      }
      
      if (!trip.isOwnedBy(userId)) {
        throw new Error('TRIP_ACCESS_DENIED');
      }
      
      // TODO: Clean up associated data (bookings, etc.) when those features are implemented
      
      await Trip.findByIdAndDelete(tripId);
    } catch (error) {
      if (error.name === 'CastError') {
        throw new Error('INVALID_TRIP_ID');
      }
      throw error;
    }
  }

  /**
   * Generate a draft schedule for the trip
   * @param {string} tripId - Trip ID
   * @param {string} userId - User ID
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Updated trip with draft schedule
   */
  async generateDraftSchedule(tripId, userId, options = {}) {
    try {
      const trip = await Trip.findById(tripId);
      
      if (!trip) {
        throw new Error('TRIP_NOT_FOUND');
      }
      
      if (!trip.isOwnedBy(userId)) {
        throw new Error('TRIP_ACCESS_DENIED');
      }
      
      if (trip.itinerary.days.length > 0) {
        throw new Error('TRIP_ALREADY_HAS_SCHEDULE');
      }
      
      // TODO: Integrate with AI service when implemented
      // For now, create a basic schedule structure
      const duration = trip.duration;
      const startDate = new Date(trip.destination.startDate);
      
      // Initialize empty days for the trip duration
      const days = [];
      for (let i = 0; i < duration; i++) {
        const dayDate = new Date(startDate);
        dayDate.setDate(dayDate.getDate() + i);
        
        days.push({
          date: dayDate,
          activities: [
            {
              time: '09:00',
              title: 'Morning Activity',
              description: 'Placeholder activity - will be generated by AI',
              location: {
                name: trip.destination.destination,
                address: '',
                coordinates: { lat: 0, lng: 0 }
              },
              duration: 120, // 2 hours
              cost: 0,
              category: 'cultural',
              notes: 'AI-generated activity placeholder'
            }
          ]
        });
      }
      
      trip.itinerary.days = days;
      trip.status = 'planned';
      
      await trip.save();
      
      return trip.toPublicJSON();
    } catch (error) {
      if (error.name === 'CastError') {
        throw new Error('INVALID_TRIP_ID');
      }
      throw error;
    }
  }

  /**
   * Optimize trip schedule
   * @param {string} tripId - Trip ID
   * @param {string} userId - User ID
   * @param {Object} options - Optimization options
   * @returns {Promise<Object>} Updated trip with optimized schedule
   */
  async optimizeTrip(tripId, userId, options = {}) {
    try {
      const trip = await Trip.findById(tripId);
      
      if (!trip) {
        throw new Error('TRIP_NOT_FOUND');
      }
      
      if (!trip.isOwnedBy(userId)) {
        throw new Error('TRIP_ACCESS_DENIED');
      }
      
      if (!trip.itinerary.days || trip.itinerary.days.length === 0) {
        throw new Error('TRIP_NO_SCHEDULE_TO_OPTIMIZE');
      }
      
      // TODO: Integrate with AI service for optimization
      // For now, just update the timestamp to indicate optimization was attempted
      trip.updatedAt = new Date();
      
      await trip.save();
      
      return trip.toPublicJSON();
    } catch (error) {
      if (error.name === 'CastError') {
        throw new Error('INVALID_TRIP_ID');
      }
      throw error;
    }
  }

  /**
   * Export trip in various formats
   * @param {string} tripId - Trip ID
   * @param {string} userId - User ID
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export data or URL
   */
  async exportTrip(tripId, userId, options = {}) {
    try {
      const trip = await Trip.findById(tripId);
      
      if (!trip) {
        throw new Error('TRIP_NOT_FOUND');
      }
      
      if (!trip.isOwnedBy(userId)) {
        throw new Error('TRIP_ACCESS_DENIED');
      }
      
      const { format = 'json', includeCosts = false, includeNotes = false, timezone = 'UTC' } = options;
      
      if (!['pdf', 'ics', 'json'].includes(format)) {
        throw new Error('INVALID_EXPORT_FORMAT');
      }
      
      // Prepare export data
      const exportData = trip.toPublicJSON();
      
      // Filter data based on options
      if (!includeCosts) {
        delete exportData.budget;
        if (exportData.itinerary && exportData.itinerary.days) {
          exportData.itinerary.days.forEach(day => {
            day.activities.forEach(activity => {
              delete activity.cost;
            });
          });
        }
      }
      
      if (!includeNotes) {
        if (exportData.itinerary && exportData.itinerary.days) {
          exportData.itinerary.days.forEach(day => {
            day.activities.forEach(activity => {
              delete activity.notes;
            });
          });
        }
      }
      
      switch (format) {
        case 'json':
          return {
            format: 'json',
            data: exportData,
            filename: `trip-${trip.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}.json`
          };
        
        case 'ics':
          // TODO: Implement ICS calendar export
          return {
            format: 'ics',
            data: 'ICS export not yet implemented',
            filename: `trip-${trip.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}.ics`
          };
        
        case 'pdf':
          // TODO: Implement PDF export
          return {
            format: 'pdf',
            data: 'PDF export not yet implemented',
            filename: `trip-${trip.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-${Date.now()}.pdf`
          };
        
        default:
          throw new Error('INVALID_EXPORT_FORMAT');
      }
    } catch (error) {
      if (error.name === 'CastError') {
        throw new Error('INVALID_TRIP_ID');
      }
      throw error;
    }
  }

  /**
   * Add activity to a specific day in trip itinerary
   * @param {string} tripId - Trip ID
   * @param {string} userId - User ID
   * @param {string} dayId - Day ID in itinerary
   * @param {Object} activityData - Activity data
   * @returns {Promise<Object>} Updated trip data
   */
  async addActivityToDay(tripId, userId, dayId, activityData) {
    try {
      const trip = await Trip.findById(tripId);
      
      if (!trip) {
        throw new Error('TRIP_NOT_FOUND');
      }
      
      if (!trip.isOwnedBy(userId)) {
        throw new Error('TRIP_ACCESS_DENIED');
      }
      
      const day = trip.itinerary.days.id(dayId);
      if (!day) {
        throw new Error('DAY_NOT_FOUND');
      }
      
      day.activities.push(activityData);
      
      await trip.save();
      
      return trip.toPublicJSON();
    } catch (error) {
      if (error.name === 'CastError') {
        throw new Error('INVALID_ID');
      }
      if (error.name === 'ValidationError') {
        const firstError = Object.values(error.errors)[0];
        throw new Error(`VALIDATION_ERROR: ${firstError.message}`);
      }
      throw error;
    }
  }

  /**
   * Update activity in trip itinerary
   * @param {string} tripId - Trip ID
   * @param {string} userId - User ID
   * @param {string} dayId - Day ID in itinerary
   * @param {string} activityId - Activity ID
   * @param {Object} updateData - Activity update data
   * @returns {Promise<Object>} Updated trip data
   */
  async updateActivity(tripId, userId, dayId, activityId, updateData) {
    try {
      const trip = await Trip.findById(tripId);
      
      if (!trip) {
        throw new Error('TRIP_NOT_FOUND');
      }
      
      if (!trip.isOwnedBy(userId)) {
        throw new Error('TRIP_ACCESS_DENIED');
      }
      
      const day = trip.itinerary.days.id(dayId);
      if (!day) {
        throw new Error('DAY_NOT_FOUND');
      }
      
      const activity = day.activities.id(activityId);
      if (!activity) {
        throw new Error('ACTIVITY_NOT_FOUND');
      }
      
      // Update activity fields
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          activity[key] = updateData[key];
        }
      });
      
      await trip.save();
      
      return trip.toPublicJSON();
    } catch (error) {
      if (error.name === 'CastError') {
        throw new Error('INVALID_ID');
      }
      if (error.name === 'ValidationError') {
        const firstError = Object.values(error.errors)[0];
        throw new Error(`VALIDATION_ERROR: ${firstError.message}`);
      }
      throw error;
    }
  }

  /**
   * Delete activity from trip itinerary
   * @param {string} tripId - Trip ID
   * @param {string} userId - User ID
   * @param {string} dayId - Day ID in itinerary
   * @param {string} activityId - Activity ID
   * @returns {Promise<Object>} Updated trip data
   */
  async deleteActivity(tripId, userId, dayId, activityId) {
    try {
      const trip = await Trip.findById(tripId);
      
      if (!trip) {
        throw new Error('TRIP_NOT_FOUND');
      }
      
      if (!trip.isOwnedBy(userId)) {
        throw new Error('TRIP_ACCESS_DENIED');
      }
      
      const day = trip.itinerary.days.id(dayId);
      if (!day) {
        throw new Error('DAY_NOT_FOUND');
      }
      
      day.activities.pull(activityId);
      
      await trip.save();
      
      return trip.toPublicJSON();
    } catch (error) {
      if (error.name === 'CastError') {
        throw new Error('INVALID_ID');
      }
      throw error;
    }
  }
}

module.exports = new TripService();