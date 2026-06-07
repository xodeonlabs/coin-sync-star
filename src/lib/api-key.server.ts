import { createHash, randomBytes } from "crypto";

export function generateApiKey(): { plaintext: string; prefix: string; hash: string } {
  const raw = randomBytes(24).toString("base64url");
  const plaintext = `csk_${raw}`;
  const prefix = plaintext.slice(0, 11);
  const hash = createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, prefix, hash };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}
