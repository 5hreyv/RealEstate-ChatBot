import os
import re
from typing import Dict, Any, List, Optional

import numpy as np
import pandas as pd
from difflib import get_close_matches

# Optional LLM
try:
    from openai import OpenAI

    client = OpenAI(api_key=settings.OPENAI_API_KEY) if getattr(settings, "OPENAI_API_KEY", "") else None
except Exception:
    client = None

_df = None

# Map to normalized column names (after lower + replacing spaces)
SCHEMA = {
    "area": "final_location",                    # locality / micro-market
    "year": "year",                              # year
    "city": "city",                              # city-level filter
    "price": "flat_-_weighted_average_rate",     # per-sqft or avg flat price
    "demand": "total_sold_-_igr",                # total sold units as demand proxy
}


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

    cols = set(df.columns)
    missing = [v for v in SCHEMA.values() if v not in cols]
    if missing:
        raise ValueError(f"Expected columns not found in Excel: {missing}. Got: {sorted(cols)}")

    _df = df
    return _df


# ---------- NLP-ish helpers & fuzzy matching ----------

def extract_year_range(message: str) -> Optional[tuple]:
    # 2010, 2020 etc
    full_years = re.findall(r"\b(19\d{2}|20\d{2})\b", message)
    if not full_years:
        return None
    years_int = sorted(set(int(y) for y in full_years))
    if len(years_int) == 1:
        return (years_int[0], years_int[0])
    return (years_int[0], years_int[-1])


def detect_metric(message: str, default="price") -> str:
    msg = message.lower()
    if "both" in msg or ("price" in msg and "demand" in msg):
        return "both"
    if any(w in msg for w in ["demand", "sales", "interest", "popularity"]):
        return "demand"
    if any(w in msg for w in ["price", "rate", "cost", "value"]):
        return "price"
    return default


def _normalize_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def extract_cities_from_message(message: str) -> List[str]:
    df = get_dataset()
    city_col = SCHEMA["city"]
    cities = df[city_col].dropna().astype(str).unique().tolist()
    msg = _normalize_text(message)
    matched = []
    for city in cities:
        c_norm = _normalize_text(city)
        if c_norm in msg:
            matched.append(city)
    return matched


def extract_areas_from_message(message: str) -> List[str]:
    """
    Robust locality extractor:
    1. Exact phrase match using word boundaries (works for multi-word areas)
    2. Fallback to fuzzy match if no exact match is found
    """

    df = get_dataset()
    areas = (
        df[SCHEMA["area"]]
        .dropna()
        .astype(str)
        .unique()
        .tolist()
    )

    msg = message.lower().strip()

    # -------------------------------
    # 1) Exact regex full-phrase match
    # -------------------------------
    exact_matches = []
    for loc in areas:
        loc_norm = loc.lower().strip()
        pattern = r"\b" + re.escape(loc_norm) + r"\b"
        if re.search(pattern, msg):
            exact_matches.append(loc)

    if exact_matches:
        return exact_matches

    # -------------------------------
    # 2) Fuzzy matching fallback
    # -------------------------------
    tokens = msg.split()
    candidates = set()

    for n in range(1, min(3, len(tokens)) + 1):
        for i in range(len(tokens) - n + 1):
            phrase = " ".join(tokens[i : i + n])
            candidates.add(phrase)

    norm_areas = {a: a.lower() for a in areas}
    norm_list = list(norm_areas.values())

    fuzzy_matches = set()
    for cand in candidates:
        close = get_close_matches(cand.lower(), norm_list, n=3, cutoff=0.8)
        for match in close:
            for orig, norm in norm_areas.items():
                if norm == match:
                    fuzzy_matches.add(orig)

    return list(fuzzy_matches)

# ---------- Data filtering ----------

def filter_data(
    areas: Optional[List[str]] = None,
    year_range: Optional[tuple] = None,
    cities: Optional[List[str]] = None,
) -> pd.DataFrame:
    df = get_dataset()
    area_col = SCHEMA["area"]
    year_col = SCHEMA["year"]
    city_col = SCHEMA["city"]

    # Normalizer
    norm = lambda s: str(s).strip().lower()

    filtered = df.copy()

    # Normalize full dataset
    filtered["_area_norm"] = filtered[area_col].apply(norm)
    filtered["_city_norm"] = filtered[city_col].apply(norm)

    # Normalize filters
    areas_norm = [norm(a) for a in areas] if areas else []
    cities_norm = [norm(c) for c in cities] if cities else []

    # Filter cities
    if cities_norm:
        filtered = filtered[filtered["_city_norm"].isin(cities_norm)]

    # Filter areas (RELAXED — substring allowed)
    if areas_norm:
        mask = False
        for a in areas_norm:
            mask |= filtered["_area_norm"].str.contains(a)
        filtered = filtered[mask]

    # Filter year range
    if year_range:
        start, end = year_range
        filtered = filtered[
            (filtered[year_col] >= start) & (filtered[year_col] <= end)
        ]

    return filtered.drop(columns=["_area_norm", "_city_norm"], errors="ignore")



