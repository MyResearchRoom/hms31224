require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { performance } = require("perf_hooks");

const { encrypt, getDecryptedDocumentAsBase64 } = require("./cryptography");

// Load a sample file (e.g., PDF or image)
const filePath = path.join(
  __dirname,
  "testFiles/ReactJSNotesForProfessionals.pdf"
); // Replace with your file
const fileBuffer = fs.readFileSync(filePath);
const fileMimeType = "application/pdf"; // Change according to file type (e.g., image/png)

// Convert to base64 string with prefix
const base64String = `data:${fileMimeType};base64,${fileBuffer.toString(
  "base64"
)}`;

// Track performance
function measureFilePerformance() {
  console.log("Starting file encryption/decryption performance test...\n");

  const memoryBefore = process.memoryUsage();

  // ENCRYPTION
  const startEncrypt = performance.now();
  const encrypted = encrypt(base64String); // Output is base64 string (encrypted)
  const endEncrypt = performance.now();
  const encryptionTime = (endEncrypt - startEncrypt).toFixed(3);

  // Convert encrypted base64 to Buffer for decryption
  const encryptedBuffer = Buffer.from(encrypted, "utf-8");

  // DECRYPTION
  const startDecrypt = performance.now();
  const decryptedBase64 = getDecryptedDocumentAsBase64(encryptedBuffer);
  const endDecrypt = performance.now();
  const decryptionTime = (endDecrypt - startDecrypt).toFixed(3);

  // Compare original and decrypted (skip prefix comparison if needed)
  const originalData = base64String.split(",")[1];
  const decryptedData = decryptedBase64.split(",")[1];
  const isCorrect = originalData === decryptedData;

  const memoryAfter = process.memoryUsage();

  console.log("=== File Performance Results ===");
  console.log(`Original File Size: ${fileBuffer.length} bytes`);
  console.log(`Encrypted Size: ${encrypted.length} bytes`);
  console.log(`Encryption Time: ${encryptionTime} ms`);
  console.log(`Decryption Time: ${decryptionTime} ms`);
  console.log(`Decrypted Correctly: ${isCorrect}`);
  console.log("Memory Usage (in MB):");
  console.log(`  RSS: ${(memoryAfter.rss - memoryBefore.rss) / 1024 / 1024}`);
  console.log(
    `  Heap Used: ${
      (memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024
    }`
  );
  console.log(
    `  External: ${
      (memoryAfter.external - memoryBefore.external) / 1024 / 1024
    }`
  );

  isCorrect
    ? console.log("\n\n Encryption/Decryption perform successful!")
    : console.log("Encryption/Decryption failed.");

  console.log("===========================\n");
}

measureFilePerformance();
