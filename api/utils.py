import os
import re
from typing import Dict, Any, List, Optional

import numpy as np
import pandas as pd
from difflib import get_close_matches

# Django imports
from django.conf import settings

# Optional LLM
try:
    from openai import OpenAI
    client = OpenAI(api_key=settings.OPENAI_API_KEY) if getattr(settings, "OPENAI_API_KEY", "") else None
except Exception:
    client = None

# Global dataset cache
_df = None

# Column schema (normalized names)
SCHEMA = {
    "area": "final_location",
    "year": "year",
    "city": "city",
    "price": "flat_-_weighted_average_rate",
    "demand": "total_sold_-_igr",
}

# ---------------------------------------------------------------------
# LOAD DATASET
# ---------------------------------------------------------------------
def get_dataset() -> pd.DataFrame:
    """
    Load Excel once and normalize column names.
    """
    global _df
    if _df is not None:
        return _df

    excel_path = settings.EXCEL_PATH
    if not os.path.exists(excel_path):
        raise FileNotFoundError(f"Excel file not found at {excel_path}")

    df = pd.read_excel(excel_path)
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

    # Validate schema
    cols = set(df.columns)
    missing = [v for v in SCHEMA.values() if v not in cols]
    if missing:
        raise ValueError(f"Missing expected columns: {missing}")

    _df = df
    return _df


# ---------------------------------------------------------------------
# NLP HELPERS
# ---------------------------------------------------------------------
def extract_year_range(message: str) -> Optional[tuple]:
    years = re.findall(r"\b(19\d{2}|20\d{2})\b", message)
    if not years:
        return None
    years_int = sorted(set(int(y) for y in years))
    if len(years_int) == 1:
        return (years_int[0], years_int[0])
    return (years_int[0], years_int[-1])


def detect_metric(message: str, default="price") -> str:
    msg = message.lower()
    if "both" in msg or ("price" in msg and "demand" in msg):
        return "both"
    if any(w in msg for w in ["demand", "sales", "interest"]):
        return "demand"
    if any(w in msg for w in ["price", "rate", "cost", "value"]):
        return "price"
    return default


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def extract_cities_from_message(message: str) -> List[str]:
    df = get_dataset()
    cities = df[SCHEMA["city"]].dropna().astype(str).unique().tolist()
    msg = _normalize_text(message)
    return [c for c in cities if _normalize_text(c) in msg]


def extract_areas_from_message(message: str) -> List[str]:
    """
    Exact match first; fuzzy fallback second.
    """
    df = get_dataset()
    areas = df[SCHEMA["area"]].dropna().astype(str).unique().tolist()

    msg = message.lower()

    # Exact match
    exact = []
    for a in areas:
        pattern = r"\b" + re.escape(a.lower()) + r"\b"
        if re.search(pattern, msg):
            exact.append(a)

    if exact:
        return exact

    # Fuzzy fallback
    tokens = msg.split()
    candidates = set()
    for n in range(1, min(3, len(tokens)) + 1):
        for i in range(len(tokens) - n + 1):
            candidates.add(" ".join(tokens[i:i+n]))

    norm = {a: a.lower() for a in areas}
    norm_list = list(norm.values())

    matches = set()
    for cand in candidates:
        close = get_close_matches(cand.lower(), norm_list, n=3, cutoff=0.8)
        for m in close:
            for orig, nval in norm.items():
                if nval == m:
                    matches.add(orig)

    return list(matches)


