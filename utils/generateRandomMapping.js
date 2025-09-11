exports.generateRandomMapping = () => {
  const chars = "abcdefghijklmnopqrstuvwxyz_1234567890!@#$%^&?*-+= ".split("");
  const shuffled = [...chars].sort(() => Math.random() - 0.5);
  const mapping = {};
  chars.forEach((ch, idx) => {
    mapping[ch] = shuffled[idx];
  });
  return mapping;
};
