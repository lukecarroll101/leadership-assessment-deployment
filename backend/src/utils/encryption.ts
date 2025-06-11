import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

export class EncryptionService {
  private key: Buffer;

  constructor(encryptionKey: string) {
    console.log("Encryption key length:", encryptionKey?.length);
    console.log("Encryption key type:", typeof encryptionKey);
    if (!encryptionKey) {
      throw new Error("Encryption key is required");
    }
    try {
      // Decode the base64 key to get the actual 32 bytes
      this.key = Buffer.from(encryptionKey, "base64");
      if (this.key.length !== 32) {
        throw new Error(
          `Decoded key must be 32 bytes long, got ${this.key.length} bytes`
        );
      }
    } catch (error) {
      throw new Error(
        "Invalid encryption key format. Must be a valid base64 string that decodes to 32 bytes"
      );
    }
  }

  encrypt(data: any): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const salt = crypto.randomBytes(SALT_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

    const jsonString = JSON.stringify(data);
    const encrypted = Buffer.concat([
      cipher.update(jsonString, "utf8"),
      cipher.final(),
    ]);

    const tag = cipher.getAuthTag();

    // Combine IV, salt, tag, and encrypted data
    const result = Buffer.concat([iv, salt, tag, encrypted]);

    return result.toString("base64url");
  }

  decrypt(encryptedData: string): any {
    const buffer = Buffer.from(encryptedData, "base64url");

    // Extract IV, salt, tag, and encrypted data
    const iv = buffer.subarray(0, IV_LENGTH);
    const salt = buffer.subarray(IV_LENGTH, IV_LENGTH + SALT_LENGTH);
    const tag = buffer.subarray(
      IV_LENGTH + SALT_LENGTH,
      IV_LENGTH + SALT_LENGTH + TAG_LENGTH
    );
    const encrypted = buffer.subarray(IV_LENGTH + SALT_LENGTH + TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString("utf8"));
  }

  validateToken(token: string): boolean {
    try {
      this.decrypt(token);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Example usage:
// const encryption = new EncryptionService(process.env.ENCRYPTION_KEY!);
// const encrypted = encryption.encrypt({ role: 'leader', id: '123' });
// const decrypted = encryption.decrypt(encrypted);