# ---------------------------------------------------------------------
# DATA FILTERING
# ---------------------------------------------------------------------
def filter_data(
    areas: Optional[List[str]] = None,
    year_range: Optional[tuple] = None,
    cities: Optional[List[str]] = None,
) -> pd.DataFrame:

    df = get_dataset()
    area_col = SCHEMA["area"]
    year_col = SCHEMA["year"]
    city_col = SCHEMA["city"]

    norm = lambda x: str(x).lower().strip()

    df["_area_norm"] = df[area_col].apply(norm)
    df["_city_norm"] = df[city_col].apply(norm)

    areas_norm = [norm(a) for a in areas] if areas else []
    cities_norm = [norm(c) for c in cities] if cities else []

    filtered = df.copy()

    if cities_norm:
        filtered = filtered[filtered["_city_norm"].isin(cities_norm)]

    if areas_norm:
        mask = False
        for a in areas_norm:
            mask |= filtered["_area_norm"].str.contains(a)
        filtered = filtered[mask]

    if year_range:
        start, end = year_range
        filtered = filtered[(filtered[year_col] >= start) & (filtered[year_col] <= end)]

    return filtered.drop(columns=["_area_norm", "_city_norm"], errors="ignore")


# ---------------------------------------------------------------------
# CHART + TABLE DATA
# ---------------------------------------------------------------------
def build_chart_data(filtered_df: pd.DataFrame, metric: str = "price") -> Dict[str, Any]:
    if filtered_df.empty:
        return {"labels": [], "datasets": []}

    area_col = SCHEMA["area"]
    year_col = SCHEMA["year"]

    metrics = ["price", "demand"] if metric == "both" else [metric]

    labels = sorted(filtered_df[year_col].unique().tolist())
    grouped = filtered_df.groupby([year_col, area_col])

    datasets = []

    for area in filtered_df[area_col].dropna().unique():
        for m in metrics:
            col = SCHEMA[m]
            series = []

            for year in labels:
                try:
                    val = grouped[col].mean().loc[(year, area)]
                except KeyError:
                    val = None
                series.append(float(val) if val is not None else None)

            label = f"{area} ({m})" if metric == "both" else area
            datasets.append({"label": label, "metric": m, "data": series})

    return {"labels": labels, "datasets": datasets}


def build_table_data(filtered_df: pd.DataFrame, limit: int = 200):
    return filtered_df.head(limit).to_dict(orient="records")


# ---------------------------------------------------------------------
# ANALYTICS: STATS, INSIGHTS, FORECAST
# ---------------------------------------------------------------------
def _compute_area_stats(filtered_df: pd.DataFrame):
    if filtered_df.empty:
        return {}

    area_col = SCHEMA["area"]
    year_col = SCHEMA["year"]
    price_col = SCHEMA["price"]
    demand_col = SCHEMA["demand"]

    stats = {}

    for area, g in filtered_df.groupby(area_col):
        g = g.sort_values(year_col)
        years = g[year_col].unique().tolist()

        price_series = g.groupby(year_col)[price_col].mean().sort_index()

        avg_price = float(price_series.mean())
        min_price = float(price_series.min())
        max_price = float(price_series.max())

        # CAGR
        if len(price_series) >= 2:
            p0 = float(price_series.iloc[0])
            pN = float(price_series.iloc[-1])
            n = len(price_series) - 1
            cagr = (pN / p0) ** (1/n) - 1 if p0 > 0 else 0
        else:
            cagr = 0

        # volatility
        if len(price_series) >= 3:
            vol = float(price_series.pct_change().dropna().std())
        else:
            vol = 0

        # demand stats
        if demand_col in g.columns:
            demand_series = g.groupby(year_col)[demand_col].sum().sort_index()
            avg_demand = float(demand_series.mean())
            total_demand = float(demand_series.sum())

            d0 = float(demand_series.iloc[0])
            dN = float(demand_series.iloc[-1])

            if dN > d0 * 1.1:
                demand_trend = "Rising"
            elif dN < d0 * 0.9:
                demand_trend = "Falling"
            else:
                demand_trend = "Stable"
        else:
            avg_demand = total_demand = None
            demand_trend = "Unknown"

        # forecast
        if len(price_series) >= 2:
            xs = np.array(price_series.index)
            ys = np.array(price_series.values)
            try:
                m, b = np.polyfit(xs, ys, 1)
                forecast_next = float(m * (years[-1] + 1) + b)
            except Exception:
                forecast_next = None
        else:
            forecast_next = None

        stats[area] = {
            "year_start": years[0],
            "year_end": years[-1],
            "avg_price": avg_price,
            "min_price": min_price,
            "max_price": max_price,
            "price_cagr": cagr,
            "price_volatility": vol,
            "avg_demand": avg_demand,
            "total_demand": total_demand,
            "demand_trend": demand_trend,
            "price_forecast_next_year": forecast_next,
        }

    return stats


