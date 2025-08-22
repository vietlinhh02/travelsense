# Payment Integration Specification

## Overview
The Payment Integration service handles all financial transactions on the TravelSense v2 platform. This service integrates with Stripe to process payments, manage refunds, handle webhooks, and ensure PCI compliance. It provides a secure and reliable payment processing system that supports multiple payment methods and currencies while maintaining strict security standards.

## API Endpoints

### 1. Create Payment Intent
- **Endpoint**: `POST /api/payments/intent`
- **Description**: Creates a payment intent for a booking or service
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "amount": "number", // Required amount in smallest currency unit (e.g., cents)
  "currency": "string", // Required ISO 4217 currency code
  "bookingId": "string", // Optional: link to booking
 "description": "string", // Optional payment description
  "metadata": {
    "userId": "string",
    "providerId": "string",
    "serviceId": "string"
  }
}
```

#### Field Validations
- `amount`:
  - Required field
  - Must be a positive integer
  - Minimum value: 50 (50 cents/0.50 USD minimum)
  - Maximum value: 99999999 (999,999.99 USD maximum)
- `currency`:
  - Required field
  - Must be a valid ISO 4217 currency code
  - Maximum length: 3 characters
- `bookingId`:
  - Optional field
  - Must be a valid MongoDB ObjectId if provided
- `description`:
 - Optional field
  - Maximum length: 200 characters
- `metadata.userId`:
  - Required field in metadata
  - Must be a valid MongoDB ObjectId
- `metadata.providerId`:
  - Required field in metadata
  - Must be a valid MongoDB ObjectId
- `metadata.serviceId`:
  - Optional field in metadata
  - Must be a valid MongoDB ObjectId if provided

#### Response Codes
- `201 Created`: Payment intent successfully created
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `404 Not Found`: Booking not found (if bookingId provided)
- `500 Internal Server Error`: Unexpected server error
- `502 Bad Gateway`: Payment provider error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate input fields according to validation rules
4. If bookingId is provided, retrieve booking and verify user access
5. If bookingId is provided and booking not found, return 404 Not Found
6. Create payment intent with Stripe API
7. Generate a unique payment ID
8. Store payment intent details in database
9. Set payment status to "requires_payment_method"
10. Set createdAt and updatedAt timestamps
11. Return client secret and payment intent details for frontend processing

### 2. Get Payment Details
- **Endpoint**: `GET /api/payments/:id`
- **Description**: Retrieves detailed information for a specific payment
- **Authentication**: Required (JWT)

#### Request Parameters
- `id`: Payment ID (URL parameter)

#### Response Codes
- `200 OK`: Payment details successfully retrieved
- `400 Bad Request`: Invalid payment ID format
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have access to this payment
- `404 Not Found`: Payment not found
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate payment ID format
4. Retrieve payment record from database by ID
5. If payment not found, return 404 Not Found
6. Verify user has access to this payment (payer or admin)
7. If user lacks access, return 403 Forbidden
8. Format payment details for response
9. Return payment details including status and transaction information

### 3. Process Refund
- **Endpoint**: `POST /api/payments/:id/refund`
- **Description**: Processes a refund for a payment (admin or provider only)
- **Authentication**: Required (JWT) - Admin or provider only

#### Request Parameters
- `id`: Payment ID (URL parameter)

#### Request Body
```json
{
  "amount": "number", // Optional partial refund amount
  "reason": "string" // Optional refund reason
}
```

#### Field Validations
- `amount`:
  - Optional field
  - Must be a positive integer
  - Must be less than or equal to original payment amount
- `reason`:
  - Optional field
  - Maximum length: 200 characters

#### Response Codes
- `200 OK`: Refund successfully processed
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have permission to process refund
- `404 Not Found`: Payment not found
- `409 Conflict`: Payment cannot be refunded (status or time restrictions)
- `500 Internal Server Error`: Unexpected server error
- `502 Bad Gateway`: Payment provider error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID and role from token payload
3. Validate payment ID format
4. Retrieve payment record from database by ID
5. If payment not found, return 404 Not Found
6. Verify user has permission to process refund (admin or provider)
7. If user lacks permission, return 403 Forbidden
8. Check if payment can be refunded based on status and time restrictions
9. If payment cannot be refunded, return 409 Conflict
10. Validate input fields according to validation rules
11. Process refund with Stripe API
12. Update payment record with refund details
13. Set payment status to "refunded" or "partially_refunded"
14. Update updatedAt timestamp
15. Save updated payment record to database
16. Send refund confirmation email to user
17. Return refund details

### 4. Get User Payments
- **Endpoint**: `GET /api/payments`
- **Description**: Retrieves a list of payments for the authenticated user with optional filtering and pagination
- **Authentication**: Required (JWT)

#### Request Parameters
```json
{
  "status": "string", // Optional filter by payment status
  "dateFrom": "ISO 8601 date", // Optional start date filter
  "dateTo": "ISO 8601 date", // Optional end date filter
  "limit": "number", // Optional number of results (default: 20, max: 50)
  "offset": "number", // Optional offset for pagination (default: 0)
  "sortBy": "string", // Optional sort field (createdAt, amount, status)
  "sortOrder": "string" // Optional sort order (asc, desc)
}
```

#### Field Validations
- `status`:
  - Optional field
  - Must be one of: "requires_payment_method", "requires_confirmation", "requires_action", "processing", "requires_capture", "canceled", "succeeded", "refunded", "partially_refunded"
- `dateFrom`:
  - Optional field
  - Must be a valid date if provided
- `dateTo`:
  - Optional field
  - Must be a valid date if provided
  - Must be after dateFrom if both are specified
- `limit`:
  - Optional field
  - Must be a positive integer
  - Minimum value: 1
  - Maximum value: 50
  - Defaults to 20 if not specified
- `offset`:
  - Optional field
  - Must be a non-negative integer
  - Defaults to 0 if not specified
- `sortBy`:
 - Optional field
  - Must be one of: "createdAt", "amount", "status"
- `sortOrder`:
  - Optional field
  - Must be one of: "asc", "desc"

#### Response Codes
- `200 OK`: Payments successfully retrieved
- `400 Bad Request`: Invalid query parameters
- `401 Unauthorized`: Missing or invalid authentication token
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate query parameters according to validation rules
4. Build database query based on user ID and provided filters
5. Apply pagination parameters
6. Execute query to retrieve payments
7. Format results for response
8. Return payments list with pagination metadata

### 5. Handle Payment Webhook
- **Endpoint**: `POST /api/payments/webhook`
- **Description**: Handles webhook events from payment provider (Stripe)
- **Authentication**: Webhook signature verification

#### Request Body
```json
{
  "id": "string", // Event ID
  "object": "string", // "event"
  "api_version": "string", // API version
  "created": "number", // Timestamp
  "data": {
    "object": {
      // Payment intent or charge object
    }
  },
  "livemode": "boolean", // Live mode flag
  "pending_webhooks": "number", // Number of pending webhooks
  "request": {
    "id": "string", // Request ID
    "idempotency_key": "string" // Idempotency key
  },
  "type": "string" // Event type
}
```

#### Response Codes
- `200 OK`: Webhook successfully processed
- `400 Bad Request`: Invalid webhook data
- `401 Unauthorized`: Invalid webhook signature
- `500 Internal Server Error`: Unexpected server error

#### Business Logic
1. Verify webhook signature using Stripe webhook secret
2. If signature invalid, return 401 Unauthorized
3. Parse webhook event data
4. Identify event type and process accordingly:
   - `payment_intent.succeeded`: Update payment status to "succeeded"
   - `payment_intent.payment_failed`: Update payment status to "failed"
   - `charge.refunded`: Update payment status to "refunded"
   - `charge.dispute.created`: Handle dispute
5. Update associated booking payment status if applicable
6. Send notifications for significant events
7. Log webhook processing for audit purposes
8. Return 200 OK response

### 6. Create Setup Intent
- **Endpoint**: `POST /api/payments/setup-intent`
- **Description**: Creates a setup intent for saving payment methods
- **Authentication**: Required (JWT)

#### Request Body
```json
{
  "description": "string" // Optional setup description
}
```

#### Field Validations
- `description`:
  - Optional field
  - Maximum length: 200 characters

#### Response Codes
- `201 Created`: Setup intent successfully created
- `400 Bad Request`: Invalid input data or validation errors
- `401 Unauthorized`: Missing or invalid authentication token
- `500 Internal Server Error`: Unexpected server error
- `502 Bad Gateway`: Payment provider error

#### Business Logic
1. Validate JWT token from Authorization header
2. Extract user ID from token payload
3. Validate input fields according to validation rules
4. Create setup intent with Stripe API
5. Generate a unique setup intent ID
6. Store setup intent details in database
7. Set setup intent status to "requires_payment_method"
8. Set createdAt and updatedAt timestamps
9. Return client secret and setup intent details for frontend processing

## Data Models

### Payment
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // User who made the payment
  bookingId: ObjectId, // Optional: link to booking
  providerId: ObjectId, // Provider receiving payment
  serviceId: ObjectId, // Optional: link to service
  stripePaymentIntentId: String, // Stripe payment intent ID
  amount: Number, // Amount in smallest currency unit
  currency: String, // ISO 4217 currency code
  status: String, // "requires_payment_method", "requires_confirmation", "requires_action", "processing", "requires_capture", "canceled", "succeeded", "refunded", "partially_refunded"
  description: String, // Payment description
  paymentMethod: {
    type: String, // "card", "bank_account", etc.
    details: Object // Payment method details (masked)
  },
  refunds: [{
    stripeRefundId: String,
    amount: Number,
    reason: String,
    status: String, // "pending", "succeeded", "failed", "canceled"
    createdAt: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### Setup Intent
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  stripeSetupIntentId: String, // Stripe setup intent ID
  status: String, // "requires_payment_method", "requires_confirmation", "requires_action", "processing", "canceled", "succeeded"
  description: String, // Setup description
  paymentMethod: {
    type: String, // "card", "bank_account", etc.
    details: Object // Payment method details (masked)
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Payment Method
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  stripePaymentMethodId: String, // Stripe payment method ID
  type: String, // "card", "bank_account", etc.
  details: {
    brand: String, // For cards: "visa", "mastercard", etc.
    last4: String, // Last 4 digits
    expMonth: Number, // Expiration month
    expYear: Number, // Expiration year
    fingerprint: String // For detecting duplicates
  },
  isDefault: Boolean, // Whether this is the default payment method
  createdAt: Date,
  updatedAt: Date
}
```

