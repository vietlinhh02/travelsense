const { body, param, query } = require('express-validator');

// Chat with AI validation
const chatWithAIValidation = [
  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 1, max: 2000 })
    .withMessage('Message must be between 1 and 2000 characters'),
  
  body('context')
    .optional()
    .isObject()
    .withMessage('Context must be an object'),
  
  body('context.tripId')
    .optional()
    .isMongoId()
    .withMessage('Trip ID must be a valid MongoDB ObjectId'),
  
  body('context.conversationHistory')
    .optional()
    .isArray()
    .withMessage('Conversation history must be an array')
    .custom((history) => {
      if (history.length > 10) {
        throw new Error('Conversation history cannot exceed 10 messages');
      }
      return true;
    }),
  
  body('model')
    .optional()
    .isIn(['flash', 'pro'])
    .withMessage('Model must be either "flash" or "pro"')
];

// Generate itinerary validation
const generateItineraryValidation = [
  param('tripId')
    .isMongoId()
    .withMessage('Trip ID must be a valid MongoDB ObjectId'),
  
  body('focus')
    .optional()
    .isString()
    .isLength({ max: 200 })
    .withMessage('Focus must be a string with maximum 200 characters')
];

// Optimize schedule validation
const optimizeScheduleValidation = [
  param('tripId')
    .isMongoId()
    .withMessage('Trip ID must be a valid MongoDB ObjectId'),
  
  body('focus')
    .optional()
    .isString()
    .isLength({ max: 200 })
    .withMessage('Focus must be a string with maximum 200 characters')
];

// Validate constraints validation
const validateConstraintsValidation = [
  param('tripId')
    .isMongoId()
    .withMessage('Trip ID must be a valid MongoDB ObjectId'),
  
  body('checkType')
    .optional()
    .isIn(['all', 'budget', 'schedule', 'preferences', 'logistics'])
    .withMessage('Check type must be one of: all, budget, schedule, preferences, logistics')
];

// Suggest activities validation
const suggestActivitiesValidation = [
  body('tripId')
    .optional()
    .isMongoId()
    .withMessage('Trip ID must be a valid MongoDB ObjectId'),
  
  body('date')
    .optional()
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date'),
  
  body('timePeriod')
    .optional()
    .isIn(['morning', 'afternoon', 'evening', 'night', 'full-day'])
    .withMessage('Time period must be one of: morning, afternoon, evening, night, full-day'),
  
  body('interests')
    .optional()
    .isArray()
    .withMessage('Interests must be an array')
    .custom((interests) => {
      if (interests.length > 20) {
        throw new Error('Maximum of 20 interests allowed');
      }
      if (!interests.every(interest => typeof interest === 'string' && interest.length <= 50)) {
        throw new Error('Each interest must be a string with maximum 50 characters');
      }
      return true;
    }),
  
  body('constraints')
    .optional()
    .isArray()
    .withMessage('Constraints must be an array')
    .custom((constraints) => {
      if (constraints.length > 10) {
        throw new Error('Maximum of 10 constraints allowed');
      }
      if (!constraints.every(constraint => typeof constraint === 'string' && constraint.length <= 100)) {
        throw new Error('Each constraint must be a string with maximum 100 characters');
      }
      return true;
    })
];

// Get interaction stats validation
const getInteractionStatsValidation = [
  query('timeframe')
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage('Timeframe must be an integer between 1 and 365 days')
];

module.exports = {
  chatWithAIValidation,
  generateItineraryValidation,
  optimizeScheduleValidation,
  validateConstraintsValidation,
  suggestActivitiesValidation,
  getInteractionStatsValidation
};