def build_insights(filtered_df, year_range, metric):
    stats = _compute_area_stats(filtered_df)
    if not stats:
        return {"areas": {}, "ranked_areas": [], "year_range": year_range}

    max_demand = max((s["avg_demand"] or 0) for s in stats.values()) or 1
    max_volatility = max((s["price_volatility"] or 0) for s in stats.values()) or 1

    ranking = []
    for area, s in stats.items():
        growth_score = (s["price_cagr"] + 0.05) / 0.20 * 10
        growth_score = max(0, min(10, growth_score))

        demand_score = (s["avg_demand"] or 0) / max_demand * 10

        risk_score = 10 - ((s["price_volatility"] or 0) / max_volatility * 10)

        investment_score = 0.4 * growth_score + 0.4 * demand_score + 0.2 * risk_score

        s["growth_score"] = growth_score
        s["demand_score"] = demand_score
        s["risk_score"] = risk_score
        s["investment_score"] = investment_score

        ranking.append({"area": area, "investment_score": round(investment_score, 1)})

    ranking.sort(key=lambda x: x["investment_score"], reverse=True)

    return {
        "areas": stats,
        "ranked_areas": ranking,
        "year_range": year_range,
        "metric": metric,
    }


# ---------------------------------------------------------------------
# SUMMARIES
# ---------------------------------------------------------------------
def build_basic_summary(filtered_df, areas, cities, year_range, metric):
    if filtered_df.empty:
        return "No matching data found for this query."

    year_col = SCHEMA["year"]
    price_col = SCHEMA["price"]
    demand_col = SCHEMA["demand"]

    years = sorted(filtered_df[year_col].unique())

    parts = []
    label = ", ".join(areas) if areas else "the dataset"
    parts.append(f"Here’s the market analysis for {label}.")
    parts.append(f"Data is available from {years[0]} to {years[-1]}.")

    # price range
    if metric in ("price", "both"):
        pmin = float(filtered_df[price_col].min())
        pmax = float(filtered_df[price_col].max())
        parts.append(f"Average flat prices range from ₹{pmin:,.0f} to ₹{pmax:,.0f}.")

    # demand
    if metric in ("demand", "both"):
        dmin = float(filtered_df[demand_col].min())
        dmax = float(filtered_df[demand_col].max())
        parts.append(f"Annual demand varies between {dmin:,.0f} and {dmax:,.0f} units.")

    # trend
    p_first = filtered_df[filtered_df[year_col] == years[0]][price_col].mean()
    p_last = filtered_df[filtered_df[year_col] == years[-1]][price_col].mean()

    if p_last > p_first * 1.05:
        parts.append("Prices show an upward trend.")
    elif p_last < p_first * 0.95:
        parts.append("Prices appear to be softening.")
    else:
        parts.append("Prices are relatively stable.")

    return " ".join(parts)

def build_llm_summary(filtered_df, areas, cities, year_range, metric: str) -> str:
    """
    Safe fallback summary generator – never crashes backend.
    """
    basic = build_basic_summary(filtered_df, areas, cities, year_range, metric)

    # If no OpenAI client or filtered_df empty → return basic
    if client is None or filtered_df.empty:
        return basic

    # Try LLM, but if ANY error occurs → return basic summary
    try:
        resp = client.responses.create(
            model="gpt-4.1-mini",
            input=basic,
        )
        # New OpenAI format
        return resp.output[0].content[0].text
    except Exception as e:
        return basic
