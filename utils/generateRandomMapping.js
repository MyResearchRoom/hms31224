exports.generateRandomMapping = () => {
  const chars = "abcdefghijklmnopqrstuvwxyz ".split("");
  const shuffled = [...chars].sort(() => Math.random() - 0.5); // simple shuffle
  const mapping = {};
  chars.forEach((ch, idx) => {
    mapping[ch] = shuffled[idx];
  });
  return mapping;
};
