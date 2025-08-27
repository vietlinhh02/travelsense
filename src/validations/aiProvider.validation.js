const Joi = require('joi');

const switchProvider = {
  body: Joi.object().keys({
    provider: Joi.string().valid('gemini', 'openrouter').required()
  })
};

const testProvider = {
  body: Joi.object().keys({
    provider: Joi.string().valid('gemini', 'openrouter').optional(),
    model: Joi.string().optional().default('flash')
  })
};

module.exports = {
  switchProvider,
  testProvider
};
