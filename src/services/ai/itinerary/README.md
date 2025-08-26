# Itinerary AI Services

Thư mục này chứa các dịch vụ AI chuyên về tạo và quản lý lịch trình du lịch.

## Services

### AITripService
- **Chức năng**: Tạo lịch trình du lịch tổng quát và quản lý chuyến đi
- **Vai trò**: Main trip planning và itinerary generation
- **Dependencies**: GeminiApiClient, ResponseParser, PromptBuilder

### AIActivityService  
- **Chức năng**: Tạo và gợi ý các hoạt động cụ thể trong chuyến đi
- **Vai trò**: Activity recommendation và customization
- **Dependencies**: GeminiApiClient, ActivityTemplateService

### AIItineraryService
- **Chức năng**: Quản lý và tối ưu hóa lịch trình chi tiết
- **Vai trò**: Detailed itinerary management
- **Dependencies**: GeminiApiClient, ResponseParser

### AIScheduleOptimizationService
- **Chức năng**: Tối ưu hóa thời gian và lộ trình trong lịch trình
- **Vai trò**: Schedule optimization và time management
- **Dependencies**: GeminiApiClient, LocationUtilityService

### AIConstraintValidationService
- **Chức năng**: Kiểm tra và xử lý các ràng buộc của lịch trình
- **Vai trò**: Constraint validation và feasibility checking
- **Dependencies**: GeminiApiClient, ResponseParser

### AIItineraryAnalysisService
- **Chức năng**: Phân tích và đánh giá chất lượng lịch trình
- **Vai trò**: Itinerary analysis và improvement suggestions
- **Dependencies**: GeminiApiClient, ResponseParser

## Use Cases
- Tạo lịch trình ngắn ngày (1-7 ngày)
- Tối ưu hóa thời gian và chi phí
- Gợi ý hoạt động phù hợp
- Kiểm tra tính khả thi của lịch trình