def build_chart_data(filtered_df: pd.DataFrame, metric: str = "price") -> Dict[str, Any]:
    if filtered_df.empty:
        return {"labels": [], "datasets": []}

    area_col = SCHEMA["area"]
    year_col = SCHEMA["year"]

    metrics = []
    if metric == "both":
        metrics.extend(["price", "demand"])
    else:
        metrics.append(metric)

    labels = sorted(filtered_df[year_col].unique().tolist())
    datasets = []

    grouped = filtered_df.groupby([year_col, area_col])

    for area in filtered_df[area_col].dropna().unique():
        for m in metrics:
            col = SCHEMA.get(m)
            if not col or col not in filtered_df.columns:
                continue
            series = []
            for year in labels:
                try:
                    val = grouped[col].mean().loc[(year, area)]
                except KeyError:
                    val = None
                series.append(float(val) if pd.notna(val) else None)

            label = f"{area} ({m})" if len(metrics) > 1 else str(area)
            datasets.append(
                {"label": label, "metric": m, "data": series}
            )

    return {"labels": labels, "datasets": datasets}


def build_table_data(filtered_df: pd.DataFrame, limit: int = 200) -> list:
    return filtered_df.head(limit).to_dict(orient="records")


# ---------- Analytics: stats, scoring, forecast ----------

def _compute_area_stats(filtered_df: pd.DataFrame) -> Dict[str, Dict[str, Any]]:
    if filtered_df.empty:
        return {}

    area_col = SCHEMA["area"]
    year_col = SCHEMA["year"]
    price_col = SCHEMA["price"]
    demand_col = SCHEMA["demand"]

    stats: Dict[str, Dict[str, Any]] = {}

    for area, group in filtered_df.groupby(area_col):
        group = group.sort_values(year_col)
        years = group[year_col].unique().tolist()
        year_min, year_max = min(years), max(years)

        price_series = group.groupby(year_col)[price_col].mean().sort_index()
        avg_price = float(price_series.mean())
        min_price = float(price_series.min())
        max_price = float(price_series.max())

        # CAGR
        if len(price_series) >= 2:
            p0 = float(price_series.iloc[0])
            pN = float(price_series.iloc[-1])
            n_years = len(price_series) - 1
            if p0 > 0 and n_years > 0:
                cagr = (pN / p0) ** (1.0 / n_years) - 1.0
            else:
                cagr = 0.0
        else:
            cagr = 0.0

        # price volatility
        if len(price_series) >= 3:
            pct_changes = price_series.pct_change().dropna()
            price_volatility = float(pct_changes.std())
        else:
            price_volatility = 0.0

        # demand
        if demand_col and demand_col in group.columns:
            demand_series = group.groupby(year_col)[demand_col].sum().sort_index()
            avg_demand = float(demand_series.mean())
            total_demand = float(demand_series.sum())
            if len(demand_series) >= 2:
                d0 = float(demand_series.iloc[0])
                dN = float(demand_series.iloc[-1])
                if dN > d0 * 1.1:
                    demand_trend = "Rising"
                elif dN < d0 * 0.9:
                    demand_trend = "Falling"
                else:
                    demand_trend = "Stable"
            else:
                demand_trend = "Unknown"
        else:
            avg_demand = None
            total_demand = None
            demand_trend = "Unknown"

        # simple forecast
        forecast_next = None
        if len(price_series) >= 2:
            xs = np.array(price_series.index, dtype=float)
            ys = np.array(price_series.values, dtype=float)
            try:
                m, b = np.polyfit(xs, ys, 1)
                next_year = year_max + 1
                forecast_next = float(m * next_year + b)
            except Exception:
                forecast_next = None

        stats[area] = {
            "year_start": int(year_min),
            "year_end": int(year_max),
            "avg_price": avg_price,
            "min_price": min_price,
            "max_price": max_price,
            "price_cagr": float(cagr),
            "price_volatility": price_volatility,
            "avg_demand": avg_demand,
            "total_demand": total_demand,
            "demand_trend": demand_trend,
            "price_forecast_next_year": forecast_next,
        }

    return stats


