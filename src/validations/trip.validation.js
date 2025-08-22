const { body, param, query } = require('express-validator');

// Helper regex for time format validation (HH:MM)
const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

// Helper regex for currency code validation (ISO 4217)
const currencyRegex = /^[A-Z]{3}$/;

// Trip creation validation
const createTripValidation = [
  body('name')
    .notEmpty().withMessage('Trip name is required')
    .isLength({ min: 1, max: 100 }).withMessage('Trip name must be between 1 and 100 characters')
    .trim(),
  
  body('destination.origin')
    .notEmpty().withMessage('Origin is required')
    .isLength({ max: 100 }).withMessage('Origin must not exceed 100 characters')
    .trim(),
  
  body('destination.destination')
    .notEmpty().withMessage('Destination is required')
    .isLength({ max: 100 }).withMessage('Destination must not exceed 100 characters')
    .trim(),
  
  body('destination.startDate')
    .notEmpty().withMessage('Start date is required')
    .isISO8601().withMessage('Start date must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      const startDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (startDate < today) {
        throw new Error('Start date cannot be in the past');
      }
      
      if (req.body.destination && req.body.destination.endDate) {
        const endDate = new Date(req.body.destination.endDate);
        if (startDate >= endDate) {
          throw new Error('End date must be after start date');
        }
      }
      
      return true;
    }),
  
  body('destination.endDate')
    .notEmpty().withMessage('End date is required')
    .isISO8601().withMessage('End date must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      if (req.body.destination && req.body.destination.startDate) {
        const startDate = new Date(req.body.destination.startDate);
        const endDate = new Date(value);
        if (endDate <= startDate) {
          throw new Error('End date must be after start date');
        }
      }
      return true;
    }),
  
  body('travelers.adults')
    .notEmpty().withMessage('Number of adults is required')
    .isInt({ min: 1, max: 20 }).withMessage('Adults count must be between 1 and 20'),
  
  body('travelers.children')
    .optional()
    .isInt({ min: 0, max: 20 }).withMessage('Children count must be between 0 and 20'),
  
  body('travelers.infants')
    .optional()
    .isInt({ min: 0, max: 20 }).withMessage('Infants count must be between 0 and 20'),
  
  body('budget.total')
    .optional()
    .isFloat({ min: 0, max: 1000000 }).withMessage('Budget total must be between 0 and 1,000,000'),
  
  body('budget.currency')
    .optional()
    .toUpperCase()
    .matches(currencyRegex).withMessage('Currency must be a valid 3-letter ISO 4217 currency code'),
  
  body('preferences.interests')
    .optional()
    .isArray().withMessage('Interests must be an array')
    .custom((interests) => {
      if (interests.length > 20) {
        throw new Error('Maximum of 20 interests allowed');
      }
      for (const interest of interests) {
        if (typeof interest !== 'string' || interest.length > 50) {
          throw new Error('Each interest must be a string with maximum 50 characters');
        }
      }
      return true;
    }),
  
  body('preferences.constraints')
    .optional()
    .isArray().withMessage('Constraints must be an array')
    .custom((constraints) => {
      if (constraints.length > 10) {
        throw new Error('Maximum of 10 constraints allowed');
      }
      for (const constraint of constraints) {
        if (typeof constraint !== 'string' || constraint.length > 100) {
          throw new Error('Each constraint must be a string with maximum 100 characters');
        }
      }
      return true;
    }),
  
  body('preferences.specialRequests')
    .optional()
    .isArray().withMessage('Special requests must be an array')
    .custom((requests) => {
      if (requests.length > 10) {
        throw new Error('Maximum of 10 special requests allowed');
      }
      for (const request of requests) {
        if (typeof request !== 'string' || request.length > 200) {
          throw new Error('Each special request must be a string with maximum 200 characters');
        }
      }
      return true;
    })
];

