# Utility AI Services

Thư mục này chứa các tiện ích và helper services hỗ trợ cho toàn bộ hệ thống AI.

## Services

### AISchemaService
- **Chức năng**: Quản lý và validate JSON schema cho structured output
- **Vai trò**: Schema definition và validation
- **Dependencies**: Standalone utility

### ResponseParser
- **Chức năng**: Parse và xử lý response từ AI API thành format chuẩn
- **Vai trò**: Response processing và data transformation
- **Dependencies**: Schema validation utilities

### PromptBuilder
- **Chức năng**: Xây dựng prompts có cấu trúc cho các AI requests
- **Vai trò**: Prompt engineering và template management
- **Dependencies**: Template utilities

### ActivityTemplateService
- **Chức năng**: Quản lý templates cho các loại hoạt động du lịch
- **Vai trò**: Activity template management và customization
- **Dependencies**: Template storage và retrieval

## Common Patterns
- **Reusability**: Shared utilities across all AI services
- **Consistency**: Standardized processing patterns
- **Maintainability**: Centralized utility logic
- **Performance**: Optimized helper functions

## Usage
These utilities are injected as dependencies into other AI services:
- Schema validation before API calls
- Response parsing after API responses  
- Prompt building for structured requests
- Template management for consistent outputs
