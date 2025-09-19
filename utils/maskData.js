const maskStringPartial = (str, maskFromStart, maskPercent) => {
  if (!str || typeof str !== "string") return str;

  const length = str.length;
  const maskLength = Math.floor((maskPercent / 100) * length);

  if (maskLength >= length) {
    return "*".repeat(length);
  }

  if (maskFromStart) {
    const visible = str.slice(-(length - maskLength));
    return "*".repeat(maskLength) + visible;
  } else {
    const visible = str.slice(0, length - maskLength);
    return visible + "*".repeat(maskLength);
  }
};

exports.maskData = function maskData(
  data,
  maskFromStart = true,
  maskPercent = 80
) {
  if (typeof data === "string") {
    return maskStringPartial(data, maskFromStart, maskPercent);
  }

  if (Array.isArray(data)) {
    return data.map((item) => maskData(item, maskFromStart, maskPercent));
  }

  if (typeof data === "object" && data !== null) {
    const maskedObj = {};
    for (const key in data) {
      maskedObj[key] = maskData(data[key], maskFromStart, maskPercent);
    }
    return maskedObj;
  }

  return "***MASKED***";
};
