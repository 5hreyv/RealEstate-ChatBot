// utils/toneEngine.js

export function enhanceTone(raw, data) {
  if (!raw) return "";

  let text = raw;

  const emojiMap = {
    rising: "📈",
    increasing: "📈",
    growth: "📈",
    demand: "📊",
    falling: "📉",
    decline: "📉",
    stable: "➖",
    risk: "⚠️",
    opportunity: "💡",
    investment: "🏡",
    price: "💰",
    future: "🔮",
    strong: "🔥",
  };

  Object.keys(emojiMap).forEach((word) => {
    const regex = new RegExp("\\b" + word + "\\b", "gi");
    text = text.replace(regex, `${word} ${emojiMap[word]}`);
  });

  text = text.replace(/\. /g, ".\n");

  return text.trim();
}

export function detectUserTone(message) {
  const msg = message.toLowerCase();

  if (msg.includes("confused") || msg.includes("help")) return "supportive";
  if (msg.includes("compare") || msg.includes("trend")) return "analytical";
  if (msg.includes("price") || msg.includes("investment")) return "professional";

  return "neutral";
}

export function applyToneStyle(text, tone) {
  if (tone === "supportive")
    return "No worries, let me walk you through this 😊\n\n" + text;

  if (tone === "analytical")
    return "Here's a data-driven breakdown 📊:\n\n" + text;

  if (tone === "professional")
    return "Here's the insight you're looking for:\n\n" + text;

  return text;
}
