/** Typed application errors. Handlers throw these; the global error middleware formats them. */

export class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR', details = undefined) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid input', details) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}
export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', details) {
    super(message, 401, 'AUTHENTICATION_ERROR', details);
  }
}
export class AuthorizationError extends AppError {
  constructor(message = 'You do not have permission to do that', details) {
    super(message, 403, 'AUTHORIZATION_ERROR', details);
  }
}
export class NotFoundError extends AppError {
  constructor(message = 'Not found', details) {
    super(message, 404, 'NOT_FOUND', details);
  }
}
export class ConflictError extends AppError {
  constructor(message = 'Conflict', details) {
    super(message, 409, 'CONFLICT', details);
  }
}
export class BusinessRuleError extends AppError {
  constructor(message = 'Business rule violated', details) {
    super(message, 422, 'BUSINESS_RULE_VIOLATION', details);
  }
}
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', details) {
    super(message, 429, 'RATE_LIMITED', details);
  }
}
export class NotImplementedError extends AppError {
  constructor(message = 'Not implemented') {
    super(message, 501, 'NOT_IMPLEMENTED');
  }
}
