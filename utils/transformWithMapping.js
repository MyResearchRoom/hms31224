exports.transformWithMapping = (str, mapping) => {
  return str
    .toLowerCase()
    .split("")
    .map((ch) => mapping[ch] || ch)
    .join("");
};