## Payment Processing Workflow

### Payment Intent Lifecycle
1. **requires_payment_method** → **requires_confirmation**: Payment method provided
2. **requires_confirmation** → **processing**: Payment confirmed
3. **processing** → **succeeded**: Payment successful
4. **processing** → **requires_action**: Additional action required (3D Secure)
5. **requires_action** → **processing**: Action completed
6. **processing** → **payment_failed**: Payment failed

### Refund Processing
1. **succeeded** → **refunded**: Full refund processed
2. **succeeded** → **partially_refunded**: Partial refund processed

## Security Considerations

### PCI Compliance
1. No sensitive payment data (card numbers, CVV) stored in platform database
2. All payment data handled by Stripe (PCI DSS compliant)
3. Client-side tokenization using Stripe Elements
4. Secure transmission of payment data directly to Stripe

### Authentication and Authorization
1. All payment endpoints require JWT authentication
2. Users can only access their own payments
3. Admins have full access to all payments
4. Providers can access payments related to their services
5. Webhook endpoints use signature verification

### Data Protection
1. Payment data encrypted at rest
2. TLS encryption for all API communications
3. Regular security audits and penetration testing
4. Input validation and sanitization on all endpoints
5. Rate limiting to prevent abuse

### Fraud Prevention
1. Integration with Stripe Radar for fraud detection
2. Risk scoring for transactions
3. Manual review processes for high-risk transactions
4. IP address and geolocation monitoring
5. Transaction velocity monitoring

## Error Handling

### Stripe API Errors
1. **card_declined**: Handle with user-friendly messaging
2. **insufficient_funds**: Inform user of funding issues
3. **incorrect_cvc**: Request correct security code
4. **expired_card**: Request updated card information
5. **processing_error**: Retry or contact support

### Platform Errors
1. **400 Bad Request**: Invalid input data
2. **401 Unauthorized**: Authentication failures
3. **403 Forbidden**: Insufficient permissions
4. **404 Not Found**: Resource not found
5. **409 Conflict**: Resource state conflicts
6. **500 Internal Server Error**: Unexpected errors
7. **502 Bad Gateway**: Payment provider errors
8. **503 Service Unavailable**: Temporary service issues

## Monitoring and Logging

### Payment Metrics
1. Transaction success rates
2. Refund rates and reasons
3. Average transaction amounts
4. Payment method distribution
5. Geographic distribution
6. Processing time metrics

### Audit Logging
1. All payment creation and modification events
2. Refund processing events
3. Webhook receipt and processing
4. Security-related events
5. Error and exception logging