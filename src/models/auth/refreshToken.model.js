const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  tokenId: {
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
  lastUsedAt: {
    type: Date,
    default: Date.now
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  deviceInfo: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  versionKey: false
});

// Index for cleanup and performance
refreshTokenSchema.index({ userId: 1, expiresAt: 1 });
refreshTokenSchema.index({ tokenId: 1, expiresAt: 1 });
refreshTokenSchema.index({ userId: 1, lastUsedAt: -1 });

// Static method to cleanup expired tokens
refreshTokenSchema.statics.cleanupExpired = function() {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

// Static method to revoke all tokens for a user
refreshTokenSchema.statics.revokeAllForUser = function(userId) {
  return this.deleteMany({ userId });
};

// Static method to find active tokens for user
refreshTokenSchema.statics.findActiveForUser = function(userId) {
  return this.find({ 
    userId,
    expiresAt: { $gt: new Date() }
  }).sort({ lastUsedAt: -1 });
};

// Static method to create new refresh token
refreshTokenSchema.statics.createToken = function(userId, tokenId, expiresAt, metadata = {}) {
  return this.create({
    userId,
    tokenId,
    expiresAt,
    ipAddress: metadata.ipAddress,
    userAgent: metadata.userAgent,
    deviceInfo: metadata.deviceInfo
  });
};

// Instance method to update last used time
refreshTokenSchema.methods.updateLastUsed = function(metadata = {}) {
  this.lastUsedAt = new Date();
  if (metadata.ipAddress) this.ipAddress = metadata.ipAddress;
  if (metadata.userAgent) this.userAgent = metadata.userAgent;
  return this.save();
};

// Instance method to check if token is expired
refreshTokenSchema.methods.isExpired = function() {
  return this.expiresAt < new Date();
};

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

module.exports = RefreshToken;