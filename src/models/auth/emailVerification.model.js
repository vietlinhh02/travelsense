const mongoose = require('mongoose');

const emailVerificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    index: true
  },
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
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
  }
}, {
  timestamps: true,
  versionKey: false
});

// Compound indexes for performance
emailVerificationSchema.index({ userId: 1, expiresAt: 1 });
emailVerificationSchema.index({ email: 1, verified: 1 });
emailVerificationSchema.index({ token: 1, expiresAt: 1 });

// Static method to cleanup expired tokens
emailVerificationSchema.statics.cleanupExpired = function() {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

// Static method to create verification token
emailVerificationSchema.statics.createVerification = function(userId, email, token, expiresAt) {
  return this.create({
    userId,
    email,
    token,
    expiresAt
  });
};

// Static method to find valid verification
emailVerificationSchema.statics.findValidVerification = function(token) {
  return this.findOne({
    token,
    expiresAt: { $gt: new Date() },
    verified: false,
    attempts: { $lt: 3 }
  });
};

// Static method to verify email
emailVerificationSchema.statics.verifyEmail = function(token) {
  return this.findOneAndUpdate(
    {
      token,
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

// Instance method to increment attempts
emailVerificationSchema.methods.incrementAttempts = function() {
  this.attempts += 1;
  return this.save();
};

// Instance method to check if expired
emailVerificationSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Instance method to check if max attempts reached
emailVerificationSchema.methods.maxAttemptsReached = function() {
  return this.attempts >= 3;
};

const EmailVerification = mongoose.model('EmailVerification', emailVerificationSchema);

module.exports = EmailVerification;