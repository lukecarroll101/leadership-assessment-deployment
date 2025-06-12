import crypto from "crypto";

export function generateToken(data: string): string {
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }

  // Create a random initialization vector
  const iv = crypto.randomBytes(16);

  // Create cipher using the encryption key
  const cipher = crypto.createCipheriv(
    "aes-256-cbc",
    Buffer.from(encryptionKey as string, "utf-8"),
    iv
  );

  // Encrypt the data
  let encrypted = cipher.update(data, "utf8", "base64");
  encrypted += cipher.final("base64");

  // Combine IV and encrypted data
  const token = `${iv.toString("base64")}:${encrypted}`;

  return token;
}

export function decryptToken(token: string): string {
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }

  // Split the token into IV and encrypted data
  const [ivBase64, encryptedData] = token.split(":");

  if (!ivBase64 || !encryptedData) {
    throw new Error("Invalid token format");
  }

  // Convert IV from base64
  const iv = Buffer.from(ivBase64, "base64");

  // Create decipher
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    Buffer.from(encryptionKey as string, "utf-8"),
    iv
  );

  // Decrypt the data
  let decrypted = decipher.update(encryptedData, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// Test the token generation and decryption
if (require.main === module) {
  try {
    const testData = "test-data-123";
    console.log("Original data:", testData);

    const token = generateToken(testData);
    console.log("Generated token:", token);

    const decrypted = decryptToken(token);
    console.log("Decrypted data:", decrypted);

    console.log("Test successful:", testData === decrypted);
  } catch (error) {
    console.error(
      "Error:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}
