import React, { useState, useEffect } from "react";
import api from "./api";
import useTypingEffect from "./hooks/useTypingEffect";
import "./App.css";

import { generateInsightCards } from "./utils/insightEngine";
import { generateSuggestions } from "./utils/suggestionEngine";

import {
  enhanceTone,
  detectUserTone,
  applyToneStyle,
} from "./utils/toneEngine";
import {
  generateHeatmap,
  generateSparklineData,
} from "./utils/timelineEngine";

import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Table,
  Spinner,
  Badge,
} from "react-bootstrap";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

function App() {
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState([]);
  const [metric, setMetric] = useState("price");
  const [responseData, setResponseData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Localities loaded from backend
  const [localities, setLocalities] = useState([]);

  // For locality auto-suggest (dropdown under input)
  const [localitySuggestions, setLocalitySuggestions] = useState([]);
  const [showLocalitySuggestions, setShowLocalitySuggestions] = useState(false);

  // Dynamic suggested queries (carousel) based on last answer
  const [dynamicSuggestions, setDynamicSuggestions] = useState([]);

  // Higher-level follow-up suggestions based on intent + areas
  const [followUps, setFollowUps] = useState([]);

  // Intent memory
  const [intent, setIntent] = useState(null);

  // Memory of what the user has explored
  const [memory, setMemory] = useState({
    localities: [],
    preferredMetric: "price",
    lastCompared: [],
    lastYears: [],
  });

  // For animated typing of the latest main bot message
  const [botRawText, setBotRawText] = useState("");
  const botDisplayText = useTypingEffect(botRawText, 15); // speed ms per char

  // --- INITIAL LOAD: localities from backend ---
  useEffect(() => {
    api
      .get("/localities/")
      .then((res) => setLocalities(res.data.localities || []))
      .catch(() => setLocalities([]));
  }, []);

  // --- Helper: extract localities from text using the known list ---
  const extractLocalities = (text) => {
    if (!localities || localities.length === 0) return [];
    const t = text.toLowerCase();

    return localities.filter((loc) =>
      t.includes(loc.toLowerCase())
    );
  };

  // --- Helper: extract intent from message ---
  const extractIntent = (text) => {
    const t = text.toLowerCase();

    if (t.includes("compare")) return "comparison";
    if (t.includes("forecast") || t.includes("predict")) return "forecasting";
    if (t.includes("investment") || t.includes("invest")) return "investment";
    if (t.includes("trend") || t.includes("growth")) return "trend-analysis";
    if (t.includes("price")) return "price-analysis";
    if (t.includes("demand")) return "demand-analysis";

    return "general";
  };

  // --- Helper: generate follow-up suggestions based on areas + metric + intent ---
  const generateFollowUps = (areas, metricValue, intentValue) => {
    if (!areas || areas.length === 0) return [];

    let sugs = [];
    const a = areas[0];

    // General smart suggestions
    sugs.push(`Show me forecasted prices for ${a}`);
    sugs.push(`Compare ${a} with another locality`);
    sugs.push(`What drives demand in ${a}?`);

    // Intent-specific suggestions
    if (intentValue === "comparison") {
      sugs.push(`Compare ${a} with 2 more nearby areas`);
      sugs.push(`Which locality has better long-term growth than ${a}?`);
    }

    if (intentValue === "forecasting") {
      sugs.push(`Show me 5-year projections for ${a}`);
      sugs.push(`What affects future prices in ${a}?`);
    }

    if (intentValue === "investment") {
      sugs.push(`Is ${a} low-risk or high-risk for investment?`);
      sugs.push(`Compare rental yield for ${a} vs alternatives`);
    }

    if (intentValue === "trend-analysis") {
      sugs.push(`Break down year-wise demand spikes in ${a}`);
      sugs.push(`Show CAGR comparison for ${a}`);
    }

    // Metric-specific
    if (metricValue === "price" || metricValue === "both") {
      sugs.push(`Show historical price appreciation for ${a}`);
    }
    if (metricValue === "demand" || metricValue === "both") {
      sugs.push(`Show buyer demand strength in ${a}`);
    }

    return sugs.slice(0, 6);
  };

  // Auto-scroll chat to bottom whenever history or loading changes
  useEffect(() => {
    const box = document.querySelector(".chat-scroll");
    if (box) box.scrollTop = box.scrollHeight;
  }, [history, loading]);

  // Filter localities for dropdown based on message text
  useEffect(() => {
    if (!message.trim()) {
      setLocalitySuggestions([]);
      setShowLocalitySuggestions(false);
      return;
    }

    const match = localities
      .filter((loc) => loc.toLowerCase().includes(message.toLowerCase()))
      .slice(0, 6);

    setLocalitySuggestions(match);
    setShowLocalitySuggestions(match.length > 0);
  }, [message, localities]);

  // --------------------------
  // MAIN SEND HANDLER
  // --------------------------
  const handleSend = async (e) => {
    e?.preventDefault();
    if (!message.trim()) return;

    // Add user message + placeholder bot message
    setHistory((prev) => [
      ...prev,
      { from: "user", text: message },
      { from: "bot", text: "__typing__" },
    ]);

    // MEMORY: detect localities
    const locsInMessage = extractLocalities(message);

    setMemory((prev) => ({
      ...prev,
      localities: [...new Set([...prev.localities, ...locsInMessage])],
      preferredMetric: metric,
      lastCompared:
        locsInMessage.length > 1 ? locsInMessage : prev.lastCompared,
    }));

    // detect intent early
    const detectedIntent = extractIntent(message);
    setIntent(detectedIntent);

    setLoading(true);

    try {
      // Build enhanced message using memory
      let enhancedMessage = message;

      if (
        !message.toLowerCase().includes("compare") &&
        memory.localities.length > 0
      ) {
        enhancedMessage += ` (context: previously explored ${memory.localities.join(
          ", "
        )})`;
      }

      if (
        memory.lastYears.length === 2 &&
        !message.toLowerCase().includes("year")
      ) {
        enhancedMessage += ` using ${memory.lastYears[0]}-${memory.lastYears[1]}`;
      }

      if (
        memory.lastCompared.length >= 2 &&
        !message.toLowerCase().includes("compare")
      ) {
        enhancedMessage += ` (previous comparison: ${memory.lastCompared.join(
          " vs "
        )})`;
      }

      // API Call
      const res = await api.post("/query/", {
        message: enhancedMessage,
        metric: memory.preferredMetric,
      });

      const data = res.data;
      setResponseData(data);

      // store years in memory
      if (data.year_range && data.year_range.length === 2) {
        setMemory((prev) => ({
          ...prev,
          lastYears: data.year_range,
        }));
      }

      // Dynamic suggestions (Step 8)
      setDynamicSuggestions(generateSuggestions(message, data));

      // Tone analysis (Step 6)
      const userTone = detectUserTone(message);

      let finalText = data.summary || "No summary available.";
      finalText = enhanceTone(finalText, data);
      finalText = applyToneStyle(finalText, userTone);

      setBotRawText(finalText); // animate bot message

      // Replace typing placeholder → final bot message, plus meta messages
      setHistory((prev) => {
        const newHist = [...prev];
        const idx = newHist
          .map((m, i) => ({ ...m, i }))
          .reverse()
          .find((m) => m.from === "bot" && m.text === "__typing__")?.i;

        if (idx !== undefined) {
          newHist[idx] = { from: "bot", text: finalText, kind: "summary" };
        } else {
          newHist.push({ from: "bot", text: finalText, kind: "summary" });
        }

        // Intent acknowledgment (Step 12F)
        if (detectedIntent && detectedIntent !== "general") {
          newHist.push({
            from: "bot",
            text: `Got it — you're focusing on **${detectedIntent.replace(
              "-",
              " "
            )}**. Tailoring insights accordingly.`,
            kind: "meta",
          });
        }

        // Memory reinforcement (Step 10F)
        if (locsInMessage.length > 0) {
          newHist.push({
            from: "bot",
            text: `Noted: you're exploring ${locsInMessage.join(
              ", "
            )}. I'll keep this context in future queries.`,
            kind: "meta",
          });
        }

        // Follow-ups (Step 11 + 12)
        setFollowUps(generateFollowUps(locsInMessage, metric, detectedIntent));

        return newHist;
      });
    } catch (err) {
      console.error(err);

      setHistory((prev) => {
        const newHist = prev.filter((m) => m.text !== "__typing__");
        return [
          ...newHist,
          {
            from: "bot",
            text: "Something went wrong while processing your request.",
          },
        ];
      });
    } finally {
      setLoading(false);
      setMessage("");
    }
  };

  // --------------------------
  // CHART DATA
  // --------------------------
  const chartData =
    responseData && responseData.chart
      ? responseData.chart.labels.map((year, idx) => {
          const point = { year };
          responseData.chart.datasets.forEach((ds) => {
            point[ds.label] = ds.data[idx];
          });
          return point;
        })
      : [];

  const handleDownloadCsv = () => {
    if (!responseData) return;
    const areas = responseData.areas || [];
    const cities = responseData.cities || [];
    const yr = responseData.year_range || [];
    const params = new URLSearchParams();
    if (areas.length) params.set("areas", areas.join(","));
    if (cities.length) params.set("cities", cities.join(","));
    if (yr && yr.length === 2) {
      params.set("start_year", yr[0]);
      params.set("end_year", yr[1]);
    }
    const url = `${process.env.REACT_APP_API_URL}download_csv/?${params.toString()}`;
    window.open(url, "_blank");
  };

  const handleDownloadPdf = () => {
    if (!responseData) return;
    const areas = responseData.areas || [];
    const cities = responseData.cities || [];
    const yr = responseData.year_range || [];
    const params = new URLSearchParams();
    if (areas.length) params.set("areas", areas.join(","));
    if (cities.length) params.set("cities", cities.join(","));
    if (yr && yr.length === 2) {
      params.set("start_year", yr[0]);
      params.set("end_year", yr[1]);
    }
    params.set("metric", metric);
    const url = `${process.env.REACT_APP_API_URL}report_pdf/?${params.toString()}`;
    window.open(url, "_blank");
  };

  const insights = responseData?.insights;
  const ranked = insights?.ranked_areas || [];

  const samplePrompts = [
    "Analyze <your locality name>",
    "Compare two or three localities you see in the dataset",
    "Show price and demand trend for a locality between 2015 and 2020",
    "Which looks better for investment between <A> and <B>?",
  ];

  return (
    <Container fluid className="py-4 app-shell">
      {/* Top header */}
      <Row className="mb-3">
        <Col>
          <div className="d-flex flex-column align-items-center text-center">
            <h2 className="app-header-title mb-2">
              SigmaValue Real Estate Intelligence
            </h2>
            <p className="app-header-subtitle text-muted mb-1">
              A conversational analytics assistant for exploring locality-wise
              prices, demand and investment potential.
            </p>
            <div className="d-flex flex-wrap justify-content-center gap-2 mt-2">
              <span className="metric-pill active">Chat-powered insights</span>
              <span className="metric-pill">Trend charts</span>
              <span className="metric-pill">Investment scores</span>
              <span className="metric-pill">One-click PDF reports</span>
            </div>
          </div>
        </Col>
      </Row>

      <Row className="g-4">
        {/* Left column: Chat + ranking */}
        <Col lg={4}>
          <Card className="glass-card mb-4 shadow-sm">
            <Card.Header className="d-flex justify-content-between align-items-center">
              <span>Chat with the market</span>
              <div className="d-flex gap-1">
                <button
                  type="button"
                  className={`metric-pill ${
                    metric === "price" ? "active" : ""
                  }`}
                  onClick={() => setMetric("price")}
                >
                  Price
                </button>
                <button
                  type="button"
                  className={`metric-pill ${
                    metric === "demand" ? "active" : ""
                  }`}
                  onClick={() => setMetric("demand")}
                >
                  Demand
                </button>
                <button
                  type="button"
                  className={`metric-pill ${
                    metric === "both" ? "active" : ""
                  }`}
                  onClick={() => setMetric("both")}
                >
                  Both
                </button>
              </div>
            </Card.Header>
            <Card.Body className="d-flex flex-column">
              <div
                className="chat-scroll"
                style={{
                  flex: 1,
                  overflowY: "auto",
                  borderRadius: 14,
                  border: "1px solid #e2e8f0",
                  padding: "0.6rem",
                  marginBottom: "0.75rem",
                  maxHeight: 340,
                  background: "white",
                }}
              >
                {history.length === 0 && (
                  <div className="text-muted small">
                    You can ask things like:
                    <ul className="mt-2 mb-1">
                      {samplePrompts.map((p, idx) => (
                        <li key={idx}>{p}</li>
                      ))}
                    </ul>
                    <div className="mt-2 small">
                      Tip: use locality names exactly as they appear in the
                      dataset for best results.
                    </div>
                  </div>
                )}

                {history.map((msg, idx) => {
                  // USER MESSAGE
                  if (msg.from === "user") {
                    return (
                      <div key={idx} className="mb-2 text-end">
                        <Badge bg="primary" className="mb-1 badge-pill">
                          You
                        </Badge>
                        <div
                          style={{
                            display: "inline-block",
                            padding: "0.4rem 0.65rem",
                            borderRadius: 14,
                            background: "#e0f2fe",
                            maxWidth: "100%",
                            whiteSpace: "pre-wrap",
                            fontSize: "0.9rem",
                          }}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  }

                  // BOT TYPING PLACEHOLDER
                  if (msg.text === "__typing__") {
                    return (
                      <div key={idx} className="mb-2 text-start">
                        <Badge bg="secondary" className="mb-1 badge-pill">
                          Analyst Bot
                        </Badge>
                        <div
                          style={{
                            display: "inline-block",
                            padding: "0.4rem 0.65rem",
                            borderRadius: 14,
                            background: "#f3f4f6",
                            fontSize: "0.9rem",
                            fontStyle: "italic",
                          }}
                        >
                          typing
                          <span className="typing-dot">.</span>
                          <span className="typing-dot">.</span>
                          <span className="typing-dot">.</span>
                        </div>
                      </div>
                    );
                  }

                  // BOT FINAL / META MESSAGES
                  const lastAnimatedIndex = history
                    .map((m, i2) => ({ ...m, i2 }))
                    .filter(
                      (m) =>
                        m.from === "bot" &&
                        m.text !== "__typing__" &&
                        m.kind !== "meta"
                    )
                    .slice(-1)[0]?.i2;

                  const isLatestBot =
                    msg.from === "bot" &&
                    msg.kind !== "meta" &&
                    idx === lastAnimatedIndex;

                  const textToShow = isLatestBot
                    ? botDisplayText || msg.text
                    : msg.text;

                  return (
                    <div key={idx} className="mb-2 text-start">
                      <Badge bg="secondary" className="mb-1 badge-pill">
                        Analyst Bot
                      </Badge>
                      <div
                        style={{
                          display: "inline-block",
                          padding: "0.4rem 0.65rem",
                          borderRadius: 14,
                          background: "#f3f4f6",
                          maxWidth: "100%",
                          whiteSpace: "pre-wrap",
                          fontSize: "0.9rem",
                        }}
                      >
                        {textToShow}
                      </div>
                    </div>
                  );
                })}

                {loading && (
                  <div className="d-flex align-items-center gap-2 mt-2">
                    <Spinner animation="border" size="sm" />
                    <span className="text-muted small">
                      Analyzing market data…
                    </span>
                  </div>
                )}
              </div>

              {/* Dynamic suggestions carousel (Step 8) */}
              {dynamicSuggestions.length > 0 && (
                <div className="suggestion-carousel mb-2">
                  <div className="d-flex gap-2 overflow-auto py-1">
                    {dynamicSuggestions.map((s, idx) => (
                      <Button
                        key={idx}
                        variant="outline-primary"
                        size="sm"
                        className="flex-shrink-0 suggestion-chip"
                        onClick={() => {
                          setMessage(s);
                          handleSend({ preventDefault: () => {} });
                        }}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-up suggestions (Step 11/12) */}
              {followUps.length > 0 && (
                <div className="followup-box mb-2">
                  <div className="small text-muted mb-1">
                    You can also ask:
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    {followUps.map((f, idx) => (
                      <Button
                        key={idx}
                        variant="outline-primary"
                        size="sm"
                        className="followup-chip"
                        onClick={() => setMessage(f)}
                      >
                        {f}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Smart prompt chips */}
              <div className="smart-prompts mt-2">
                <span
                  className="prompt-chip"
                  onClick={() => setMessage("Analyze Wagholi")}
                >
                  Analyze a locality
                </span>

                <span
                  className="prompt-chip"
                  onClick={() => setMessage("Compare Baner and Wakad")}
                >
                  Compare areas
                </span>

                <span
                  className="prompt-chip"
                  onClick={() =>
                    setMessage(
                      "Show price trend for Kharadi from 2015 to 2023"
                    )
                  }
                >
                  Price trend
                </span>

                <span
                  className="prompt-chip"
                  onClick={() =>
                    setMessage(
                      "Which is better for investment: Aundh or Balewadi?"
                    )
                  }
                >
                  Investment comparison
                </span>
              </div>

              <Form onSubmit={handleSend}>
                <Form.Control
                  type="text"
                  placeholder='Ex: "Compare two localities you see in Sample_data"'
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onFocus={() =>
                    localitySuggestions.length > 0 &&
                    setShowLocalitySuggestions(true)
                  }
                  className="mb-2"
                  autoComplete="off"
                />

                {/* Locality auto-suggest dropdown */}
                {showLocalitySuggestions && (
                  <div className="suggestion-box">
                    {localitySuggestions.map((s, idx) => (
                      <div
                        key={idx}
                        className="suggestion-item"
                        onClick={() => {
                          setMessage(s);
                          setShowLocalitySuggestions(false);
                        }}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-100"
                  disabled={loading || !message.trim()}
                >
                  Ask
                </Button>
              </Form>
            </Card.Body>
          </Card>

          {/* Ranking card */}
          {insights && ranked.length > 0 && (
            <Card className="glass-card shadow-sm">
              <Card.Header>Top localities in this view</Card.Header>
              <Card.Body className="pt-3">
                {ranked.slice(0, 5).map((item, idx) => (
                  <div
                    key={item.area}
                    className="d-flex justify-content-between align-items-center mb-2"
                  >
                    <div>
                      <div style={{ fontSize: "0.93rem", fontWeight: 500 }}>
                        {idx + 1}. {item.area}
                      </div>
                      <div className="small text-muted">
                        Investment score: {item.investment_score}/10
                      </div>
                    </div>
                    <span
                      className="rank-badge"
                      style={{
                        background:
                          idx === 0
                            ? "#22c55e22"
                            : idx === 1
                            ? "#3b82f622"
                            : "#e5e7eb",
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      {idx === 0 ? "Best" : idx === 1 ? "Strong" : "Good"}
                    </span>
                  </div>
                ))}
              </Card.Body>
            </Card>
          )}
        </Col>

        {/* Right column: insights + charts + table */}
        <Col lg={8}>
          {responseData ? (
            <>
              {/* Insight cards */}
              {insights &&
                insights.areas &&
                Object.keys(insights.areas).length > 0 && (
                  <>
                    <Card className="glass-card mb-3 shadow-sm">
                      <Card.Header>Key Insights & Recommendations</Card.Header>
                      <Card.Body>
                        <Row>
                          {Object.entries(insights.areas).map(([area, s]) => (
                            <Col md={6} key={area} className="mb-3">
                              <Card
                                className="h-100 border-0"
                                style={{ background: "#f8fafc" }}
                              >
                                <Card.Body>
                                  <div className="d-flex justify-content-between align-items-start mb-1">
                                    <div>
                                      <h6 className="mb-1">{area}</h6>
                                      <div className="small text-muted">
                                        {s.year_start}–{s.year_end} • Demand:{" "}
                                        {s.demand_trend}
                                      </div>
                                    </div>
                                    <Badge
                                      bg="success"
                                      className="badge-pill"
                                    >
                                      {s.investment_score.toFixed(1)}/10
                                    </Badge>
                                  </div>
                                  <div className="small mb-2">
                                    <div>
                                      Avg price: ₹
                                      {Math.round(
                                        s.avg_price
                                      ).toLocaleString("en-IN")}
                                    </div>
                                    <div>
                                      Price CAGR:{" "}
                                      {(s.price_cagr * 100).toFixed(1)}%
                                    </div>
                                    {s.price_forecast_next_year && (
                                      <div>
                                        Next year est.: ₹
                                        {Math.round(
                                          s.price_forecast_next_year
                                        ).toLocaleString("en-IN")}
                                      </div>
                                    )}
                                  </div>
                                  <div className="small text-muted">
                                    Growth {s.growth_score.toFixed(1)}/10 •
                                    Demand {s.demand_score.toFixed(1)}/10 •
                                    Risk {s.risk_score.toFixed(1)}/10
                                  </div>
                                </Card.Body>
                              </Card>
                            </Col>
                          ))}
                        </Row>
                      </Card.Body>
                    </Card>

                    {/* MICRO INSIGHTS PANEL (Step 7 + 9) */}
                    <Card className="glass-card mb-3 shadow-sm">
                      <Card.Header>Analyst Micro-Summary</Card.Header>
                      <Card.Body>
                        {generateInsightCards(insights.areas).map((entry) => (
                          <div key={entry.area} className="mb-4">
                            <h6 className="mb-2">{entry.area}</h6>

                            <Row>
                              {entry.items.map((itm, idx) => (
                                <Col md={6} key={idx} className="mb-3">
                                  <div
                                    style={{
                                      borderRadius: 10,
                                      padding: "0.75rem",
                                      border: "1px solid #e5e7eb",
                                      background: "#f9fafb",
                                    }}
                                  >
                                    <div className="d-flex justify-content-between">
                                      <div style={{ fontWeight: 500 }}>
                                        {itm.icon} {itm.title}
                                      </div>
                                      <div
                                        style={{
                                          fontWeight: 600,
                                          color: itm.tone.color,
                                        }}
                                      >
                                        {itm.value}
                                      </div>
                                    </div>
                                    <div
                                      className="small mt-1"
                                      style={{ color: itm.tone.color }}
                                    >
                                      {itm.tone.label}
                                    </div>
                                  </div>
                                </Col>
                              ))}
                            </Row>

                            {/* Mini Heatmap + Sparkline */}
                            <div className="mt-2">
                              {/* Heatmap */}
                              <div className="d-flex align-items-center mb-1">
                                {generateHeatmap(
                                  entry.area,
                                  responseData
                                ).map((segment, i) => (
                                  <div
                                    key={i}
                                    style={{
                                      width: 22,
                                      height: 12,
                                      background: segment.color,
                                      borderRadius: 3,
                                      marginRight: 4,
                                    }}
                                  ></div>
                                ))}
                              </div>

                              {/* Sparkline */}
                              <svg width="100%" height="40">
                                {(() => {
                                  const data = generateSparklineData(
                                    entry.area,
                                    responseData
                                  );
                                  if (!data || data.length === 0) return null;

                                  const max = Math.max(...data);
                                  const min = Math.min(...data);
                                  const range = max - min || 1;

                                  const step = 100 / (data.length - 1);

                                  const points = data
                                    .map((v, idx) => {
                                      const x = idx * step;
                                      const y =
                                        35 - ((v - min) / range) * 30;
                                      return `${x},${y}`;
                                    })
                                    .join(" ");

                                  return (
                                    <polyline
                                      points={points}
                                      fill="none"
                                      stroke="#4f46e5"
                                      strokeWidth="2"
                                    />
                                  );
                                })()}
                              </svg>
                            </div>
                          </div>
                        ))}
                      </Card.Body>
                    </Card>
                  </>
                )}

              {/* Trend chart + download actions */}
              <Card className="glass-card mb-3 shadow-sm">
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <span>Trends over time</span>
                  <div className="d-flex gap-2">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={handleDownloadCsv}
                    >
                      CSV Export
                    </Button>
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={handleDownloadPdf}
                    >
                      PDF Report
                    </Button>
                  </div>
                </Card.Header>
                <Card.Body style={{ height: 320 }}>
                  {chartData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="year" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {responseData.chart.datasets.map((ds) => (
                          <Line
                            key={ds.label}
                            type="monotone"
                            dataKey={ds.label}
                            dot={false}
                            strokeWidth={2}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-muted">
                      No chart data available for this query.
                    </div>
                  )}
                </Card.Body>
              </Card>

              {/* Data table */}
              <Card className="glass-card shadow-sm">
                <Card.Header>Underlying dataset (filtered)</Card.Header>
                <Card.Body style={{ maxHeight: 320, overflowY: "auto" }}>
                  {responseData.table && responseData.table.length > 0 ? (
                    <div className="table-wrapper">
                      <Table
                        striped
                        hover
                        size="sm"
                        responsive
                        className="mb-0"
                      >
                        <thead>
                          <tr>
                            {Object.keys(responseData.table[0]).map((key) => (
                              <th key={key}>{key}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {responseData.table.map((row, idx) => (
                            <tr key={idx}>
                              {Object.keys(row).map((key) => (
                                <td key={key}>{row[key]}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-muted">
                      No rows found for this query.
                    </div>
                  )}
                </Card.Body>
              </Card>
            </>
          ) : (
            <Card className="glass-card shadow-sm">
              <Card.Body>
                <h5 className="mb-2">Welcome 👋</h5>
                <p className="text-muted mb-2">
                  This dashboard turns the SigmaValue sample dataset into an
                  interactive, chat-driven real estate intelligence tool. Use
                  the chat on the left to explore localities, compare trends,
                  and generate exportable reports.
                </p>
                <div className="mb-2">
                  <span className="insight-chip">Locality comparisons</span>
                  <span className="insight-chip">Price & demand trends</span>
                  <span className="insight-chip">Investment scoring</span>
                  <span className="insight-chip">PDF market reports</span>
                </div>
                <p className="small text-muted mb-1">
                  Start by entering a locality name that exists in the dataset
                  (e.g. any value you see in the{" "}
                  <code>final_location</code> column).
                </p>
              </Card.Body>
            </Card>
          )}
        </Col>
      </Row>
    </Container>
  );
}

export default App;
