/**
 * WhatsApp Cloud API Webhook Event Processing Boundary
 *
 * Architecture:
 * Meta Webhook -> Webhook Receiver (Cloud / Ingress) -> Event Signature Validation ->
 * Message ID Mapping -> SQLite Platform Results / Job Status -> Electron UI
 *
 * Local Desktop Architecture Note:
 * Meta Graph API requires a publicly accessible HTTPS endpoint with a valid SSL certificate
 * to deliver asynchronous message status updates (sent, delivered, read, failed).
 * A direct local HTTP listener inside a desktop client cannot receive inbound public webhooks
 * behind NAT/firewalls without an external proxy tunnel or cloud ingress relay.
 *
 * This module establishes the validated event contract, signature verification parser,
 * and state transition mapper ready for a hosted ingress webhook receiver or local polling relay.
 */

export type WhatsAppMessageStatus = "sent" | "delivered" | "read" | "failed";

export interface WhatsAppStatusEvent {
  messageId: string;
  recipientId: string;
  status: WhatsAppMessageStatus;
  timestamp: string;
  errorCode?: number;
  errorMessage?: string;
  rawPayload?: Record<string, unknown>;
}

export interface WebhookValidationResult {
  valid: boolean;
  error?: string;
  events?: WhatsAppStatusEvent[];
}

/**
 * Validates and extracts message status updates from a Meta WhatsApp Cloud API webhook payload.
 */
export function parseWhatsAppWebhookPayload(payload: unknown): WebhookValidationResult {
  if (!payload || typeof payload !== "object") {
    return { valid: false, error: "Payload must be a valid JSON object" };
  }

  const p = payload as Record<string, unknown>;
  if (p.object !== "whatsapp_business_account") {
    return { valid: false, error: `Invalid webhook object: expected 'whatsapp_business_account', got '${String(p.object)}'` };
  }

  const entry = p.entry as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(entry) || entry.length === 0) {
    return { valid: false, error: "Missing or empty 'entry' array in webhook payload" };
  }

  const events: WhatsAppStatusEvent[] = [];

  for (const item of entry) {
    const changes = item.changes as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      if (change.field !== "messages") continue;
      const value = change.value as Record<string, unknown> | undefined;
      if (!value) continue;

      const statuses = value.statuses as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(statuses)) {
        for (const st of statuses) {
          const msgId = typeof st.id === "string" ? st.id : null;
          const statusStr = typeof st.status === "string" ? st.status.toLowerCase() : null;
          const recipientId = typeof st.recipient_id === "string" ? st.recipient_id : "";
          const timestamp = typeof st.timestamp === "string" ? new Date(parseInt(st.timestamp, 10) * 1000).toISOString() : new Date().toISOString();

          if (!msgId || !statusStr) continue;

          let normalizedStatus: WhatsAppMessageStatus;
          if (statusStr === "sent") normalizedStatus = "sent";
          else if (statusStr === "delivered") normalizedStatus = "delivered";
          else if (statusStr === "read") normalizedStatus = "read";
          else if (statusStr === "failed") normalizedStatus = "failed";
          else continue;

          let errorCode: number | undefined;
          let errorMessage: string | undefined;

          const errors = st.errors as Array<Record<string, unknown>> | undefined;
          if (Array.isArray(errors) && errors.length > 0) {
            errorCode = typeof errors[0].code === "number" ? errors[0].code : undefined;
            errorMessage = typeof errors[0].title === "string" ? errors[0].title : typeof errors[0].message === "string" ? errors[0].message : undefined;
          }

          events.push({
            messageId: msgId,
            recipientId,
            status: normalizedStatus,
            timestamp,
            errorCode,
            errorMessage,
            rawPayload: st,
          });
        }
      }
    }
  }

  return { valid: true, events };
}
