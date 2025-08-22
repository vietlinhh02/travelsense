const mongoose = require('mongoose');

const otpCodeSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  code: {
    type: String,
    required: true,
    length: 6
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // MongoDB TTL index
  },
  attempts: {
    type: Number,
    default: 0,
    max: 3
  },
  used: {
    type: Boolean,
    default: false
  },
  purpose: {
    type: String,
    enum: ['login', 'password_reset', 'email_verification', 'two_factor'],
    default: 'login'
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  versionKey: false
});

// Compound indexes for performance
otpCodeSchema.index({ email: 1, expiresAt: 1 });
otpCodeSchema.index({ email: 1, used: 1 });
otpCodeSchema.index({ code: 1, expiresAt: 1 });
otpCodeSchema.index({ email: 1, purpose: 1 });

// Static method to cleanup expired codes
otpCodeSchema.statics.cleanupExpired = function() {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

// Static method to create OTP code
otpCodeSchema.statics.createOtp = function(email, code, expiresAt, purpose = 'login', metadata = {}) {
  return this.create({
    email,
    code,
    expiresAt,
    purpose,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent
  });
};

// Static method to find valid OTP
otpCodeSchema.statics.findValidOtp = function(email, code, purpose = 'login') {
  return this.findOne({
    email,
    code,
    purpose,
    expiresAt: { $gt: new Date() },
    used: false,
    attempts: { $lt: 3 }
  });
};

// Static method to use OTP
otpCodeSchema.statics.useOtp = function(email, code, purpose = 'login') {
  return this.findOneAndUpdate(
    {
      email,
      code,
      purpose,
      expiresAt: { $gt: new Date() },
      used: false,
      attempts: { $lt: 3 }
    },
    {
      used: true,
      $inc: { attempts: 1 }
    },
    { new: true }
  );
};

// Static method to get recent attempts
otpCodeSchema.statics.getRecentAttempts = function(email, timeWindow = 10, purpose = null) {
  const query = {
    email,
    createdAt: { $gte: new Date(Date.now() - timeWindow * 60 * 1000) }
  };
  
  if (purpose) {
    query.purpose = purpose;
  }
  
  return this.countDocuments(query);
};

// Static method to invalidate all OTPs for email
otpCodeSchema.statics.invalidateAllForEmail = function(email, purpose = null) {
  const query = { email, used: false };
  if (purpose) {
    query.purpose = purpose;
  }
  
  return this.updateMany(query, { used: true });
};

// Instance method to increment attempts
otpCodeSchema.methods.incrementAttempts = function() {
  this.attempts += 1;
  return this.save();
};

// Instance method to check if expired
otpCodeSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Instance method to check if max attempts reached
otpCodeSchema.methods.maxAttemptsReached = function() {
  return this.attempts >= 3;
};

// Instance method to mark as used
otpCodeSchema.methods.markAsUsed = function() {
  this.used = true;
  this.attempts += 1;
  return this.save();
};

const OtpCode = mongoose.model('OtpCode', otpCodeSchema);

module.exports = OtpCode;