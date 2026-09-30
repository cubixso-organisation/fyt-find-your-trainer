import "server-only";
import { DATA_SOURCE } from "@/lib/data/store";

/**
 * Sends sign-in codes. Nothing here may log a code.
 *
 * Demo (DATA_SOURCE === "demo"): no provider exists yet, so nothing is sent.
 * The code rides in the signed ticket cookie (./ticket.ts, `st.c`) and the
 * verify screen shows it in a panel labelled "Demo mode — no message was
 * sent". That panel only exists while the demo data source is active.
 *
 * Production: not configured. `ready()` is false for both channels, so step 1
 * says codes can't be sent yet (before looking anyone up), and `sendCode`
 * throws `DeliveryNotConfiguredError` if it is ever reached. To go live:
 *  - email: TODO pick a transactional provider (e.g. Resend, SendGrid or
 *    Firebase's "Trigger Email" extension), keep the API key in a server env
 *    var, send from a verified FYT domain;
 *  - SMS: TODO Firebase Authentication phone sign-in (it sends and checks
 *    the code itself, so step 2 would call Firebase instead of our hash), or
 *    an Indian DLT-registered SMS gateway (MSG91, Twilio India) with an
 *    approved OTP template.
 */

export type DeliveryChannel = "email" | "sms";

export interface CodeMessage {
  channel: DeliveryChannel;
  to: string;
  code: string;
}

export interface CodeDelivery {
  readonly mode: "demo" | "live";
  /**
   * Whether this channel can send at all. Checked BEFORE looking anyone up,
   * so an unconfigured channel fails the same way for known and unknown
   * phone numbers.
   */
  ready(channel: DeliveryChannel): boolean;
  sendCode(message: CodeMessage): Promise<void>;
}

export class DeliveryNotConfiguredError extends Error {
  constructor(channel: DeliveryChannel) {
    super(
      channel === "sms"
        ? "Phone sign-in isn't available yet: no SMS provider is configured for this console."
        : "Sign-in codes can't be sent yet: no email provider is configured for this console.",
    );
    this.name = "DeliveryNotConfiguredError";
  }
}

const demoDelivery: CodeDelivery = {
  mode: "demo",
  ready: () => true,
  // Deliberately sends nothing (and logs nothing): see the file comment.
  async sendCode() {},
};

const liveDelivery: CodeDelivery = {
  mode: "live",
  // TODO(client): return true per channel once its provider is wired below.
  ready: () => false,
  async sendCode({ channel }) {
    // TODO(client): wire the email provider / Firebase phone auth here.
    throw new DeliveryNotConfiguredError(channel);
  },
};

export function codeDelivery(): CodeDelivery {
  return DATA_SOURCE === "demo" ? demoDelivery : liveDelivery;
}
