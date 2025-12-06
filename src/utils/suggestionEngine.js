// utils/suggestionEngine.js

export function generateSuggestions(lastMessage, responseData) {
  const suggestions = new Set();

  // If user compared two areas
  if (lastMessage.toLowerCase().includes("compare")) {
    suggestions.add("Show 5-year CAGR comparison");
    suggestions.add("Which locality has lower risk?");
    suggestions.add("Forecast next year’s price for both");
  }

  // If user asked for analysis
  if (lastMessage.toLowerCase().includes("analyze")) {
    suggestions.add("Show demand trend for past 5 years");
    suggestions.add("What is the investment score?");
    suggestions.add("Compare this locality with a nearby one");
  }

  // Based on backend insights
  const areas = responseData?.areas || [];
  if (areas.length === 1) {
    const area = areas[0];
    suggestions.add(`Forecast price for ${area} in next 2 years`);
    suggestions.add(`Compare ${area} with the top locality`);
    suggestions.add(`Show risk breakdown for ${area}`);
  }

  // If many areas selected
  if (areas.length > 2) {
    suggestions.add("Show ranking of these localities");
    suggestions.add("Which locality has best demand momentum?");
  }

  // General fallback
  if (suggestions.size === 0) {
    suggestions.add("Show top investment localities");
    suggestions.add("Compare any two localities");
    suggestions.add("Show price trend between 2018–2023");
    suggestions.add("Where should I invest right now?");
  }

  return Array.from(suggestions).slice(0, 5); // limit to 5
}
