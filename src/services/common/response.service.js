/**
 * Response Formatter Service
 * Centralizes response formatting and cookie management
 */

class ResponseService {
  /**
   * Set refresh token cookie
   * @param {Object} res - Express response object
   * @param {string} refreshToken - Refresh token to set
   */
  setRefreshTokenCookie(res, refreshToken) {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
  }

  /**
   * Clear refresh token cookie
   * @param {Object} res - Express response object
   */
  clearRefreshTokenCookie(res) {
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
  }

  /**
   * Format authentication success response
   * @param {Object} res - Express response object
   * @param {Object} data - Authentication data
   * @param {string} message - Success message
   * @param {number} statusCode - HTTP status code
   */
  sendAuthResponse(res, data, message, statusCode = 200) {
    // Set refresh token cookie
    this.setRefreshTokenCookie(res, data.refreshToken);

    // Send response without refresh token in body
    res.status(statusCode).json({
      message,
      user: data.user,
      accessToken: data.accessToken
    });
  }

  /**
   * Format standard success response
   * @param {Object} res - Express response object
   * @param {Object} data - Response data
   * @param {string} message - Success message
   * @param {number} statusCode - HTTP status code
   */
  sendSuccess(res, data, message, statusCode = 200) {
    const response = { message };
    
    if (data) {
      Object.assign(response, data);
    }

    res.status(statusCode).json(response);
  }

  /**
   * Format error response
   * @param {Object} res - Express response object
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   */
  sendError(res, message, statusCode = 500) {
    res.status(statusCode).json({ message });
  }

  /**
   * Map service errors to HTTP responses
   * @param {Object} res - Express response object
   * @param {Error} error - Service error
   * @param {string} defaultMessage - Default error message
   */
  handleServiceError(res, error, defaultMessage = 'Server error') {
    const errorMappings = {
      // Authentication errors
      'EMAIL_ALREADY_REGISTERED': { status: 409, message: 'Email already registered' },
      'INVALID_CREDENTIALS': { status: 401, message: 'Invalid credentials' },
      'INVALID_GOOGLE_TOKEN': { status: 401, message: 'Invalid Google token' },
      
      // User errors
      'USER_NOT_FOUND': { status: 404, message: 'User not found' },
      'INVALID_CURRENT_PASSWORD': { status: 401, message: 'Current password is incorrect' },
      'INVALID_PASSWORD': { status: 401, message: 'Password is incorrect' },
      
      // OTP errors
      'EMAIL_NOT_REGISTERED': { status: 404, message: 'Email not registered' },
      'INVALID_OR_EXPIRED_OTP': { status: 401, message: 'Invalid or expired OTP' },
      
      // Verification errors
      'EMAIL_ALREADY_VERIFIED': { status: 409, message: 'Email already verified' },
      'PHONE_ALREADY_VERIFIED': { status: 409, message: 'Phone number already verified' },
      'PHONE_NUMBER_MISMATCH': { status: 400, message: 'Phone number does not match' },
      'INVALID_OR_EXPIRED_CODE': { status: 401, message: 'Invalid or expired verification code' },
      'INVALID_OR_EXPIRED_TOKEN': { status: 401, message: 'Invalid or expired verification token' },
      
      // 2FA errors
      'TWO_FACTOR_ALREADY_ENABLED': { status: 409, message: 'Two-factor authentication is already enabled' },
      'TWO_FACTOR_NOT_ENABLED': { status: 409, message: 'Two-factor authentication is not enabled' },
      
      // Recovery errors
      'INVALID_RECOVERY_TOKEN': { status: 401, message: 'Invalid recovery token' },
      
      // Trip errors
      'TRIP_NOT_FOUND': { status: 404, message: 'Trip not found' },
      'TRIP_ACCESS_DENIED': { status: 403, message: 'Access denied to this trip' },
      'INVALID_TRIP_ID': { status: 400, message: 'Trip ID must be a valid MongoDB ObjectId' },
      'INVALID_STATUS': { status: 400, message: 'Status must be one of: draft, planned, in-progress, completed' },
      'INVALID_LIMIT': { status: 400, message: 'Limit must be between 1 and 50' },
      'INVALID_SORT_BY': { status: 400, message: 'sortBy must be one of: createdAt, updatedAt, name, destination.startDate' },
      'START_DATE_AFTER_END_DATE': { status: 400, message: 'Start date must be before end date' },
      'START_DATE_IN_PAST': { status: 400, message: 'Start date cannot be in the past' },
      'TRIP_ALREADY_HAS_SCHEDULE': { status: 409, message: 'Trip already has a schedule' },
      'TRIP_NO_SCHEDULE_TO_OPTIMIZE': { status: 400, message: 'Trip has no schedule to optimize' },
      'INVALID_EXPORT_FORMAT': { status: 400, message: 'Invalid export format' },
      'DAY_NOT_FOUND': { status: 404, message: 'Day not found in trip itinerary' },
      'ACTIVITY_NOT_FOUND': { status: 404, message: 'Activity not found' },
      'INVALID_ID': { status: 400, message: 'Invalid ID format' },
      
      // AI errors
      'RATE_LIMIT_EXCEEDED': { status: 429, message: 'Rate limit exceeded. Please try again later.' },
      'AI_SERVICE_UNAVAILABLE': { status: 503, message: 'AI service is temporarily unavailable' },
      'INVALID_AI_MODEL': { status: 400, message: 'Invalid AI model specified' },
      'TRIP_ALREADY_HAS_ITINERARY': { status: 409, message: 'Trip already has a complete itinerary' },
      'NO_ITINERARY_TO_OPTIMIZE': { status: 400, message: 'Trip has no itinerary to optimize' },
      'DATE_OUTSIDE_TRIP_RANGE': { status: 400, message: 'Date is outside the trip date range' },
      'AI_PROCESSING_ERROR': { status: 500, message: 'Error processing AI request' },
      'INVALID_CONVERSATION_HISTORY': { status: 400, message: 'Invalid conversation history format' }
    };

    const mapping = errorMappings[error.message];
    if (mapping) {
      this.sendError(res, mapping.message, mapping.status);
    } else {
      console.error('Unhandled service error:', error);
      this.sendError(res, defaultMessage, 500);
    }
  }
}

module.exports = new ResponseService();