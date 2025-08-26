# Core AI Services

Thư mục này chứa các dịch vụ AI cốt lõi cung cấp chức năng cơ bản cho toàn bộ hệ thống.

## Services

### GeminiService
- **Chức năng**: Dịch vụ chính điều phối và ủy nhiệm cho các dịch vụ AI chuyên biệt
- **Vai trò**: Service orchestrator, quản lý dependency injection
- **Dependencies**: Tất cả các dịch vụ AI khác

### AIChatService
- **Chức năng**: Xử lý chat và hội thoại với AI
- **Vai trò**: Natural language conversation handling
- **Dependencies**: GeminiApiClient, ResponseParser

### AIValidationService
- **Chức năng**: Xác thực và kiểm tra tính hợp lệ của dữ liệu AI
- **Vai trò**: Data validation và quality assurance
- **Dependencies**: GeminiApiClient, ResponseParser

## Architecture Pattern
- Tất cả services kế thừa từ AIBaseService
- Sử dụng dependency injection pattern
- Centralized error handling và logging
