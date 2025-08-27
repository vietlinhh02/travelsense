const { getAIProvider } = require('../../services/ai/core/aiProvider.service');

/**
 * AI Provider Admin Controller
 * Handles AI provider management for administrators
 */
const aiProviderController = {
  /**
   * Get current AI provider status and configuration
   * @route GET /api/v1/admin/ai-provider/status
   * @access Admin only
   */
  async getProviderStatus(req, res) {
    try {
      const aiProvider = getAIProvider();
      const status = aiProvider.getProviderStatus();
      const config = aiProvider.getProviderConfig();
      const recommendations = aiProvider.getModelRecommendations();

      res.json({
        success: true,
        data: {
          status: status,
          config: config,
          modelRecommendations: recommendations,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error getting provider status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get AI provider status',
        error: error.message
      });
    }
  },

  /**
   * Switch AI provider (runtime switch for testing)
   * @route POST /api/v1/admin/ai-provider/switch
   * @access Admin only
   */
  async switchProvider(req, res) {
    try {
      const { provider } = req.body;

      if (!provider) {
        return res.status(400).json({
          success: false,
          message: 'Provider name is required'
        });
      }

      const aiProvider = getAIProvider();
      const success = aiProvider.switchProvider(provider);

      if (!success) {
        return res.status(400).json({
          success: false,
          message: `Invalid provider: ${provider}. Available providers: gemini, openrouter`
        });
      }

      // Get updated status
      const status = aiProvider.getProviderStatus();

      res.json({
        success: true,
        message: `Successfully switched to ${provider.toUpperCase()} provider`,
        data: {
          status: status,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error switching provider:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to switch AI provider',
        error: error.message
      });
    }
  },

  /**
   * Test AI provider with a simple request
   * @route POST /api/v1/admin/ai-provider/test
   * @access Admin only
   */
  async testProvider(req, res) {
    try {
      const { provider, model = 'flash' } = req.body;

      const aiProvider = getAIProvider();
      
      // Temporarily switch provider for testing if specified
      const originalProvider = aiProvider.getProviderName();
      if (provider && provider !== originalProvider) {
        const switchSuccess = aiProvider.switchProvider(provider);
        if (!switchSuccess) {
          return res.status(400).json({
            success: false,
            message: `Invalid provider: ${provider}`
          });
        }
      }

      // Simple test prompt
      const testPrompt = 'Trả lời ngắn gọn: "AI provider hoạt động tốt" bằng tiếng Việt';

      const startTime = Date.now();
      const response = await aiProvider.callAPI(model, testPrompt);
      const endTime = Date.now();

      // Switch back to original provider if we changed it
      if (provider && provider !== originalProvider) {
        aiProvider.switchProvider(originalProvider);
      }

      res.json({
        success: true,
        message: 'AI provider test completed successfully',
        data: {
          provider: provider || originalProvider,
          model: model,
          response: response.content,
          tokensUsed: response.tokensUsed,
          responseTime: endTime - startTime,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error testing provider:', error);
      
      // Make sure to switch back to original provider on error
      const aiProvider = getAIProvider();
      if (req.body.provider) {
        try {
          aiProvider.switchProvider(process.env.AI_PROVIDER || 'gemini');
        } catch (switchError) {
          console.error('Failed to switch back to original provider:', switchError);
        }
      }

      res.status(500).json({
        success: false,
        message: 'AI provider test failed',
        error: error.message,
        provider: req.body.provider || aiProvider.getProviderName()
      });
    }
  },

  /**
   * Test structured output with current provider
   * @route POST /api/v1/admin/ai-provider/test-structured
   * @access Admin only
   */
  async testStructuredOutput(req, res) {
    try {
      const aiProvider = getAIProvider();

      // Test structured output with a simple schema
      const testPrompt = 'Tạo thông tin cơ bản về một địa điểm du lịch nổi tiếng ở Việt Nam';
      
      const structuredConfig = {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING' },
            location: { type: 'STRING' },
            description: { type: 'STRING' },
            category: { 
              type: 'STRING',
              enum: ['cultural', 'natural', 'historical', 'modern']
            }
          },
          required: ['name', 'location', 'description', 'category']
        }
      };

      const startTime = Date.now();
      const response = await aiProvider.callStructuredAPI('flash', testPrompt, structuredConfig);
      const endTime = Date.now();

      res.json({
        success: true,
        message: 'Structured output test completed successfully',
        data: {
          provider: aiProvider.getProviderName(),
          structuredResponse: response.content,
          tokensUsed: response.tokensUsed,
          responseTime: endTime - startTime,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error testing structured output:', error);
      res.status(500).json({
        success: false,
        message: 'Structured output test failed',
        error: error.message
      });
    }
  }
};

module.exports = aiProviderController;
