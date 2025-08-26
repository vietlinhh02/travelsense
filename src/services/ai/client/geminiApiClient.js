const axios = require('axios');

/**
 * GeminiApiClient - Handles direct communication with Google Gemini API
 * Responsible for: API calls, retry logic, model configuration, error handling
 * Supports structured output and v2.5 models
 */
class GeminiApiClient {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || 'mock-api-key';
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';

    // Log API key status (without revealing the actual key)
    if (this.hasValidApiKey()) {
      console.log('✅ Gemini API key is configured');
    } else {
      console.warn('⚠️ Gemini API key is not configured - using mock key');
    }

    // Model configurations updated to v2.5
    this.modelConfigs = {
      flash: {
        name: 'gemini-2.5-flash',
        endpoint: `${this.baseUrl}/gemini-2.5-flash:generateContent`
      },
      pro: {
        name: 'gemini-2.5-pro',
        endpoint: `${this.baseUrl}/gemini-2.5-pro:generateContent`
      }
    };

    // Default generation config optimized for Flash model
    // Using high token limits for detailed Vietnamese content generation
    this.defaultGenerationConfig = {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8000, // High limit for Vietnamese multi-step generation with tips
    };

    // Safety settings
    this.safetySettings = [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_MEDIUM_AND_ABOVE"
      }
    ];
  }

  /**
   * Check if we have a valid API key
   * @returns {boolean} Whether API key is valid
   */
  hasValidApiKey() {
    return this.apiKey && this.apiKey !== 'mock-api-key';
  }

  /**
   * Main method to call Gemini API with retry logic
   * @param {string} model - Model type ('flash' or 'pro')
   * @param {string} prompt - Prompt to send
   * @param {Object} options - Additional options (responseSchema, generationConfig)
   * @returns {Promise<Object>} API response
   */
  async callGeminiAPI(model, prompt, options = {}) {
    if (!this.hasValidApiKey()) {
      console.warn(' No valid Gemini API key found.');
      throw new Error('NO_VALID_API_KEY');
    }

    const modelConfig = this.modelConfigs[model] || this.modelConfigs.flash;
    const requestPayload = this._buildRequestPayload(prompt, options);

    console.log(`Making real Gemini API call to ${modelConfig.name}...`);

    return await this._executeWithRetry(modelConfig, requestPayload);
  }

  /**
   * Call Gemini API with structured output (JSON or enum)
   * @param {string} model - Model type ('flash' or 'pro')
   * @param {string} prompt - Prompt to send
   * @param {Object} structuredConfig - Structured output configuration
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Structured API response
   */
  async callGeminiWithStructuredOutput(model, prompt, structuredConfig, options = {}) {
    if (!this.hasValidApiKey()) {
      console.warn(' No valid Gemini API key found.');
      throw new Error('NO_VALID_API_KEY');
    }

    // Validate structured configuration
    if (!structuredConfig) {
      throw new Error('Structured configuration is required');
    }

    // Merge structured config with options
    const enhancedOptions = {
      ...options,
      responseSchema: structuredConfig
    };

    const modelConfig = this.modelConfigs[model] || this.modelConfigs.flash;
    const requestPayload = this._buildRequestPayload(prompt, enhancedOptions);

    console.log(`📤 Making structured output call to ${modelConfig.name}...`);
    console.log(`📄 Response type: ${structuredConfig.responseMimeType || 'application/json'}`);
    console.log(`📝 Prompt length: ${prompt.length} characters`);
    console.log(`📋 Schema type: ${structuredConfig.responseSchema?.type}`);

          const response = await this._executeWithRetry(modelConfig, requestPayload, true);

      // Validate structured response
      if (structuredConfig.responseMimeType === 'text/x.enum') {
        // For enum responses, ensure the response is one of the allowed values
        if (structuredConfig.responseSchema?.enum) {
          const allowedValues = structuredConfig.responseSchema.enum;
          if (!allowedValues.includes(response.content)) {
            console.warn(`Enum response '${response.content}' not in allowed values: ${allowedValues.join(', ')}`);
          }
        }
      }

    return response;
  }

  /**
   * Call Gemini API with JSON schema output (preview feature)
   * @param {string} model - Model type ('flash' or 'pro')
   * @param {string} prompt - Prompt to send
   * @param {Object} jsonSchema - JSON schema definition
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} JSON schema response
   */
  async callGeminiWithJSONSchema(model, prompt, jsonSchema, options = {}) {
    if (!this.hasValidApiKey()) {
      console.warn(' No valid Gemini API key found.');
      throw new Error('NO_VALID_API_KEY');
    }

    // Use gemini-2.5 models for JSON schema support
    const modelConfig = this.modelConfigs[model] || this.modelConfigs.flash;

    const enhancedOptions = {
      ...options,
      responseJsonSchema: jsonSchema
    };

    const requestPayload = this._buildRequestPayload(prompt, enhancedOptions);

    console.log(`Making JSON schema call to ${modelConfig.name}...`);

    return await this._executeWithRetry(modelConfig, requestPayload, true);
  }

  /**
   * Execute API call with retry logic
   * @param {Object} modelConfig - Model configuration
   * @param {Object} requestPayload - Request payload
   * @param {boolean} isStructuredOutput - Whether this is a structured output request
   * @returns {Promise<Object>} API response
   */
  async _executeWithRetry(modelConfig, requestPayload, isStructuredOutput = false) {
    const maxRetries = 2;
    let attempt = 1;

    while (attempt <= maxRetries) {
      try {
        console.log(` Attempt ${attempt}/${maxRetries} - Calling ${modelConfig.name}...`);

        const response = await axios.post(modelConfig.endpoint, requestPayload, {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey
          },
          timeout: 60000 // 60 second timeout
        });

        return this._processResponse(response, modelConfig.name, requestPayload.contents[0].parts[0].text, isStructuredOutput);
        
      } catch (error) {
        console.log(` Attempt ${attempt} failed: ${error.message}`);
        
        // Enhanced error logging for 500 errors
        if (error.response) {
          console.error(`❌ HTTP ${error.response.status}: ${error.response.statusText}`);
          console.error('Error response data:', JSON.stringify(error.response.data, null, 2));
          
          if (error.response.status >= 500) {
            console.error('🔍 Server error detected - this might be:');
            console.error('- Google API server issues');
            console.error('- Invalid model endpoint');
            console.error('- Quota/billing problems');
            console.error('- Request payload too large');
          }
        } else if (error.request) {
          console.error('❌ No response received from server');
          console.error('Request details:', {
            method: error.request.method,
            url: error.request.url,
            timeout: error.request.timeout
          });
        }
        
        if (attempt === maxRetries) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        const waitTime = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s...
        console.log(` Waiting ${waitTime/1000}s before retry...`);
        await this._delay(waitTime);
        
        attempt++;
      }
    }
  }

  /**
   * Build request payload for Gemini API with structured output support
   * @param {string} prompt - Prompt text
   * @param {Object} options - Additional options
   * @returns {Object} Request payload
   */
  _buildRequestPayload(prompt, options = {}) {
    const payload = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        ...this.defaultGenerationConfig,
        ...(options.generationConfig || {})
      },
      safetySettings: options.safetySettings || this.safetySettings
    };

    // Add structured output configuration
    if (options.responseSchema) {
      // Handle both direct schema and structured output configuration
      if (options.responseSchema.responseMimeType && options.responseSchema.responseSchema) {
        // Pre-configured structured output (from StructuredOutputService)
        payload.generationConfig = {
          ...payload.generationConfig,
          responseMimeType: options.responseSchema.responseMimeType,
          responseSchema: options.responseSchema.responseSchema
        };
      } else {
        // Direct schema definition
        payload.generationConfig = {
          ...payload.generationConfig,
          responseMimeType: options.responseMimeType || "application/json",
          responseSchema: options.responseSchema
        };
      }
    }

    // Support for JSON Schema (preview feature)
    if (options.responseJsonSchema) {
      payload.generationConfig = {
        ...payload.generationConfig,
        responseMimeType: "application/json",
        responseJsonSchema: options.responseJsonSchema
      };
    }

    // Support for enum responses
    if (options.enumValues) {
      payload.generationConfig = {
        ...payload.generationConfig,
        responseMimeType: "text/x.enum",
        responseSchema: {
          type: "STRING",
          enum: options.enumValues
        }
      };
    }

    return payload;
  }

  /**
   * Process API response with improved usage metadata parsing
   * @param {Object} response - Axios response
   * @param {string} modelName - Model name
   * @param {string} originalPrompt - Original prompt for token calculation
   * @param {boolean} isStructuredOutput - Whether this is a structured output request
   * @returns {Object} Processed response
   */
  _processResponse(response, modelName, originalPrompt, isStructuredOutput = false) {
    const responseData = response.data;

    if (!responseData.candidates || !responseData.candidates[0]) {
      console.error('❌ No candidates in Gemini API response:', JSON.stringify(responseData, null, 2));
      throw new Error('Invalid response format from Gemini API - no candidates found');
    }

    const candidate = responseData.candidates[0];
    
    // Check for finish reason issues
    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
      console.warn(`⚠️ Gemini API finished with reason: ${candidate.finishReason}`);
      
      if (candidate.finishReason === 'SAFETY') {
        throw new Error('Content was blocked by safety filters. Please modify your request.');
      }
      
      if (candidate.finishReason === 'RECITATION') {
        throw new Error('Content was blocked due to recitation concerns.');
      }
      
      if (candidate.finishReason === 'MAX_TOKENS') {
        console.warn('⚠️ Response was truncated due to max token limit');
      }
    }

    const content = candidate.content?.parts?.[0]?.text;
    
    // More detailed content validation
    if (!content || content.trim() === '') {
      // Check if this was due to MAX_TOKENS at start
      if (candidate.finishReason === 'MAX_TOKENS') {
        console.error('❌ Response truncated at start - token limit too low or prompt too complex');
        console.error('💡 Try: 1) Increase maxOutputTokens, 2) Simplify prompt, 3) Use smaller schema');
        console.error('🔍 ThoughtsTokenCount:', responseData.usageMetadata?.thoughtsTokenCount);
        throw new Error('Response truncated at start - increase token limit or simplify prompt');
      }
      
      console.error('❌ Empty content from Gemini API');
      console.error('Response data:', JSON.stringify(responseData, null, 2));
      throw new Error('Gemini API returned empty content - this may be due to safety filters, quota limits, or invalid API key');
    }

    // Parse usage metadata with fallback
    const usage = responseData.usageMetadata || {};
    const tokensUsed = usage.totalTokenCount ||
                      usage.candidatesTokenCount ||
                      Math.ceil((originalPrompt.length + content.length) / 4);

    console.log(`✅ Gemini API response received (${tokensUsed} tokens estimated)`);

    // For structured output, return parsed JSON directly
    if (isStructuredOutput) {
      try {
        // Gemini structured output should already be valid JSON
        const parsedData = JSON.parse(content);
        console.log(`✅ Structured output parsed successfully`);

        return {
          content: parsedData, // Return parsed JSON directly
          tokensUsed: tokensUsed,
          model: modelName,
          finishReason: candidate.finishReason || 'STOP',
          raw: responseData,
          isStructured: true
        };
      } catch (parseError) {
        // If JSON parsing fails, check if response was truncated
        const wasTruncated = candidate.finishReason === 'MAX_TOKENS';
        
        if (wasTruncated) {
          console.warn('⚠️ Response was truncated due to max token limit');
          // Try to fix truncated JSON by finding the last complete object/array
          const fixedJson = this._attemptJsonFix(content);
          if (fixedJson) {
            console.log('✅ Fixed truncated JSON successfully');
            return {
              content: JSON.parse(fixedJson),
              tokensUsed: tokensUsed,
              model: modelName,
              finishReason: candidate.finishReason || 'STOP',
              raw: responseData,
              isStructured: true,
              truncated: true
            };
          }
        }
        
        console.warn(`⚠️ Failed to parse structured output JSON: ${parseError.message}`);
        console.warn(`Raw content: ${content.substring(0, 500)}...`);
        
        // For structured output failures, throw error instead of fallback
        // This prevents downstream services from getting confused
        throw new Error(`JSON parsing failed: ${parseError.message}${wasTruncated ? ' (Response was truncated)' : ''}`);
      }
    }

    // For unstructured output, return raw content
    return {
      content: content,
      tokensUsed: tokensUsed,
      model: modelName,
      finishReason: candidate.finishReason || 'STOP',
      raw: responseData,
      isStructured: false
    };
  }

  /**
   * Attempt to fix truncated JSON by finding the last complete structure
   * @param {string} content - Truncated JSON content
   * @returns {string|null} Fixed JSON or null if unfixable
   */
  _attemptJsonFix(content) {
    if (!content || typeof content !== 'string') return null;
    
    try {
      let fixedContent = content.trim();
      
      // Handle different types of truncation
      
      // Case 1: Array truncation
      if (fixedContent.startsWith('[')) {
        // Find the last complete object in the array
        let depth = 0;
        let lastCompleteIndex = -1;
        let inString = false;
        let escapeNext = false;
        
        for (let i = 0; i < fixedContent.length; i++) {
          const char = fixedContent[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          if (char === '"' && !escapeNext) {
            inString = !inString;
            continue;
          }
          
          if (!inString) {
            if (char === '{') depth++;
            else if (char === '}') {
              depth--;
              if (depth === 0) {
                lastCompleteIndex = i;
              }
            }
          }
        }
        
        if (lastCompleteIndex > -1) {
          fixedContent = fixedContent.substring(0, lastCompleteIndex + 1) + ']';
          return fixedContent;
        }
      }
      
      // Case 2: Object truncation (most common)
      if (fixedContent.startsWith('{')) {
        // Find the last complete property or string
        let lastGoodPosition = -1;
        let depth = 0;
        let inString = false;
        let escapeNext = false;
        
        for (let i = 0; i < fixedContent.length; i++) {
          const char = fixedContent[i];
          
          if (escapeNext) {
            escapeNext = false;
            continue;
          }
          
          if (char === '\\') {
            escapeNext = true;
            continue;
          }
          
          if (char === '"' && !escapeNext) {
            if (inString) {
              // End of string - this is a good position
              lastGoodPosition = i;
            }
            inString = !inString;
            continue;
          }
          
          if (!inString) {
            if (char === '{') depth++;
            else if (char === '}') {
              depth--;
              lastGoodPosition = i;
            }
            else if (char === ',' || char === ']') {
              lastGoodPosition = i;
            }
          }
        }
        
        if (lastGoodPosition > -1) {
          let cutContent = fixedContent.substring(0, lastGoodPosition + 1);
          
          // Ensure we're not cutting in the middle of a property
          // Look backwards for the last complete property
          for (let i = cutContent.length - 1; i >= 0; i--) {
            if (cutContent[i] === ',' || cutContent[i] === '{') {
              cutContent = cutContent.substring(0, i + 1);
              break;
            }
          }
          
          // Close the JSON properly
          if (!cutContent.endsWith('}')) {
            cutContent = cutContent.replace(/,\s*$/, '') + '}';
          }
          
          return cutContent;
        }
      }
      
      return null;
    } catch (error) {
      console.warn('JSON fix attempt failed:', error.message);
      return null;
    }
  }

  /**
   * Try to parse JSON content from response
   * @param {string} content - Response content
   * @returns {Object|null} Parsed JSON or null if parsing fails
   */
  _tryParseJSON(content) {
    if (!content || typeof content !== 'string') return null;

    try {
      // Try to extract JSON from markdown code blocks first
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/i);
      const jsonString = jsonMatch ? jsonMatch[1] : content;

      return JSON.parse(jsonString);
    } catch (error) {
      console.warn('Failed to parse JSON from response:', error.message);
      return null;
    }
  }

  /**
   * Helper method for delays
   * @param {number} ms - Milliseconds to wait
   * @returns {Promise} Promise that resolves after delay
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }



  /**
   * Check API health (simple ping)
   * @returns {Promise<boolean>} Whether API is accessible
   */
  async checkApiHealth() {
    if (!this.hasValidApiKey()) {
      return false;
    }

    try {
      const response = await this.callGeminiAPI('flash', 'Hello', { 
        generationConfig: { maxOutputTokens: 10 } 
      });
      return response && response.content;
    } catch (error) {
      console.error('API health check failed:', error.message);
      return false;
    }
  }

  /**
   * Test API connectivity with a simple structured output request
   * @returns {Promise<Object>} Test result
   */
  async testApiConnectivity() {
    if (!this.hasValidApiKey()) {
      return {
        success: false,
        error: 'No valid API key configured',
        solution: 'Set GEMINI_API_KEY environment variable'
      };
    }

    try {
      console.log('🧪 Testing Gemini API connectivity...');
      
      const testPrompt = 'Say "Hello, API is working!" in JSON format with a "message" field.';
      const testSchema = {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            message: {
              type: "STRING"
            }
          },
          required: ["message"]
        }
      };

      const response = await this.callGeminiWithStructuredOutput('flash', testPrompt, testSchema);
      
      console.log('✅ API test successful');
      return {
        success: true,
        message: 'API connectivity test passed',
        response: response.content
      };
      
    } catch (error) {
      console.error('❌ API test failed:', error.message);
      return {
        success: false,
        error: error.message,
        solution: 'Check API key validity and network connectivity'
      };
    }
  }

  /**
   * Get API client health status
   * @returns {Object} Health status
   */
  getHealthStatus() {
    return {
      apiKeyConfigured: this.hasValidApiKey(),
      baseUrl: this.baseUrl,
      modelsAvailable: Object.keys(this.modelConfigs),
      defaultConfig: this.defaultGenerationConfig
    };
  }
}

module.exports = GeminiApiClient;