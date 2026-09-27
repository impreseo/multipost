import type { Platform } from "@welz/shared";
import {
  InstagramPlatformAdapter,
  LinkedInPlatformAdapter,
  SimulatedPlatformAdapter,
  UnavailablePlatformAdapter,
  WhatsAppPlatformAdapter,
} from "./adapters.js";
import type { CredentialResolver, PlatformAdapter } from "./types.js";

export class PlatformRegistry {
  constructor(
    private readonly devSimulation: boolean,
    private readonly credentialResolver?: CredentialResolver
  ) { }

  getAdapter(platform: Platform): PlatformAdapter {
    if (this.devSimulation) {
      return new SimulatedPlatformAdapter(platform);
    }
    switch (platform) {
      case "linkedin":
        return new LinkedInPlatformAdapter(this.credentialResolver);
      case "instagram":
        return new InstagramPlatformAdapter(this.credentialResolver);
      case "whatsapp":
        return new WhatsAppPlatformAdapter(this.credentialResolver);
      default:
        return new UnavailablePlatformAdapter(
          platform,
          `Platform adapter for ${platform} is not configured.`
        );
    }
  }
}

export * from "./types.js";
export * from "./adapters.js";
export * from "./webhook.js";
