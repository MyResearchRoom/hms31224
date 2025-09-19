const crypto = require("crypto");
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = "aes-256-cbc";

exports.encrypt = (data) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, "hex"),
    iv
  );
  let encrypted = cipher.update(data, "utf-8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return iv.toString("hex") + ":" + encrypted.toString("hex");
};

exports.decrypt = (encryptedData) => {
  if (!encryptedData || typeof encryptedData !== "string") {
    return null;
  }

  const [ivHex, encryptedHex] = encryptedData.split(":");
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, "hex"),
    Buffer.from(ivHex, "hex")
  );

  let decrypted = decipher.update(
    Buffer.from(encryptedHex, "hex"),
    "hex",
    "utf-8"
  );
  decrypted += decipher.final("utf-8");

  return decrypted;
};

exports.getDecryptedDocumentAsBase64 = (bufferData) => {
  if (!bufferData) return null;

  // Step 1: Convert Buffer (BLOB) to a string
  const encryptedData = bufferData.toString("utf-8");

  // Step 2: Decrypt the data
  const decryptedData = exports.decrypt(encryptedData);

  // Step 3: Return decrypted data (already base64 from encryption process)
  return decryptedData;
};
