const Joi = require('joi');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const envVarsSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    PORT: Joi.number().default(5000),
    MONGO_URI: Joi.string().uri().required().description('MongoDB connection URI'),
    JWT_SECRET: Joi.string().min(32).required().description('JWT secret key'),
    JWT_ACCESS_TOKEN_SECRET: Joi.string().min(32).required().description('JWT access token secret key'),
    JWT_REFRESH_TOKEN_SECRET: Joi.string().min(32).required().description('JWT refresh token secret key'),
    SMTP_HOST: Joi.string().default('localhost').description('SMTP host'),
    SMTP_PORT: Joi.number().default(587).description('SMTP port'),
    SMTP_USER: Joi.string().default('').description('SMTP user'),
    SMTP_PASS: Joi.string().default('').description('SMTP password'),
    SMTP_FROM: Joi.string().email().default('noreply@example.com').description('Default from email'),
    GEMINI_API_KEY: Joi.string().default('').description('Gemini API key'),
    GEMINI_API_SECRET: Joi.string().default('').description('Gemini API secret'),
    AI_PROVIDER: Joi.string().valid('gemini', 'openrouter').default('gemini').description('AI provider to use'),
    OPENROUTER_API_KEY: Joi.string().default('').description('OpenRouter API key'),
    OPENROUTER_DEFAULT_MODEL: Joi.string().default('anthropic/claude-3.5-sonnet').description('Default OpenRouter model'),
    OPENROUTER_SITE_NAME: Joi.string().default('TravelSense').description('OpenRouter site name'),
    OPENROUTER_SITE_URL: Joi.string().default('https://travelsense.com').description('OpenRouter site URL')
})
.unknown();

const { value: envVars, error: validationError } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (validationError) {
    throw new Error(`Config validation error: ${validationError.message}`);
}

module.exports = {
    env: envVars.NODE_ENV,
    port: envVars.PORT,
    mongoose: {
        url: envVars.MONGO_URI + (envVars.NODE_ENV === 'test' ? '-test' : ''),
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }
    },
    jwt: {
        secret: envVars.JWT_SECRET,
        accessTokenSecret: envVars.JWT_ACCESS_TOKEN_SECRET,
        refreshTokenSecret: envVars.JWT_REFRESH_TOKEN_SECRET,
        accessToken: {
            expiresIn: '15m' // 15 minutes as per spec
        },
        refreshToken: {
            expiresIn: '7d' // 7 days as per spec
        }
    },
    email: {
        smtp: {
            host: envVars.SMTP_HOST,
            port: envVars.SMTP_PORT,
            auth: {
                user: envVars.SMTP_USER,
                pass: envVars.SMTP_PASS
            }
        },
        from: envVars.SMTP_FROM
    },
    gemini: {
        apiKey: envVars.GEMINI_API_KEY,
        apiSecret: envVars.GEMINI_API_SECRET
    },
    ai: {
        provider: envVars.AI_PROVIDER,
        openrouter: {
            apiKey: envVars.OPENROUTER_API_KEY,
            defaultModel: envVars.OPENROUTER_DEFAULT_MODEL,
            siteName: envVars.OPENROUTER_SITE_NAME,
            siteUrl: envVars.OPENROUTER_SITE_URL
        }
    },
    log: {
        level: envVars.NODE_ENV === 'development' ? 'debug' : 'info'
    },
    cors: {
        origin: envVars.NODE_ENV === 'production' ? false : true,
        credentials: true
    }
};