import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * The target contact group is missing or has no valid email. Nothing is sent and
 * the request fails clearly; it never falls back to another department.
 */
export class ContactRecipientUnavailableException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        code: 'CONTACT_UNAVAILABLE',
        message: 'Šiuo metu žinutės išsiųsti negalima. Bandykite vėliau.',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}

/** The mail transport did not accept the message. No provider detail is exposed. */
export class ContactSendFailedException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.BAD_GATEWAY,
        code: 'CONTACT_SEND_FAILED',
        message: 'Nepavyko išsiųsti žinutės. Bandykite vėliau.',
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}
