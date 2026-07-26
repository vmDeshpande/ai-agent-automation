class ExecutionError extends Error {
  constructor(message, code = 'EXECUTION_ERROR', details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

class TimeoutError extends ExecutionError {
  constructor(message, details = {}) {
    super(message, 'TIMEOUT_ERROR', details);
  }
}

class ValidationError extends ExecutionError {
  constructor(message, details = {}) {
    super(message, 'VALIDATION_ERROR', details);
  }
}

class NetworkError extends ExecutionError {
  constructor(message, details = {}) {
    super(message, 'NETWORK_ERROR', details);
  }
}

module.exports = {
  ExecutionError,
  TimeoutError,
  ValidationError,
  NetworkError
};