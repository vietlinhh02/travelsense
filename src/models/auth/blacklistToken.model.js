const mongoose = require('mongoose');

const blacklistTokenSchema = new mongoose.Schema({
  tokenId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  blacklistedAt: {
    type: Date,
    default: Date.now,
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 } // MongoDB TTL index for automatic cleanup
  },
  reason: {
    type: String,
    enum: ['revoked', 'expired', 'compromised', 'logout'],
    default: 'revoked'
  }
}, {
  timestamps: true,
  versionKey: false
});

// Compound indexes for performance
blacklistTokenSchema.index({ tokenId: 1, expiresAt: 1 });
blacklistTokenSchema.index({ userId: 1, blacklistedAt: 1 });

// Static method to cleanup expired tokens
blacklistTokenSchema.statics.cleanupExpired = function() {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

// Static method to blacklist token
blacklistTokenSchema.statics.blacklistToken = function(tokenId, userId, expiresAt, reason = 'revoked') {
  return this.create({
    tokenId,
    userId,
    expiresAt,
    reason
  });
};

// Static method to check if token is blacklisted
blacklistTokenSchema.statics.isTokenBlacklisted = function(tokenId) {
  return this.findOne({ 
    tokenId,
    expiresAt: { $gt: new Date() }
  });
};

// Static method to revoke all tokens for a user
blacklistTokenSchema.statics.revokeAllForUser = function(userId, reason = 'logout') {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  return this.updateMany(
    { userId },
    { 
      $set: { 
        blacklistedAt: new Date(),
        expiresAt,
        reason
      }
    },
    { upsert: false }
  );
};

const BlacklistToken = mongoose.model('BlacklistToken', blacklistTokenSchema);

module.exports = BlacklistToken;