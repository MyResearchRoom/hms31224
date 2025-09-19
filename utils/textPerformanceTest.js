require("dotenv").config();

const { encrypt, decrypt } = require("./cryptography");
const { performance } = require("perf_hooks");

// Sample base64 data (simulate a small PDF or image base64)
// const sampleBase64 = Buffer.from(
//   JSON.stringify({
//     suger: 3462394,
//     bp: 32235,
//     height: 43,
//     weight: 43243,
//     temperature: 43,
//   })
// ).toString("base64");

const sampleBase64 = "This is a sample data to encrypt and decrypt.";

// Track performance
function measurePerformance() {
  console.log("Starting encryption/decryption performance test...\n");

  const memoryBefore = process.memoryUsage();

  // ENCRYPTION
  const startEncrypt = performance.now();
  const encrypted = encrypt(sampleBase64);
  const endEncrypt = performance.now();
  const encryptionTime = (endEncrypt - startEncrypt).toFixed(3);

  // DECRYPTION
  const startDecrypt = performance.now();
  const decrypted = decrypt(encrypted);
  const endDecrypt = performance.now();
  const decryptionTime = (endDecrypt - startDecrypt).toFixed(3);

  // ENTROPY calculation (Shannon entropy)
  const entropy = calculateEntropy(encrypted).toFixed(3);

  const memoryAfter = process.memoryUsage();

  console.log("=== Performance Results ===");
  console.log(`Sample Base64 Size: ${sampleBase64.length} bytes`);
  console.log(`Encrypted Size: ${encrypted.length} bytes`);
  console.log(`Encryption Time: ${encryptionTime} ms`);
  console.log(`Decryption Time: ${decryptionTime} ms`);
  console.log(`Decrypted Correctly: ${decrypted === sampleBase64}`);
  console.log(`Entropy of Encrypted Data: ${entropy}`);
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
  console.log("===========================\n");
}

// Calculate Shannon Entropy
function calculateEntropy(str) {
  const map = new Map();
  for (const char of str) {
    map.set(char, (map.get(char) || 0) + 1);
  }
  const length = str.length;
  let entropy = 0;
  for (const [, count] of map) {
    const p = count / length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

measurePerformance();
