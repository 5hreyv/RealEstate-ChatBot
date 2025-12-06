// utils/intentParser.js

export function parseIntent(message, localities) {
  const cleaned = message.toLowerCase().trim();

  let detectedLocalities = [];
  let yearRange = null;
  let metric = null;
  let intent = "general";

  // -----------------------------
  // 1) Fuzzy Match Localities
  // -----------------------------
  localities.forEach(loc => {
    const l = loc.toLowerCase();
    if (cleaned.includes(l)) {
      detectedLocalities.push(loc);
    } else {
      // basic spelling tolerance
      const dist = levenshtein(cleaned, l);
      if (dist <= 3) detectedLocalities.push(loc);
    }
  });

  detectedLocalities = [...new Set(detectedLocalities)];

  // -----------------------------
  // 2) Extract Year Range
  // -----------------------------
  const yearRegex = /20\d{2}/g;
  const yearsFound = cleaned.match(yearRegex);

  if (yearsFound && yearsFound.length >= 2) {
    yearRange = [
      parseInt(yearsFound[0]),
      parseInt(yearsFound[1])
    ];
  }

  // -----------------------------
  // 3) Detect Metric (price / demand / both)
  // -----------------------------
  if (cleaned.includes("price")) metric = "price";
  if (cleaned.includes("demand")) metric = "demand";
  if (cleaned.includes("trend")) metric = "both";
  if (!metric) metric = "price";

  // -----------------------------
  // 4) Detect Intent
  // -----------------------------
  if (cleaned.includes("compare")) intent = "compare_localities";
  if (cleaned.includes("investment")) intent = "investment";
  if (cleaned.includes("trend")) intent = "trend";
  if (cleaned.includes("forecast")) intent = "forecast";

  return {
    intent,
    areas: detectedLocalities,
    yearRange,
    metric
  };
}

// -----------------------------
// Levenshtein Distance
// -----------------------------
function levenshtein(a, b) {
  const matrix = Array(a.length + 1)
    .fill(null)
    .map(() => Array(b.length + 1).fill(null));

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return matrix[a.length][b.length];
}
