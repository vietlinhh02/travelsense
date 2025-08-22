const mongoose = require('mongoose');

const accountRecoverySchema = new mongoose.Schema({
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
  used: {
    type: Boolean,
    default: false
  },
  attempts: {
    type: Number,
    default: 0,
    max: 3
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  recoveryType: {
    type: String,
    enum: ['password_reset', 'account_unlock', 'email_change'],
    default: 'password_reset'
  }
}, {
  timestamps: true,
  versionKey: false
});

// Compound indexes for performance
accountRecoverySchema.index({ userId: 1, used: 1 });
accountRecoverySchema.index({ email: 1, expiresAt: 1 });
accountRecoverySchema.index({ token: 1, expiresAt: 1 });
accountRecoverySchema.index({ userId: 1, recoveryType: 1 });

// Static method to cleanup expired tokens
accountRecoverySchema.statics.cleanupExpired = function() {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

// Static method to create recovery token
accountRecoverySchema.statics.createRecovery = function(userId, email, token, expiresAt, recoveryType = 'password_reset', metadata = {}) {
  return this.create({
    userId,
    email,
    token,
    expiresAt,
    recoveryType,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent
  });
};

// Static method to find valid recovery token
accountRecoverySchema.statics.findValidRecovery = function(token, recoveryType = null) {
  const query = {
    token,
    expiresAt: { $gt: new Date() },
    used: false,
    attempts: { $lt: 3 }
  };
  
  if (recoveryType) {
    query.recoveryType = recoveryType;
  }
  
  return this.findOne(query);
};

// Static method to use recovery token
accountRecoverySchema.statics.useRecovery = function(token, recoveryType = null) {
  const query = {
    token,
    expiresAt: { $gt: new Date() },
    used: false,
    attempts: { $lt: 3 }
  };
  
  if (recoveryType) {
    query.recoveryType = recoveryType;
  }
  
  return this.findOneAndUpdate(
    query,
    {
      used: true,
      $inc: { attempts: 1 }
    },
    { new: true }
  );
};

// Static method to get recent recovery attempts
accountRecoverySchema.statics.getRecentAttempts = function(email, timeWindow = 60, recoveryType = null) {
  const query = {
    email,
    createdAt: { $gte: new Date(Date.now() - timeWindow * 60 * 1000) }
  };
  
  if (recoveryType) {
    query.recoveryType = recoveryType;
  }
  
  return this.countDocuments(query);
};

// Static method to invalidate all recovery tokens for user
accountRecoverySchema.statics.invalidateAllForUser = function(userId, recoveryType = null) {
  const query = { userId, used: false };
  if (recoveryType) {
    query.recoveryType = recoveryType;
  }
  
  return this.updateMany(query, { used: true });
};

// Static method to invalidate all recovery tokens for email
accountRecoverySchema.statics.invalidateAllForEmail = function(email, recoveryType = null) {
  const query = { email, used: false };
  if (recoveryType) {
    query.recoveryType = recoveryType;
  }
  
  return this.updateMany(query, { used: true });
};

// Instance method to increment attempts
accountRecoverySchema.methods.incrementAttempts = function() {
  this.attempts += 1;
  return this.save();
};

// Instance method to check if expired
accountRecoverySchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

// Instance method to check if max attempts reached
accountRecoverySchema.methods.maxAttemptsReached = function() {
  return this.attempts >= 3;
};

// Instance method to mark as used
accountRecoverySchema.methods.markAsUsed = function() {
  this.used = true;
  this.attempts += 1;
  return this.save();
};

// Instance method to check if valid
accountRecoverySchema.methods.isValid = function() {
  return !this.used && !this.isExpired() && !this.maxAttemptsReached();
};

const AccountRecovery = mongoose.model('AccountRecovery', accountRecoverySchema);

module.exports = AccountRecovery;