// Trip update validation (similar to create but all fields optional)
const updateTripValidation = [
  body('name')
    .optional()
    .isLength({ min: 1, max: 100 }).withMessage('Trip name must be between 1 and 100 characters')
    .trim(),
  
  body('destination.origin')
    .optional()
    .isLength({ max: 100 }).withMessage('Origin must not exceed 100 characters')
    .trim(),
  
  body('destination.destination')
    .optional()
    .isLength({ max: 100 }).withMessage('Destination must not exceed 100 characters')
    .trim(),
  
  body('destination.startDate')
    .optional()
    .isISO8601().withMessage('Start date must be a valid ISO 8601 date'),
  
  body('destination.endDate')
    .optional()
    .isISO8601().withMessage('End date must be a valid ISO 8601 date'),
  
  body('travelers.adults')
    .optional()
    .isInt({ min: 1, max: 20 }).withMessage('Adults count must be between 1 and 20'),
  
  body('travelers.children')
    .optional()
    .isInt({ min: 0, max: 20 }).withMessage('Children count must be between 0 and 20'),
  
  body('travelers.infants')
    .optional()
    .isInt({ min: 0, max: 20 }).withMessage('Infants count must be between 0 and 20'),
  
  body('budget.total')
    .optional()
    .isFloat({ min: 0, max: 1000000 }).withMessage('Budget total must be between 0 and 1,000,000'),
  
  body('budget.currency')
    .optional()
    .toUpperCase()
    .matches(currencyRegex).withMessage('Currency must be a valid 3-letter ISO 4217 currency code'),
  
  body('budget.breakdown.accommodation')
    .optional()
    .isFloat({ min: 0, max: 1000000 }).withMessage('Accommodation budget must be between 0 and 1,000,000'),
  
  body('budget.breakdown.transportation')
    .optional()
    .isFloat({ min: 0, max: 1000000 }).withMessage('Transportation budget must be between 0 and 1,000,000'),
  
  body('budget.breakdown.food')
    .optional()
    .isFloat({ min: 0, max: 1000000 }).withMessage('Food budget must be between 0 and 1,000,000'),
  
  body('budget.breakdown.activities')
    .optional()
    .isFloat({ min: 0, max: 1000000 }).withMessage('Activities budget must be between 0 and 1,000,000'),
  
  body('budget.breakdown.shopping')
    .optional()
    .isFloat({ min: 0, max: 1000000 }).withMessage('Shopping budget must be between 0 and 1,000,000'),
  
  body('budget.breakdown.other')
    .optional()
    .isFloat({ min: 0, max: 1000000 }).withMessage('Other budget must be between 0 and 1,000,000'),
  
  body('preferences.interests')
    .optional()
    .isArray().withMessage('Interests must be an array')
    .custom((interests) => {
      if (interests.length > 20) {
        throw new Error('Maximum of 20 interests allowed');
      }
      for (const interest of interests) {
        if (typeof interest !== 'string' || interest.length > 50) {
          throw new Error('Each interest must be a string with maximum 50 characters');
        }
      }
      return true;
    }),
  
  body('preferences.constraints')
    .optional()
    .isArray().withMessage('Constraints must be an array')
    .custom((constraints) => {
      if (constraints.length > 10) {
        throw new Error('Maximum of 10 constraints allowed');
      }
      for (const constraint of constraints) {
        if (typeof constraint !== 'string' || constraint.length > 100) {
          throw new Error('Each constraint must be a string with maximum 100 characters');
        }
      }
      return true;
    }),
  
  body('preferences.specialRequests')
    .optional()
    .isArray().withMessage('Special requests must be an array')
    .custom((requests) => {
      if (requests.length > 10) {
        throw new Error('Maximum of 10 special requests allowed');
      }
      for (const request of requests) {
        if (typeof request !== 'string' || request.length > 200) {
          throw new Error('Each special request must be a string with maximum 200 characters');
        }
      }
      return true;
    })
];

// Trip ID parameter validation
const tripIdValidation = [
  param('id')
    .notEmpty().withMessage('Trip ID is required')
    .isMongoId().withMessage('Trip ID must be a valid MongoDB ObjectId')
];

// Generate draft schedule validation
const generateDraftScheduleValidation = [
  ...tripIdValidation,
  body('focus')
    .optional()
    .isIn(['cultural', 'adventure', 'relaxation', 'family', 'business', 'romantic'])
    .withMessage('Focus must be one of: cultural, adventure, relaxation, family, business, romantic')
];

