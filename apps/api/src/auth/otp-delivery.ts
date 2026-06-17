import type { Logger } from "@tradescore/logging";

/**
 * OTP delivery abstraction.
 *
 * Real SMS/WhatsApp delivery is Stage 10. Until then, the dev implementation
 * logs the code and reports it back so the auth flow is fully exercisable
 * locally. `exposesCode` is false for any real provider so the API never returns
 * a live code to clients in production.
 */
export interface OtpDelivery {
  /** Whether the generated code may be surfaced to the caller (dev only). */
  readonly exposesCode: boolean;
  send(phone: string, code: string): Promise<void>;
}

export class DevOtpDelivery implements OtpDelivery {
  readonly exposesCode = true;

  constructor(private readonly logger: Logger) {}

  async send(phone: string, code: string): Promise<void> {
    // Dev only: real providers must never log the code.
    this.logger.warn({ phone, code, channel: "dev-otp" }, `DEV OTP for ${phone}: ${code}`);
  }
}
