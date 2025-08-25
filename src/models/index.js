/**
 * Models Index
 * 
 * This file exports all models organized by category for easy importing
 * throughout the application.
 */

// User models
const User = require('./users/user.model');

// Trip models
const {
  Trip,
  TripDraft
} = require('./trips');

// AI models
const {
  AIInteractionLog,
  RateLimitTracker
} = require('./ai');

// Authentication models
const {
  BlacklistToken,
  RefreshToken,
  EmailVerification,
  PhoneVerification,
  OtpCode,
  TwoFactorAuth,
  AccountRecovery
} = require('./auth');

// Export by category
module.exports = {
  // User models
  User,
  
  // Trip models
  Trip,
  TripDraft,
  
  // AI models
  AIInteractionLog,
  RateLimitTracker,
  
  // Authentication models
  BlacklistToken,
  RefreshToken,
  EmailVerification,
  PhoneVerification,
  OtpCode,
  TwoFactorAuth,
  AccountRecovery,
  
  // Grouped exports for convenience
  auth: {
    BlacklistToken,
    RefreshToken,
    EmailVerification,
    PhoneVerification,
    OtpCode,
    TwoFactorAuth,
    AccountRecovery
  },
  
  users: {
    User
  },
  
  trips: {
    Trip,
    TripDraft
  },
  
  ai: {
    AIInteractionLog,
    RateLimitTracker
  }
};