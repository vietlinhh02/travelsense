const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    maxlength: 254
  },
  password: {
    type: String,
    required: function() {
      // Password is required only if googleId is not present
      return !this.googleId;
    },
    minlength: 8,
    maxlength: 128
  },
  firstName: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 50
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  phoneNumber: {
    type: String,
    trim: true,
    maxlength: 20
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  googleId: {
    type: String,
    sparse: true
  },
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorMethod: {
    type: String,
    enum: ['sms', 'email', 'authenticator'],
    default: undefined // Use undefined instead of null for enum fields
  },
  twoFactorSecret: {
    type: String,
    default: null // For authenticator apps
  },
  preferences: {
    interests: {
      type: [String],
      default: [],
      validate: {
        validator: function(arr) {
          return arr.length <= 20 && arr.every(item => typeof item === 'string' && item.length <= 50);
        },
        message: 'Maximum 20 interests, each with max 50 characters'
      }
    },
    constraints: {
      type: [String],
      default: [],
      validate: {
        validator: function(arr) {
          return arr.length <= 10 && arr.every(item => typeof item === 'string' && item.length <= 100);
        },
        message: 'Maximum 10 constraints, each with max 100 characters'
      }
    },
    travelStyle: {
      type: String,
      enum: ['budget', 'luxury', 'adventure', 'cultural', 'family', 'business'],
      default: undefined // Use undefined instead of null for enum fields
    },
    budgetRange: {
      type: String,
      enum: ['low', 'medium', 'high', 'luxury'],
      default: undefined // Use undefined instead of null for enum fields
    }
  },
  profile: {
    dateOfBirth: {
      type: Date,
      validate: {
        validator: function(date) {
          return !date || date < new Date();
        },
        message: 'Date of birth must be in the past'
      }
    },
    nationality: {
      type: String,
      maxlength: 50,
      trim: true
    },
    languages: {
      type: [String],
      default: [],
      validate: {
        validator: function(arr) {
          return arr.length <= 10 && arr.every(item => typeof item === 'string' && item.length <= 30);
        },
        message: 'Maximum 10 languages, each with max 30 characters'
      }
    },
    specialRequirements: {
      type: [String],
      default: [],
      validate: {
        validator: function(arr) {
          return arr.length <= 5 && arr.every(item => typeof item === 'string' && item.length <= 100);
        },
        message: 'Maximum 5 special requirements, each with max 100 characters'
      }
    }
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'provider'],
    default: 'user'
  },
  lastLogin: {
    type: Date,
    default: null
  },
  // OTP for email login
  otp: {
    code: {
      type: String,
      default: null
    },
    expiresAt: {
      type: Date,
      default: null
    }
  },
  // Email verification token
  emailVerificationToken: {
    token: {
      type: String,
      default: null
    },
    expiresAt: {
      type: Date,
      default: null
    }
  },
  // Phone verification code
  phoneVerificationCode: {
    code: {
      type: String,
      default: null
    },
    expiresAt: {
      type: Date,
      default: null
    }
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  versionKey: false
});

// Index for performance
userSchema.index({ email: 1 });
userSchema.index({ googleId: 1 });
userSchema.index({ phoneNumber: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash password if it's modified (or new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to generate OTP
userSchema.methods.generateOTP = function() {
  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Set OTP with 5-minute expiration
  this.otp = {
    code: otp,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
  };
  
  return otp;
};

// Method to validate OTP
userSchema.methods.validateOTP = function(candidateOTP) {
  if (!this.otp || !this.otp.code || !this.otp.expiresAt) {
    return false;
  }
  
  // Check if OTP is expired
  if (new Date() > this.otp.expiresAt) {
    return false;
  }
  
  // Check if OTP matches
  return this.otp.code === candidateOTP;
};

// Method to clear OTP
userSchema.methods.clearOTP = function() {
  this.otp = {
    code: null,
    expiresAt: null
  };
};

// Method to generate email verification token
userSchema.methods.generateEmailVerificationToken = function() {
  const jwt = require('jsonwebtoken');
  const config = require('../../config/config');
  
  // Generate JWT token with 24-hour expiration
  const token = jwt.sign(
    { userId: this._id, email: this.email, type: 'email_verification' },
    config.jwt.accessTokenSecret,
    { expiresIn: '24h' }
  );
  
  // Set verification token with 24-hour expiration
  this.emailVerificationToken = {
    token: token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  };
  
  return token;
};

// Method to validate email verification token
userSchema.methods.validateEmailVerificationToken = function(candidateToken) {
  if (!this.emailVerificationToken || !this.emailVerificationToken.token || !this.emailVerificationToken.expiresAt) {
    return false;
  }
  
  // Check if token is expired
  if (new Date() > this.emailVerificationToken.expiresAt) {
    return false;
  }
  
  // Check if token matches
  return this.emailVerificationToken.token === candidateToken;
};

// Method to clear email verification token
userSchema.methods.clearEmailVerificationToken = function() {
  this.emailVerificationToken = {
    token: null,
    expiresAt: null
  };
};

// Method to generate phone verification code
userSchema.methods.generatePhoneVerificationCode = function() {
  // Generate 6-digit verification code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  // Set verification code with 10-minute expiration
  this.phoneVerificationCode = {
    code: code,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  };
  
  return code;
};

// Method to validate phone verification code
userSchema.methods.validatePhoneVerificationCode = function(candidateCode) {
  if (!this.phoneVerificationCode || !this.phoneVerificationCode.code || !this.phoneVerificationCode.expiresAt) {
    return false;
  }
  
  // Check if code is expired
  if (new Date() > this.phoneVerificationCode.expiresAt) {
    return false;
  }
  
  // Check if code matches
  return this.phoneVerificationCode.code === candidateCode;
};

// Method to clear phone verification code
userSchema.methods.clearPhoneVerificationCode = function() {
  this.phoneVerificationCode = {
    code: null,
    expiresAt: null
  };
};

// Method to enable 2FA
userSchema.methods.enable2FA = function(method) {
  this.twoFactorEnabled = true;
  this.twoFactorMethod = method;
  
  // Generate secret for authenticator apps
  if (method === 'authenticator') {
    const crypto = require('crypto');
    this.twoFactorSecret = crypto.randomBytes(20).toString('hex');
  } else {
    this.twoFactorSecret = null;
  }
};

// Method to disable 2FA
userSchema.methods.disable2FA = function() {
  this.twoFactorEnabled = false;
  this.twoFactorMethod = undefined;
  this.twoFactorSecret = null;
};

// Method to get 2FA QR code data for authenticator apps
userSchema.methods.get2FAQRData = function() {
  if (this.twoFactorMethod !== 'authenticator' || !this.twoFactorSecret) {
    return null;
  }
  
  // In production, you would generate a proper TOTP URI
  // For testing purposes, return mock data
  return {
    secret: this.twoFactorSecret,
    qrCode: `otpauth://totp/TravelApp:${this.email}?secret=${this.twoFactorSecret}&issuer=TravelApp`
  };
};

// Method to get public profile (exclude sensitive data)
userSchema.methods.toPublicJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.twoFactorMethod;
  return user;
};

// Static method to find user by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase().trim() });
};

// Static method to find user by Google ID
userSchema.statics.findByGoogleId = function(googleId) {
  return this.findOne({ googleId });
};

const User = mongoose.model('User', userSchema);

module.exports = User;