// Optimize trip validation
const optimizeTripValidation = [
  ...tripIdValidation,
  body('focus')
    .optional()
    .isIn(['time', 'cost', 'distance'])
    .withMessage('Focus must be one of: time, cost, distance')
];

// Export trip validation
const exportTripValidation = [
  ...tripIdValidation,
  body('format')
    .notEmpty().withMessage('Export format is required')
    .isIn(['pdf', 'ics', 'json'])
    .withMessage('Format must be one of: pdf, ics, json'),
  
  body('options.includeCosts')
    .optional()
    .isBoolean().withMessage('includeCosts must be a boolean'),
  
  body('options.includeNotes')
    .optional()
    .isBoolean().withMessage('includeNotes must be a boolean'),
  
  body('options.timezone')
    .optional()
    .isLength({ max: 50 }).withMessage('Timezone must not exceed 50 characters')
];

// Activity validation for adding/updating activities
const activityValidation = [
  ...tripIdValidation,
  param('dayId')
    .notEmpty().withMessage('Day ID is required')
    .isMongoId().withMessage('Day ID must be a valid MongoDB ObjectId'),
  
  body('time')
    .notEmpty().withMessage('Activity time is required')
    .matches(timeRegex).withMessage('Time must be in HH:MM format'),
  
  body('title')
    .notEmpty().withMessage('Activity title is required')
    .isLength({ min: 1, max: 200 }).withMessage('Title must be between 1 and 200 characters')
    .trim(),
  
  body('description')
    .optional()
    .isLength({ max: 1000 }).withMessage('Description must not exceed 1000 characters')
    .trim(),
  
  body('location.name')
    .notEmpty().withMessage('Location name is required')
    .isLength({ max: 200 }).withMessage('Location name must not exceed 200 characters')
    .trim(),
  
  body('location.address')
    .optional()
    .isLength({ max: 300 }).withMessage('Address must not exceed 300 characters')
    .trim(),
  
  body('location.coordinates.lat')
    .optional()
    .isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  
  body('location.coordinates.lng')
    .optional()
    .isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  
  body('duration')
    .optional()
    .isInt({ min: 15, max: 1440 }).withMessage('Duration must be between 15 minutes and 24 hours'),
  
  body('cost')
    .optional()
    .isFloat({ min: 0, max: 100000 }).withMessage('Cost must be between 0 and 100,000'),
  
  body('category')
    .notEmpty().withMessage('Activity category is required')
    .isIn(['cultural', 'adventure', 'relaxation', 'food', 'shopping', 'nature', 'nightlife', 'transportation', 'accommodation'])
    .withMessage('Category must be one of: cultural, adventure, relaxation, food, shopping, nature, nightlife, transportation, accommodation'),
  
  body('notes')
    .optional()
    .isLength({ max: 500 }).withMessage('Notes must not exceed 500 characters')
    .trim()
];

// Update activity validation (includes activity ID)
const updateActivityValidation = [
  ...activityValidation,
  param('activityId')
    .notEmpty().withMessage('Activity ID is required')
    .isMongoId().withMessage('Activity ID must be a valid MongoDB ObjectId')
];

// Delete activity validation
const deleteActivityValidation = [
  ...tripIdValidation,
  param('dayId')
    .notEmpty().withMessage('Day ID is required')
    .isMongoId().withMessage('Day ID must be a valid MongoDB ObjectId'),
  
  param('activityId')
    .notEmpty().withMessage('Activity ID is required')
    .isMongoId().withMessage('Activity ID must be a valid MongoDB ObjectId')
];

// Query parameters validation for getting trips
const getTripsQueryValidation = [
  query('status')
    .optional()
    .isIn(['draft', 'planned', 'in-progress', 'completed'])
    .withMessage('Status must be one of: draft, planned, in-progress, completed'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  
  query('offset')
    .optional()
    .isInt({ min: 0 }).withMessage('Offset must be a non-negative integer'),
  
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'name', 'destination.startDate'])
    .withMessage('sortBy must be one of: createdAt, updatedAt, name, destination.startDate'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('sortOrder must be either asc or desc')
];

module.exports = {
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
};