const mongoose = require('mongoose');
const crypto = require('crypto');

const twoFactorAuthSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  method: {
    type: String,
    enum: ['sms', 'email', 'authenticator'],
    required: true
  },
  secret: {
    type: String,
    // Only required for authenticator method
    required: function() {
      return this.method === 'authenticator';
    }
  },
  enabled: {
    type: Boolean,
    default: false
  },
  backupCodes: {
    type: [String],
    default: []
  },
  lastUsed: {
    type: Date,
    default: null
  },
  failedAttempts: {
    type: Number,
    default: 0,
    max: 5
  },
  lockedUntil: {
    type: Date,
    default: null
  },
  phoneNumber: {
    type: String,
    // Required for SMS method
    required: function() {
      return this.method === 'sms';
    }
  },
  email: {
    type: String,
    // Required for email method
    required: function() {
      return this.method === 'email';
    }
  }
}, {
  timestamps: true,
  versionKey: false
});

// Indexes for performance
twoFactorAuthSchema.index({ userId: 1, enabled: 1 });
twoFactorAuthSchema.index({ method: 1, enabled: 1 });

// Static method to generate backup codes
twoFactorAuthSchema.statics.generateBackupCodes = function(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
};

// Static method to enable 2FA for user
twoFactorAuthSchema.statics.enable2FA = function(userId, method, options = {}) {
  const data = {
    userId,
    method,
    enabled: true,
    backupCodes: this.generateBackupCodes()
  };

  if (method === 'authenticator' && options.secret) {
    data.secret = options.secret;
  } else if (method === 'sms' && options.phoneNumber) {
    data.phoneNumber = options.phoneNumber;
  } else if (method === 'email' && options.email) {
    data.email = options.email;
  }

  return this.findOneAndUpdate(
    { userId },
    data,
    { upsert: true, new: true }
  );
};

// Static method to disable 2FA for user
twoFactorAuthSchema.statics.disable2FA = function(userId) {
  return this.findOneAndUpdate(
    { userId },
    { 
      enabled: false,
      secret: null,
      backupCodes: [],
      failedAttempts: 0,
      lockedUntil: null
    },
    { new: true }
  );
};

// Static method to find 2FA settings for user
twoFactorAuthSchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId, enabled: true });
};

// Instance method to verify backup code
twoFactorAuthSchema.methods.verifyBackupCode = function(code) {
  const index = this.backupCodes.indexOf(code.toUpperCase());
  if (index !== -1) {
    // Remove used backup code
    this.backupCodes.splice(index, 1);
    this.lastUsed = new Date();
    this.failedAttempts = 0;
    this.lockedUntil = null;
    return this.save().then(() => true);
  }
  return false;
};

// Instance method to check if account is locked
twoFactorAuthSchema.methods.isLocked = function() {
  return this.lockedUntil && this.lockedUntil > new Date();
};

// Instance method to increment failed attempts
twoFactorAuthSchema.methods.incrementFailedAttempts = function() {
  this.failedAttempts += 1;
  
  // Lock account for 15 minutes after 5 failed attempts
  if (this.failedAttempts >= 5) {
    this.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
  }
  
  return this.save();
};

// Instance method to reset failed attempts
twoFactorAuthSchema.methods.resetFailedAttempts = function() {
  this.failedAttempts = 0;
  this.lockedUntil = null;
  this.lastUsed = new Date();
  return this.save();
};

// Instance method to generate new backup codes
twoFactorAuthSchema.methods.regenerateBackupCodes = function() {
  this.backupCodes = this.constructor.generateBackupCodes();
  return this.save();
};

// Instance method to get remaining backup codes count
twoFactorAuthSchema.methods.getRemainingBackupCodes = function() {
  return this.backupCodes.length;
};

const TwoFactorAuth = mongoose.model('TwoFactorAuth', twoFactorAuthSchema);

module.exports = TwoFactorAuth;