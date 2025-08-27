const axios = require('axios');

/**
 * OpenRouterApiClient - Handles communication with OpenRouter API
 * Supports multiple AI models through OpenRouter unified interface
 */
class OpenRouterApiClient {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || 'mock-api-key';
    this.baseUrl = 'https://openrouter.ai/api/v1';
    this.siteName = process.env.OPENROUTER_SITE_NAME || 'TravelSense';
    this.siteUrl = process.env.OPENROUTER_SITE_URL || 'https://travelsense.com';

    // Log API key status
    if (this.hasValidApiKey()) {
      console.log('OpenRouter API key is configured');
    } else {
      console.warn('OpenRouter API key is not configured - using mock key');
    }

    // Model configurations - can be easily changed via environment
    this.defaultModel = process.env.OPENROUTER_DEFAULT_MODEL || 'anthropic/claude-3.5-sonnet';
    
    // Alternative models available
    this.availableModels = {
      'claude-sonnet': 'anthropic/claude-3.5-sonnet',
      'claude-haiku': 'anthropic/claude-3-haiku',
      'gpt-4': 'openai/gpt-4-turbo',
      'gpt-4-mini': 'openai/gpt-4o-mini',
      'llama': 'meta-llama/llama-3.1-70b-instruct',
      'gemini': 'google/gemini-pro-1.5'
    };

