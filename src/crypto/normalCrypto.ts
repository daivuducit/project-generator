import * as crypto from "crypto";

const ROOT_SECRET = "test_normal"; 
const AAD = "README";

function deriveNormalKey(): Buffer {
  return crypto
    .createHash("sha256")
    .update(ROOT_SECRET + "|NORMAL_MODE")
    .digest(); 
}

export function encryptReadme(plain: string): Buffer {
  const key = deriveNormalKey();
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(AAD));

  const encrypted = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, encrypted, tag]);
}

export function decryptReadme(enc: Buffer): string {
  const key = deriveNormalKey();

  const iv = enc.subarray(0, 12);
  const tag = enc.subarray(enc.length - 16);
  const data = enc.subarray(12, enc.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(AAD));
  decipher.setAuthTag(tag);

  const plain = Buffer.concat([
    decipher.update(data),
    decipher.final(),
  ]);

  return plain.toString("utf8");
}
