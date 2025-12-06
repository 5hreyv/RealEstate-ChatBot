from django.urls import path
from .views import query_view, download_csv_view, download_report_view

urlpatterns = [
    path("query/", query_view, name="query"),
    path("download_csv/", download_csv_view, name="download_csv"),
    path("report_pdf/", download_report_view, name="report_pdf"),
    path("localities/", views.list_localities),

]
