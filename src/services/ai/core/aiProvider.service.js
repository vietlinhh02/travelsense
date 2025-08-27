const GeminiApiClient = require('../client/geminiApiClient');
const OpenRouterApiClient = require('../client/openrouterApiClient');

/**
 * AIProviderService - Manages different AI providers
 * Allows easy switching between Gemini, OpenRouter, and future providers
 */
class AIProviderService {
  constructor() {
    // Get provider from environment variable
    this.selectedProvider = process.env.AI_PROVIDER || 'gemini';
    
    // Initialize clients
    this.providers = {
      gemini: new GeminiApiClient(),
      openrouter: new OpenRouterApiClient()
    };

    // Validate provider
    if (!this.providers[this.selectedProvider]) {
      console.warn(`Invalid AI provider '${this.selectedProvider}', falling back to 'gemini'`);
      this.selectedProvider = 'gemini';
    }

    console.log(`AI Provider initialized: ${this.selectedProvider.toUpperCase()}`);
    console.log(`Available providers: ${Object.keys(this.providers).join(', ')}`);
  }

  /**
   * Get the current active provider client
   * @returns {GeminiApiClient|OpenRouterApiClient} Active provider client
   */
  getActiveProvider() {
    return this.providers[this.selectedProvider];
  }

  /**
   * Get provider name
   * @returns {string} Current provider name
   */
  getProviderName() {
    return this.selectedProvider;
  }

  /**
   * Switch provider (useful for admin controls)
   * @param {string} providerName - Provider name ('gemini' or 'openrouter')
   * @returns {boolean} Success status
   */
  switchProvider(providerName) {
    if (!this.providers[providerName]) {
      console.error(`Unknown provider: ${providerName}`);
      return false;
    }

    this.selectedProvider = providerName;
    console.log(`Switched to provider: ${providerName.toUpperCase()}`);
    return true;
  }

  /**
   * Check if current provider has valid API key
   * @returns {boolean} Whether current provider is properly configured
   */
  isProviderConfigured() {
    const provider = this.getActiveProvider();
    return provider.hasValidApiKey();
  }

  /**
   * Get provider status information
   * @returns {Object} Provider status details
   */
  getProviderStatus() {
    const status = {};
    
    for (const [name, client] of Object.entries(this.providers)) {
      status[name] = {
        configured: client.hasValidApiKey(),
        active: name === this.selectedProvider
      };
    }

    return {
      current: this.selectedProvider,
      providers: status,
      isConfigured: this.isProviderConfigured()
    };
  }

  /**
   * Unified API call method - delegates to active provider
   * @param {string} model - Model type ('flash', 'pro', or provider-specific)
   * @param {string} prompt - Prompt to send
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} API response
   */
  async callAPI(model, prompt, options = {}) {
    const provider = this.getActiveProvider();
    
    if (this.selectedProvider === 'gemini') {
      return await provider.callGeminiAPI(model, prompt, options);
    } else if (this.selectedProvider === 'openrouter') {
      return await provider.callOpenRouterAPI(model, prompt, options);
    } else {
      throw new Error(`Unsupported provider: ${this.selectedProvider}`);
    }
  }

  /**
   * Unified structured output API call - delegates to active provider
   * @param {string} model - Model type
   * @param {string} prompt - Prompt to send
   * @param {Object} structuredConfig - Schema configuration
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Structured API response
   */
  async callStructuredAPI(model, prompt, structuredConfig, options = {}) {
    const provider = this.getActiveProvider();
    
    if (this.selectedProvider === 'gemini') {
      return await provider.callGeminiWithStructuredOutput(model, prompt, structuredConfig, options);
    } else if (this.selectedProvider === 'openrouter') {
      return await provider.callOpenRouterWithStructuredOutput(model, prompt, structuredConfig, options);
    } else {
      throw new Error(`Unsupported provider: ${this.selectedProvider}`);
    }
  }

  /**
   * Get model recommendations for current provider
   * @returns {Object} Model recommendations
   */
  getModelRecommendations() {
    if (this.selectedProvider === 'gemini') {
      return {
        fast: 'flash',
        quality: 'pro',
        default: 'flash'
      };
    } else if (this.selectedProvider === 'openrouter') {
      return {
        fast: 'claude-haiku',
        quality: 'claude-sonnet',
        default: 'claude-sonnet'
      };
    }
    
    return { default: 'flash' };
  }

  /**
   * Get provider-specific configuration
   * @returns {Object} Provider configuration
   */
  getProviderConfig() {
    const provider = this.getActiveProvider();
    
    if (this.selectedProvider === 'gemini') {
      return {
        name: 'Google Gemini',
        models: ['flash', 'pro'],
        features: ['structured_output', 'json_schema', 'vietnamese_support'],
        maxTokens: 10000
      };
    } else if (this.selectedProvider === 'openrouter') {
      return {
        name: 'OpenRouter',
        models: Object.keys(provider.availableModels),
        features: ['multiple_models', 'prompt_engineering', 'vietnamese_support'],
        maxTokens: 10000
      };
    }
    
    return {};
  }
}

// Singleton instance
let providerInstance = null;

/**
 * Get singleton instance of AIProviderService
 * @returns {AIProviderService} Singleton instance
 */
function getAIProvider() {
  if (!providerInstance) {
    providerInstance = new AIProviderService();
  }
  return providerInstance;
}

module.exports = {
  AIProviderService,
  getAIProvider
};
