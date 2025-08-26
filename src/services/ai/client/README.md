# Client Services

Thư mục này chứa các client services để kết nối với external APIs.

## Services

### GeminiApiClient
- **Chức năng**: Client chính để giao tiếp với Google Gemini AI API
- **Vai trò**: API connectivity, request handling, và response management
- **Features**:
  - Structured output support
  - Rate limiting compliance
  - Error handling và retry logic
  - API key management
  - Request/response logging

## Architecture
- **Singleton Pattern**: Single instance for API management
- **Error Resilience**: Comprehensive error handling và fallback
- **Performance**: Connection pooling và caching
- **Security**: Secure API key handling

## Dependencies
- Google AI Generative SDK
- Rate limiting utilities
- Logging services
- Configuration management

## Usage
Injected into all AI services that need to make API calls:
```javascript
const apiClient = require('./client/geminiApiClient');
await apiClient.callGeminiWithStructuredOutput(prompt, schema);
```
