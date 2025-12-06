import json
import textwrap
from io import BytesIO
from . import views
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

from .utils import (
    extract_areas_from_message,
    extract_cities_from_message,
    extract_year_range,
    detect_metric,
    filter_data,
    build_chart_data,
    build_table_data,
    build_insights,
    build_llm_summary,
)


@csrf_exempt
def query_view(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    try:
        body = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    message = body.get("message", "") or ""
    metric = body.get("metric") or detect_metric(message)

    areas = extract_areas_from_message(message)
    cities = extract_cities_from_message(message)
    year_range = extract_year_range(message)

    filtered_df = filter_data(
        areas=areas or None,
        year_range=year_range,
        cities=cities or None,
    )
    # If user requested localities not present in dataset → FAIL CLEANLY
if filtered_df is None or filtered_df.empty:
    return JsonResponse({
        "summary": f"No data found for {areas or cities}. "
                   f"Try one of these instead: {get_dataset()['final_location'].unique().tolist()[:10]}",
        "chart": {"labels": [], "datasets": []},
        "table": [],
        "areas": areas,
        "cities": cities,
        "metric": metric,
        "year_range": year_range,
        "insights": {},
    })

    chart = build_chart_data(filtered_df, metric=metric)
    table = build_table_data(filtered_df)
    insights = build_insights(filtered_df, year_range, metric)
    summary = build_llm_summary(filtered_df, areas, cities, year_range, metric)

    return JsonResponse(
        {
            "summary": summary,
            "chart": chart,
            "table": table,
            "areas": areas,
            "cities": cities,
            "metric": metric,
            "year_range": year_range,
            "insights": insights,
        }
    )


def download_csv_view(request):
    areas_param = request.GET.get("areas", "")
    areas = [a.strip() for a in areas_param.split(",") if a.strip()]

    cities_param = request.GET.get("cities", "")
    cities = [c.strip() for c in cities_param.split(",") if c.strip()]

    start_year = request.GET.get("start_year")
    end_year = request.GET.get("end_year")
    year_range = None
    if start_year and end_year:
        try:
            year_range = (int(start_year), int(end_year))
        except ValueError:
            year_range = None

    filtered_df = filter_data(
        areas=areas or None,
        year_range=year_range,
        cities=cities or None,
    )

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="filtered_data.csv"'
    filtered_df.to_csv(response, index=False)
    return response


def download_report_view(request):
    areas_param = request.GET.get("areas", "")
    areas = [a.strip() for a in areas_param.split(",") if a.strip()]

    cities_param = request.GET.get("cities", "")
    cities = [c.strip() for c in cities_param.split(",") if c.strip()]

    start_year = request.GET.get("start_year")
    end_year = request.GET.get("end_year")
    metric = request.GET.get("metric", "price")

    year_range = None    # noqa
    if start_year and end_year:
        try:
            year_range = (int(start_year), int(end_year))
        except ValueError:
            year_range = None

    filtered_df = filter_data(
        areas=areas or None,
        year_range=year_range,
        cities=cities or None,
    )
    insights = build_insights(filtered_df, year_range, metric)
    summary = build_llm_summary(filtered_df, areas, cities, year_range, metric)

    buffer = BytesIO()
    p = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 40

    p.setFont("Helvetica-Bold", 16)
    p.drawString(40, y, "Real Estate Analysis Report")
    y -= 24

    p.setFont("Helvetica", 10)
    label_parts = []
    if areas:
        label_parts.append(", ".join(areas))
    if cities:
        label_parts.append(" in " + ", ".join(cities))
    areas_label = "".join(label_parts) or "All data"

    p.drawString(40, y, f"Scope: {areas_label}")
    y -= 14

    if year_range:
        p.drawString(40, y, f"Years: {year_range[0]} – {year_range[1]}")
        y -= 18

    p.setFont("Helvetica-Bold", 11)
    p.drawString(40, y, "Summary")
    y -= 16
    p.setFont("Helvetica", 10)

    for line in textwrap.wrap(summary, width=90):
        if y < 60:
            p.showPage()
            y = height - 40
            p.setFont("Helvetica", 10)
        p.drawString(40, y, line)
        y -= 14

    if insights["areas"]:
        if y < 80:
            p.showPage()
            y = height - 40
        p.setFont("Helvetica-Bold", 11)
        p.drawString(40, y, "Locality Insights")
        y -= 18
        p.setFont("Helvetica", 10)

        for area, s in insights["areas"].items():
            if y < 80:
                p.showPage()
                y = height - 40
                p.setFont("Helvetica", 10)

            p.setFont("Helvetica-Bold", 10)
            p.drawString(40, y, f"- {area}")
            y -= 14
            p.setFont("Helvetica", 10)

            lines = [
                f"Period: {s['year_start']} – {s['year_end']}",
                f"Avg price: ₹{s['avg_price']:,.0f} | CAGR: {s['price_cagr']*100:.1f}%",
                f"Demand trend: {s['demand_trend']} | Total demand: {s['total_demand']:,.0f}",
                f"Investment score: {s['investment_score']:.1f}/10",
            ]
            if s.get("price_forecast_next_year") is not None:
                lines.append(
                    f"Next year estimated price: ₹{s['price_forecast_next_year']:,.0f}"
                )

            for line in lines:
                if y < 60:
                    p.showPage()
                    y = height - 40
                    p.setFont("Helvetica", 10)
                p.drawString(55, y, line)
                y -= 12

    p.showPage()
    p.save()
    buffer.seek(0)

    response = HttpResponse(buffer, content_type="application/pdf")
    response["Content-Disposition"] = 'attachment; filename=\"real_estate_report.pdf\"'
    return response

@csrf_exempt
def list_localities(request):
    from .utils import get_dataset
    df = get_dataset()
    locs = sorted(df["final_location"].dropna().unique().tolist())
    return JsonResponse({"localities": locs})
