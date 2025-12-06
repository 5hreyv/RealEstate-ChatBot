from django.urls import path
from .views import query_view, download_csv_view, download_report_view, list_localities

urlpatterns = [
    path("query/", query_view),
    path("download_csv/", download_csv_view),
    path("report_pdf/", download_report_view),
    path("localities/", list_localities),
]
