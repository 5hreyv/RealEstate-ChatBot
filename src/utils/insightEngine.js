// utils/insightEngine.js

export function generateInsightCards(areaInsights) {
  if (!areaInsights) return [];

  const cards = [];

  Object.entries(areaInsights).forEach(([area, data]) => {
    const cagr = (data.price_cagr * 100).toFixed(1);
    const demand = data.demand_trend;
    const risk = data.risk_score.toFixed(1);
    const score = data.investment_score.toFixed(1);

    // Category Classifier
    const classify = (v) => {
      if (v >= 8) return { label: "Strong", color: "#16a34a" }; // green
      if (v >= 5) return { label: "Moderate", color: "#f59e0b" }; // amber
      return { label: "Weak", color: "#dc2626" }; // red
    };

    const riskClass = classify(10 - data.risk_score);
    const scoreClass = classify(data.investment_score);

    cards.push({
      area,
      items: [
        {
          title: "5-year CAGR",
          value: `${cagr}%`,
          icon: "📈",
          tone: classify(parseFloat(cagr)),
        },
        {
          title: "Demand Trend",
          value: demand,
          icon: "📊",
          tone: demand.includes("increasing")
            ? { label: "Increasing", color: "#16a34a" }
            : demand.includes("falling")
            ? { label: "Declining", color: "#dc2626" }
            : { label: "Stable", color: "#6b7280" },
        },
        {
          title: "Risk Score",
          value: `${risk}/10`,
          icon: "⚠️",
          tone: riskClass,
        },
        {
          title: "Investment Score",
          value: `${score}/10`,
          icon: "💡",
          tone: scoreClass,
        },
      ],
    });
  });

  return cards;
}
