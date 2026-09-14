import { HttpException, HttpStatus } from '@nestjs/common';

/** Turnstile challenge required (no token supplied). */
export class TurnstileRequiredException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        code: 'TURNSTILE_REQUIRED',
        message: 'Turnstile challenge is required',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}

/** Turnstile challenge failed or the provider was unavailable (fail closed). */
export class TurnstileFailedException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.FORBIDDEN,
        code: 'TURNSTILE_FAILED',
        message: 'Turnstile verification failed',
      },
      HttpStatus.FORBIDDEN,
    );
  }
}