    // Default generation config
    this.defaultGenerationConfig = {
      temperature: 0.7,
      max_tokens: 8000,
      top_p: 0.95,
      frequency_penalty: 0,
      presence_penalty: 0
    };
  }

  /**
   * Check if we have a valid API key
   * @returns {boolean} Whether API key is valid
   */
  hasValidApiKey() {
    return this.apiKey && this.apiKey !== 'mock-api-key';
  }

  /**
   * Get the model name to use
   * @param {string} model - Model alias or full name
   * @returns {string} Full model name
   */
  getModelName(model = 'default') {
    if (model === 'default' || model === 'flash' || model === 'pro') {
      return this.defaultModel;
    }
    return this.availableModels[model] || model;
  }

  /**
   * Main method to call OpenRouter API with retry logic
   * @param {string} model - Model type or alias
   * @param {string} prompt - Prompt to send
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} API response
   */
  async callOpenRouterAPI(model, prompt, options = {}) {
    if (!this.hasValidApiKey()) {
      console.warn('No valid OpenRouter API key found.');
      throw new Error('NO_VALID_OPENROUTER_API_KEY');
    }

    const modelName = this.getModelName(model);
    const requestPayload = this._buildRequestPayload(modelName, prompt, options);

    console.log(`Making OpenRouter API call to ${modelName}...`);
    console.log(`Prompt length: ${prompt.length} characters`);

    return await this._executeWithRetry(requestPayload);
  }

  /**
   * Call OpenRouter API with structured output request
   * Note: OpenRouter doesn't have built-in structured output like Gemini,
   * so we use prompt engineering and JSON parsing
   * @param {string} model - Model type
   * @param {string} prompt - Prompt to send
   * @param {Object} structuredConfig - Schema configuration (for compatibility)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Structured API response
   */
  async callOpenRouterWithStructuredOutput(model, prompt, structuredConfig, options = {}) {
    if (!this.hasValidApiKey()) {
      console.warn('No valid OpenRouter API key found.');
      throw new Error('NO_VALID_OPENROUTER_API_KEY');
    }

    // Enhance prompt to request JSON output
    const enhancedPrompt = this._enhancePromptForStructuredOutput(prompt, structuredConfig);
    
    const modelName = this.getModelName(model);
    const requestPayload = this._buildRequestPayload(modelName, enhancedPrompt, options);

    console.log(` Making structured output call to ${modelName} via OpenRouter...`);
    console.log(` Response type: ${structuredConfig.responseMimeType || 'application/json'}`);
    console.log(` Enhanced prompt length: ${enhancedPrompt.length} characters`);

    const response = await this._executeWithRetry(requestPayload);

    // Parse structured response
    return this._parseStructuredResponse(response, structuredConfig);
  }

  /**
   * Execute API call with retry logic
   * @param {Object} requestPayload - Request payload
   * @returns {Promise<Object>} API response
   */
  async _executeWithRetry(requestPayload) {
    const maxRetries = 2;
    let attempt = 1;

    while (attempt <= maxRetries) {
      try {
        console.log(`Attempt ${attempt}/${maxRetries}...`);

        const response = await axios.post(`${this.baseUrl}/chat/completions`, requestPayload, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': this.siteUrl,
            'X-Title': this.siteName
          },
          timeout: 60000 // 60 second timeout
        });

        return this._processResponse(response, requestPayload.model);
        
      } catch (error) {
        console.log(` Attempt ${attempt} failed: ${error.message}`);
        
        if (error.response) {
          console.error(` HTTP ${error.response.status}: ${error.response.statusText}`);
          console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
        } else if (error.request) {
          console.error(' No response received from server');
        }
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s
        console.log(` Waiting ${waitTime/1000}s before retry...`);
        await this._delay(waitTime);
        
        attempt++;
      }
    }
  }

  /**
   * Build request payload for OpenRouter API
   * @param {string} modelName - Full model name
   * @param {string} prompt - Prompt text
   * @param {Object} options - Additional options
   * @returns {Object} Request payload
   */
  _buildRequestPayload(modelName, prompt, options = {}) {
    return {
      model: modelName,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      ...this.defaultGenerationConfig,
      ...(options.generationConfig || {}),
      stream: false
    };
  }

  /**
   * Enhance prompt to request structured JSON output
   * @param {string} originalPrompt - Original prompt
   * @param {Object} structuredConfig - Schema configuration
   * @returns {string} Enhanced prompt
   */
  _enhancePromptForStructuredOutput(originalPrompt, structuredConfig) {
    let enhancedPrompt = originalPrompt;

    // Add JSON format instruction
    enhancedPrompt += '\n\nQuy định về format trả về:';
    enhancedPrompt += '\n- PHẢI trả về JSON hợp lệ';
    enhancedPrompt += '\n- KHÔNG bao gồm markdown code blocks (```json)';
    enhancedPrompt += '\n- KHÔNG có text giải thích thêm';
    enhancedPrompt += '\n- CHỈ trả về JSON thuần túy';

    // Add schema hints based on response type
    if (structuredConfig?.responseSchema?.type === 'ARRAY') {
      enhancedPrompt += '\n- Format: trả về JSON array []';
    } else if (structuredConfig?.responseSchema?.type === 'OBJECT') {
      enhancedPrompt += '\n- Format: trả về JSON object {}';
    }

    // Add specific field requirements if available
    if (structuredConfig?.responseSchema?.properties || structuredConfig?.responseSchema?.items?.properties) {
      enhancedPrompt += '\n- Đảm bảo có đủ tất cả các field bắt buộc theo yêu cầu';
    }

    enhancedPrompt += '\n\nTrả về JSON ngay bây giờ:';

    return enhancedPrompt;
  }

  /**
   * Process API response and normalize to match Gemini format
   * @param {Object} response - Axios response
   * @param {string} modelName - Model name
   * @returns {Object} Normalized response
   */
  _processResponse(response, modelName) {
    const data = response.data;
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error('No choices returned from OpenRouter API');
    }

    const choice = data.choices[0];
    const content = choice.message?.content || '';

    // Calculate token usage
    const usage = data.usage || {};
    const tokensUsed = usage.total_tokens || usage.prompt_tokens + usage.completion_tokens || 0;

    console.log(`OpenRouter API call successful - Model: ${modelName}`);
    console.log(`Tokens used: ${tokensUsed} (prompt: ${usage.prompt_tokens || 0}, completion: ${usage.completion_tokens || 0})`);

    return {
      content: content,
      tokensUsed: tokensUsed,
      model: modelName,
      usage: usage,
      processingTime: 0,
      rateLimitRemaining: 0,
      finishReason: choice.finish_reason || 'stop'
    };
  }

  /**
   * Parse structured response and handle JSON parsing
   * @param {Object} response - API response
   * @param {Object} structuredConfig - Schema configuration
   * @returns {Object} Parsed structured response
   */
  _parseStructuredResponse(response, structuredConfig) {
    let parsedContent;
    
    try {
      // Try to parse JSON from content
      const content = response.content.trim();
      
      // Remove markdown code blocks if present
      const cleanContent = content
        .replace(/^```json\s*/, '')
        .replace(/^```\s*/, '')
        .replace(/```\s*$/, '')
        .trim();

      parsedContent = JSON.parse(cleanContent);
      
      console.log('Successfully parsed structured JSON response');
      
    } catch (parseError) {
      console.warn('Failed to parse JSON response:', parseError.message);
      console.warn('Raw content:', response.content);
      
      // Fallback: try to extract JSON from text
      const jsonMatch = response.content.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          parsedContent = JSON.parse(jsonMatch[0]);
          console.log('Extracted JSON from response text');
        } catch (extractError) {
          console.error('Failed to extract JSON:', extractError.message);
          throw new Error('INVALID_JSON_RESPONSE');
        }
      } else {
        throw new Error('NO_JSON_FOUND');
      }
    }

    return {
      ...response,
      content: parsedContent
    };
  }

  /**
   * Delay utility for retry logic
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise} Promise that resolves after delay
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = OpenRouterApiClient;
