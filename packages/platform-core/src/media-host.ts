import fs from "node:fs";

export interface MediaHostConfig {
  provider?: "imgbb" | "custom" | "s3" | null;
  apiKey?: string | null;
  uploadEndpoint?: string | null;
}

export async function resolvePublicMediaUrl(
  localPath: string,
  config?: MediaHostConfig
): Promise<{ ok: boolean; url?: string; error?: string; isConfigMissing?: boolean }> {
  // If already an external HTTPS URL, return directly
  if (localPath.startsWith("https://") || localPath.startsWith("http://")) {
    return { ok: true, url: localPath };
  }

  // Check if a media host is configured
  if (!config?.provider || (config.provider === "imgbb" && !config.apiKey)) {
    return {
      ok: false,
      isConfigMissing: true,
      error:
        "Instagram publishing requires publicly accessible HTTPS media URLs. Configure Media Hosting in Settings.",
    };
  }

  if (!fs.existsSync(localPath)) {
    return { ok: false, error: `Local media file not found: ${localPath}` };
  }
  if (config?.provider === "imgbb" && config.apiKey) {
    try {
      const buffer = fs.readFileSync(localPath);
      const base64Data = buffer.toString("base64");
      const formData = new URLSearchParams();
      formData.append("image", base64Data);

      const res = await fetch(`https://api.imgbb.com/1/upload?key=${config.apiKey}`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errText = await res.text();
        return { ok: false, error: `ImgBB upload failed (HTTP ${res.status}): ${errText.slice(0, 120)}` };
      }

      const json = (await res.json()) as { data?: { url?: string } };
      if (json.data?.url) {
        return { ok: true, url: json.data.url };
      }
      return { ok: false, error: "ImgBB response did not contain media URL." };
    } catch (err: unknown) {
      return { ok: false, error: `Media hosting error: ${err instanceof Error ? err.message : String(err)}` };
    }
  }

  if (config?.provider === "custom" && config.uploadEndpoint) {
    try {
      const buffer = fs.readFileSync(localPath);
      const res = await fetch(config.uploadEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream" },
        body: buffer,
      });

      if (res.ok) {
        const json = (await res.json()) as { url?: string };
        if (json.url) return { ok: true, url: json.url };
      }
    } catch {
      // fallback to error below
    }
  }

  return {
    ok: false,
    error:
      "Instagram Content Publishing API requires publicly accessible HTTPS media URLs for container ingestion. Desktop local file paths cannot be retrieved directly by Meta servers. Please configure Media Hosting in Settings or provide hosted URLs.",
  };
}
