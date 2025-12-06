// utils/timelineEngine.js
function normalize(values) {
  if (!values || values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);

  return values.map(v => (v - min) / (max - min));
}

// Builds a simple 4-color heatmap block scale
function getColor(intensity) {
  const idx = Math.floor(intensity * 3); // 0–3
  return ["#e2e8f0", "#a5b4fc", "#6366f1", "#4338ca"][idx]; // light → dark
}


// Extract a tiny sparkline (mini trend line)
export function generateSparklineData(area, responseData) {
  if (!responseData?.chart?.datasets) return [];

  const ds = responseData.chart.datasets.find(d => d.label === area);
  if (!ds) return [];

  return ds.data; // array of values
}


// Generate heatmap segments for insight panel
export function generateHeatmap(area, responseData) {
  const values = generateSparklineData(area, responseData);
  const normalized = normalize(values);

  return normalized.map(n => ({
    intensity: n,
    color: getColor(n)
  }));
}
