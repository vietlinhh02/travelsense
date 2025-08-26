# Long Trip Microservices

Thư mục này chứa các microservice chuyên xử lý chuyến du lịch dài ngày (8+ ngày) với kiến trúc chunking và fallback.

## Services

### LongTripHandlerService
- **Chức năng**: Service chính điều phối việc xử lý chuyến dài ngày
- **Vai trò**: Main orchestrator cho long trip processing
- **Dependencies**: Tất cả long trip microservices

### TripChunkingService
- **Chức năng**: Chia nhỏ chuyến dài thành các chunk nhỏ hơn
- **Vai trò**: Trip segmentation và chunking strategy
- **Dependencies**: TokenEstimationService, LocationUtilityService

### TokenEstimationService
- **Chức năng**: Ước tính số token cần thiết cho từng phần của chuyến đi
- **Vai trò**: Token calculation và API limit management
- **Dependencies**: Standalone utility

### ChunkedItineraryGenerationService
- **Chức năng**: Tạo lịch trình cho từng chunk đã được chia
- **Vai trò**: Chunked processing và parallel generation
- **Dependencies**: GeminiApiClient, ResponseParser

### FallbackGenerationService
- **Chức năng**: Xử lý fallback khi API chính thất bại hoặc quá tải
- **Vai trò**: Error recovery và alternative processing
- **Dependencies**: GeminiApiClient, backup processing logic

### LocationUtilityService
- **Chức năng**: Tiện ích xử lý địa điểm và khoảng cách cho long trip
- **Vai trò**: Geographic calculation và location optimization
- **Dependencies**: Standalone utility

## Architecture Benefits
- **Scalability**: Xử lý được chuyến dài mà không bị giới hạn token
- **Reliability**: Fallback mechanism cho error handling
- **Performance**: Parallel processing của các chunk
- **Maintainability**: Separated concerns cho từng aspect của long trip

## Processing Flow
1. TripChunkingService chia chuyến thành chunks
2. TokenEstimationService ước tính resource cần thiết  
3. ChunkedItineraryGenerationService xử lý parallel
4. FallbackGenerationService backup khi cần
5. LocationUtilityService optimize geographic aspects