def build_insights(filtered_df: pd.DataFrame, year_range, metric: str) -> Dict[str, Any]:
    base_stats = _compute_area_stats(filtered_df)
    if not base_stats:
        return {"areas": {}, "ranked_areas": [], "year_range": year_range, "metric": metric}

    max_avg_demand = max((s["avg_demand"] or 0.0) for s in base_stats.values()) or 1.0
    max_volatility = max((s["price_volatility"] or 0.0) for s in base_stats.values()) or 1.0

    ranked = []

    for area, s in base_stats.items():
        cagr = s["price_cagr"]
        avg_demand = s["avg_demand"] or 0.0
        vol = s["price_volatility"] or 0.0

        growth_score = (cagr + 0.05) / 0.20 * 10.0
        growth_score = max(0.0, min(10.0, growth_score))

        demand_score = (avg_demand / max_avg_demand) * 10.0
        demand_score = max(0.0, min(10.0, demand_score))

        risk_raw = (vol / max_volatility) * 10.0
        risk_raw = max(0.0, min(10.0, risk_raw))
        risk_score = 10.0 - risk_raw

        investment_score = 0.4 * growth_score + 0.4 * demand_score + 0.2 * risk_score

        s["growth_score"] = growth_score
        s["demand_score"] = demand_score
        s["risk_score"] = risk_score
        s["investment_score"] = investment_score

        ranked.append({"area": area, "investment_score": round(investment_score, 1)})

    ranked.sort(key=lambda x: x["investment_score"], reverse=True)

    return {
        "areas": base_stats,
        "ranked_areas": ranked,
        "year_range": year_range,
        "metric": metric,
    }


# ---------- Summaries ----------

def build_basic_summary(filtered_df: pd.DataFrame, areas, cities, year_range, metric: str) -> str:
    if filtered_df.empty:
        return "I couldn’t find matching data for your query. Try another locality, city, or year range."

    area_col = SCHEMA["area"]
    year_col = SCHEMA["year"]
    price_col = SCHEMA["price"]
    demand_col = SCHEMA["demand"]

    years = sorted(filtered_df[year_col].unique().tolist())
    parts = []

    label_parts = []
    if areas:
        label_parts.append(", ".join(areas))
    if cities:
        label_parts.append(" in " + ", ".join(cities))
    if not label_parts:
        label_parts.append("the selected dataset")

    parts.append(f"Here’s the market analysis for {''.join(label_parts)}.")
    parts.append(f"Data is available from {years[0]} to {years[-1]}.")

    if price_col and metric in ("price", "both"):
        price_min = float(filtered_df[price_col].min())
        price_max = float(filtered_df[price_col].max())
        parts.append(
            f"Average flat prices range approximately between ₹{price_min:,.0f} and ₹{price_max:,.0f}."
        )

    if demand_col and metric in ("demand", "both"):
        demand_min = float(filtered_df[demand_col].min())
        demand_max = float(filtered_df[demand_col].max())
        parts.append(
            f"Annual sales (IGR) vary between {demand_min:,.0f} and {demand_max:,.0f} units."
        )

    if price_col and metric in ("price", "both"):
        first_year = years[0]
        last_year = years[-1]
        first_avg = filtered_df[filtered_df[year_col] == first_year][price_col].mean()
        last_avg = filtered_df[filtered_df[year_col] == last_year][price_col].mean()
        if last_avg > first_avg * 1.05:
            parts.append(
                f"Overall, prices show an upward trend from {first_year} to {last_year}."
            )
        elif last_avg < first_avg * 0.95:
            parts.append(
                f"Prices appear to have softened between {first_year} and {last_year}."
            )
        else:
            parts.append("Prices look relatively stable over the observed period.")

    return " ".join(parts)


def build_llm_summary(filtered_df, areas, cities, year_range, metric: str) -> str:
    basic = build_basic_summary(filtered_df, areas, cities, year_range, metric)

    if client is None or filtered_df.empty:
        return basic

    year_col = SCHEMA["year"]

    stats = {
        "areas": areas,
        "cities": cities,
        "year_range": year_range,
        "row_count": int(len(filtered_df)),
        "years": sorted(filtered_df[year_col].unique().tolist()),
    }

    prompt = (
        "You are a friendly real-estate market analyst. "
        "Rewrite the following technical summary into a clear, concise explanation for a home buyer or investor:\n\n"
        f"Summary: {basic}\n\n"
        f"Context statistics: {stats}\n\n"
        "Keep it under 150 words, and mention price and demand trends, and which localities look relatively stronger."
    )

    try:
        resp = client.responses.create(
            model="gpt-4.1-mini",
            input=prompt,
        )
        return resp.output[0].content[0].text
    except Exception:
        return basic
