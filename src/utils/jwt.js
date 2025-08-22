const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { BlacklistToken } = require('../models/auth');
const config = require('../config/config');

// Generate access and refresh tokens
const generateTokens = (user) => {
    const accessToken = jwt.sign(
        { userId: user._id, email: user.email },
        config.jwt.accessTokenSecret,
        { expiresIn: '15m' }
    );

    const tokenId = crypto.randomBytes(16).toString('hex');
    const refreshToken = jwt.sign(
        { userId: user._id, tokenId },
        config.jwt.refreshTokenSecret,
        { expiresIn: '7d' }
    );

    return { accessToken, refreshToken, tokenId };
};

// Verify token signature and expiration
const verifyToken = (token, tokenType = 'access') => {
    try {
        const secret = tokenType === 'access' 
            ? config.jwt.accessTokenSecret 
            : config.jwt.refreshTokenSecret;
            
        return jwt.verify(token, secret);
    } catch (error) {
        throw new Error(`Token verification failed: ${error.message}`);
    }
};

// Decode token without verification
const decodeToken = (token) => {
    return jwt.decode(token);
};

// Add token to blacklist
const blacklistToken = async (tokenId, userId) => {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    await BlacklistToken.create({ tokenId, userId, blacklistedAt: new Date(), expiresAt });
};

// Check if token is blacklisted
const isTokenBlacklisted = async (tokenId) => {
    const token = await BlacklistToken.findOne({ tokenId });
    return !!token;
};

module.exports = {
    generateTokens,
    verifyToken,
    decodeToken,
    blacklistToken,
    isTokenBlacklisted
};