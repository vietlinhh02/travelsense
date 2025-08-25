const GeminiService = require('./gemini.service');
const GeminiApiClient = require('./geminiApiClient');
const PromptBuilder = require('./promptBuilder');
const ResponseParser = require('./responseParser');
const ActivityTemplateService = require('./activityTemplateService');

// Create instance of GeminiService
const geminiService = new GeminiService();

module.exports = {
  geminiService,
  GeminiApiClient,
  PromptBuilder,
  ResponseParser,
  ActivityTemplateService
};