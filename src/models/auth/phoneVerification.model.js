const mongoose = require('mongoose');

const phoneVerificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  phoneNumber: {
    type: String,
    required: true,
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
  verified: {
    type: Boolean,
    default: false
  },
  provider: {
    type: String,
    enum: ['twilio', 'aws-sns', 'custom'],
    default: 'custom'
  }
}, {
  timestamps: true,
  versionKey: false
});

// Compound indexes for performance
phoneVerificationSchema.index({ userId: 1, expiresAt: 1 });
phoneVerificationSchema.index({ phoneNumber: 1, verified: 1 });
phoneVerificationSchema.index({ phoneNumber: 1, expiresAt: 1 });

// Static method to cleanup expired codes
phoneVerificationSchema.statics.cleanupExpired = function() {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

// Static method to create verification code
phoneVerificationSchema.statics.createVerification = function(userId, phoneNumber, code, expiresAt, provider = 'custom') {
  return this.create({
    userId,
    phoneNumber,
    code,
    expiresAt,
    provider
  });
};

// Static method to find valid verification
phoneVerificationSchema.statics.findValidVerification = function(phoneNumber, code) {
  return this.findOne({
    phoneNumber,
    code,
    expiresAt: { $gt: new Date() },
    verified: false,
    attempts: { $lt: 3 }
  });
};

// Static method to verify phone
phoneVerificationSchema.statics.verifyPhone = function(phoneNumber, code) {
  return this.findOneAndUpdate(
    {
      phoneNumber,
      code,
      expiresAt: { $gt: new Date() },
      verified: false,
      attempts: { $lt: 3 }
    },
    {
      verified: true,
      $inc: { attempts: 1 }
    },
    { new: true }
  );
};

// Static method to get recent attempts
phoneVerificationSchema.statics.getRecentAttempts = function(phoneNumber, timeWindow = 10) {
  const cutoff = new Date(Date.now() - timeWindow * 60 * 1000); // timeWindow minutes ago
  return this.countDocuments({
    phoneNumber,
    createdAt: { $gte: cutoff }
  });
};

// Instance method to increment attempts
phoneVerificationSchema.methods.incrementAttempts = function() {
  this.attempts += 1;
  return this.save();
};

// Instance method to check if expired
phoneVerificationSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Instance method to check if max attempts reached
phoneVerificationSchema.methods.maxAttemptsReached = function() {
  return this.attempts >= 3;
};

const PhoneVerification = mongoose.model('PhoneVerification', phoneVerificationSchema);

module.exports = PhoneVerification;