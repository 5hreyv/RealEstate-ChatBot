import React, { useState } from "react";
import api from "./api";
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

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!message.trim()) return;

    setHistory((prev) => [...prev, { from: "user", text: message }]);
    setLoading(true);

    try {
      const res = await api.post("/query/", { message, metric });
      const data = res.data;
      setResponseData(data);
      setHistory((prev) => [
        ...prev,
        { from: "bot", text: data.summary || "No summary available." },
      ]);
    } catch (err) {
      console.error(err);
      setHistory((prev) => [
        ...prev,
        {
          from: "bot",
          text: "Something went wrong while processing your request.",
        },
      ]);
    } finally {
      setLoading(false);
      setMessage("");
    }
  };

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
    'Analyze <your locality name>',
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
              A conversational analytics assistant for exploring locality-wise prices, demand and investment potential.
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
                  className={`metric-pill ${metric === "price" ? "active" : ""}`}
                  onClick={() => setMetric("price")}
                >
                  Price
                </button>
                <button
                  type="button"
                  className={`metric-pill ${metric === "demand" ? "active" : ""}`}
                  onClick={() => setMetric("demand")}
                >
                  Demand
                </button>
                <button
                  type="button"
                  className={`metric-pill ${metric === "both" ? "active" : ""}`}
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
                      Tip: use locality names exactly as they appear in the dataset for best results.
                    </div>
                  </div>
                )}
                {history.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`mb-2 ${
                      msg.from === "user" ? "text-end" : "text-start"
                    }`}
                  >
                    <Badge
                      bg={msg.from === "user" ? "primary" : "secondary"}
                      className="mb-1 badge-pill"
                    >
                      {msg.from === "user" ? "You" : "Analyst Bot"}
                    </Badge>
                    <div
                      style={{
                        display: "inline-block",
                        padding: "0.4rem 0.65rem",
                        borderRadius: 14,
                        background:
                          msg.from === "user" ? "#e0f2fe" : "#f3f4f6",
                        maxWidth: "100%",
                        whiteSpace: "pre-wrap",
                        fontSize: "0.9rem",
                      }}
                    >
                      {msg.text}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="d-flex align-items-center gap-2 mt-2">
                    <Spinner animation="border" size="sm" />
                    <span className="text-muted small">Analyzing market data…</span>
                  </div>
                )}
              </div>

              <Form onSubmit={handleSend}>
                <Form.Control
                  type="text"
                  placeholder='Ex: "Compare two localities you see in Sample_data"'
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="mb-2"
                />
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
              {insights && insights.areas && Object.keys(insights.areas).length > 0 && (
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
                                <Badge bg="success" className="badge-pill">
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
                                Growth {s.growth_score.toFixed(1)}/10 • Demand{" "}
                                {s.demand_score.toFixed(1)}/10 • Risk{" "}
                                {s.risk_score.toFixed(1)}/10
                              </div>
                            </Card.Body>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  </Card.Body>
                </Card>
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
                      <Table striped hover size="sm" responsive className="mb-0">
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
                  This dashboard turns the SigmaValue sample dataset into an interactive,
                  chat-driven real estate intelligence tool. Use the chat on the left to
                  explore localities, compare trends, and generate exportable reports.
                </p>
                <div className="mb-2">
                  <span className="insight-chip">Locality comparisons</span>
                  <span className="insight-chip">Price & demand trends</span>
                  <span className="insight-chip">Investment scoring</span>
                  <span className="insight-chip">PDF market reports</span>
                </div>
                <p className="small text-muted mb-1">
                  Start by entering a locality name that exists in the dataset (e.g. any
                  value you see in the <code>final_location</code> column).
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
