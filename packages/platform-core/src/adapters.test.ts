import { describe, expect, it } from "vitest";
import {
  InstagramPlatformAdapter,
  LinkedInPlatformAdapter,
  PlatformRegistry,
  SimulatedPlatformAdapter,
  WhatsAppPlatformAdapter,
} from "./index.js";
import { parseWhatsAppWebhookPayload } from "./webhook.js";

describe("LinkedInPlatformAdapter", () => {
  const adapter = new LinkedInPlatformAdapter();

  it("validates text limits (max 3,000 characters)", () => {
    expect(adapter.validatePost("").ok).toBe(false);
    expect(adapter.validatePost("Hello LinkedIn").ok).toBe(true);
    expect(adapter.validatePost("a".repeat(3000)).ok).toBe(true);

    const tooLong = adapter.validatePost("a".repeat(3001));
    expect(tooLong.ok).toBe(false);
    expect(tooLong.errors[0]).toContain("cannot exceed 3,000 characters");
  });

  it("validates media attachments (max 9 items)", () => {
    expect(adapter.validateMedia(["/file1.png", "/file2.png"]).ok).toBe(true);
    const tenFiles = Array.from({ length: 10 }, (_, i) => `/file${i}.png`);
    const result = adapter.validateMedia(tenFiles);
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("allows up to 9 media attachments");
  });

  it("returns AUTH_ERROR when published without credentials", async () => {
    const unauthenticatedAccount = {
      id: "li-test-1",
      platform: "linkedin" as const,
      accountName: "WELZ Personal",
      accountId: null,
      authReference: null,
      connectedAt: null,
      lastVerifiedAt: null,
      status: "disconnected" as const,
    };

    const res = await adapter.publishPost(unauthenticatedAccount, {
      account: unauthenticatedAccount,
      text: "Test publish",
      mediaPaths: [],
      idempotencyKey: "idem-1",
    });

    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe("AUTH_ERROR");
  });
});

describe("InstagramPlatformAdapter", () => {
  const adapter = new InstagramPlatformAdapter();

  it("validates captions (max 2,200 chars and max 30 hashtags)", () => {
    expect(adapter.validatePost("").ok).toBe(false);
    expect(adapter.validatePost("Caption with #welz #builder").ok).toBe(true);

    const tooLong = adapter.validatePost("a".repeat(2201));
    expect(tooLong.ok).toBe(false);
    expect(tooLong.errors[0]).toContain("cannot exceed 2,200 characters");

    const thirtyOneTags = Array.from({ length: 31 }, (_, i) => `#tag${i}`).join(" ");
    const tagValidation = adapter.validatePost(thirtyOneTags);
    expect(tagValidation.ok).toBe(false);
    expect(tagValidation.errors[0]).toContain("allows up to 30 hashtags");
  });

  it("enforces mandatory media requirement", () => {
    const noMedia = adapter.validateMedia([]);
    expect(noMedia.ok).toBe(false);
    expect(noMedia.errors[0]).toContain("requires at least one image or video");

    expect(adapter.validateMedia(["/local/img.png"]).ok).toBe(true);
  });

  it("returns MEDIA_ERROR when publishing local desktop files without public URLs", async () => {
    const account = {
      id: "ig-test-1",
      platform: "instagram" as const,
      accountName: "WELZ Instagram",
      accountId: "ig-12345",
      authReference: "acct-ig",
      connectedAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
      status: "connected" as const,
    };

    // Providing resolver with a token
    const tokenAdapter = new InstagramPlatformAdapter(() => "EAAB...");
    const res = await tokenAdapter.publishPost(account, {
      account,
      text: "Instagram caption",
      mediaPaths: ["C:\\Users\\local\\test.jpg"],
      idempotencyKey: "idem-ig-1",
    });

    expect(res.ok).toBe(false);
    expect(res.errorCode).toBe("MEDIA_HOSTING_REQUIRED");
    expect(res.error).toContain("publicly accessible HTTPS media URLs");
  });
});

describe("WhatsAppPlatformAdapter", () => {
  const adapter = new WhatsAppPlatformAdapter();

  it("validates message length (max 4,096 chars) and media (max 4)", () => {
    expect(adapter.validatePost("").ok).toBe(false);
    expect(adapter.validatePost("Hello customer").ok).toBe(true);
    expect(adapter.validatePost("a".repeat(4097)).ok).toBe(false);

    expect(adapter.validateMedia(["/file1.pdf", "/file2.pdf"]).ok).toBe(true);
    expect(adapter.validateMedia(["/1", "/2", "/3", "/4", "/5"]).ok).toBe(false);
  });
});

describe("SimulatedPlatformAdapter", () => {
  const sim = new SimulatedPlatformAdapter("linkedin");

  it("completes mock publishing with simulated remote ID and response meta", async () => {
    const account = {
      id: "sim-1",
      platform: "linkedin" as const,
      accountName: "WELZ Personal",
      accountId: "sim-me",
      authReference: "sim-ref",
      connectedAt: new Date().toISOString(),
      lastVerifiedAt: new Date().toISOString(),
      status: "connected" as const,
    };

    const res = await sim.publishPost(account, {
      account,
      text: "Simulated post",
      mediaPaths: [],
      idempotencyKey: "key-12345678",
    });

    expect(res.ok).toBe(true);
    expect(res.mode).toBe("simulated");
    expect(res.externalPostId).toContain("sim-linkedin-key-1234");
    expect(res.responseMeta?.simulated).toBe(true);
  });
});

describe("WhatsApp Webhook Parser", () => {
  it("extracts delivery status events from valid Meta payload", () => {
    const metaPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_ID_1",
          changes: [
            {
              field: "messages",
              value: {
                messaging_product: "whatsapp",
                statuses: [
                  {
                    id: "wamid.HBgLMTE=",
                    status: "delivered",
                    timestamp: "1727376000",
                    recipient_id: "919876543210",
                  },
                  {
                    id: "wamid.HBgLMTE2",
                    status: "read",
                    timestamp: "1727376100",
                    recipient_id: "919876543210",
                  },
                ],
              },
            },
          ],
        },
      ],
    };

    const parsed = parseWhatsAppWebhookPayload(metaPayload);
    expect(parsed.valid).toBe(true);
    expect(parsed.events?.length).toBe(2);
    expect(parsed.events?.[0].status).toBe("delivered");
    expect(parsed.events?.[0].messageId).toBe("wamid.HBgLMTE=");
    expect(parsed.events?.[1].status).toBe("read");
  });

  it("rejects invalid webhook payload gracefully", () => {
    expect(parseWhatsAppWebhookPayload(null).valid).toBe(false);
    expect(parseWhatsAppWebhookPayload({ object: "unknown_service" }).valid).toBe(false);
  });
});

describe("PlatformRegistry", () => {
  it("instantiates SimulatedPlatformAdapter in dev mode", () => {
    const registry = new PlatformRegistry(true);
    const adapter = registry.getAdapter("linkedin");
    expect(adapter).toBeInstanceOf(SimulatedPlatformAdapter);
  });

  it("instantiates real adapters with credential resolver in production mode", () => {
    const registry = new PlatformRegistry(false, () => "test-token");
    const adapter = registry.getAdapter("instagram");
    expect(adapter).toBeInstanceOf(InstagramPlatformAdapter);
  });
});
