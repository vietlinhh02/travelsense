/**
 * Authentication Models Index
 * 
 * This file exports all authentication-related models for easy importing
 * throughout the application.
 */

const BlacklistToken = require('./blacklistToken.model');
const RefreshToken = require('./refreshToken.model');
const EmailVerification = require('./emailVerification.model');
const PhoneVerification = require('./phoneVerification.model');
const OtpCode = require('./otpCode.model');
const TwoFactorAuth = require('./twoFactorAuth.model');
const AccountRecovery = require('./accountRecovery.model');

module.exports = {
  BlacklistToken,
  RefreshToken,
  EmailVerification,
  PhoneVerification,
  OtpCode,
  TwoFactorAuth,
  AccountRecovery
};