from django.urls import path
from . import views

urlpatterns = [
    path("query/", views.query_view, name="query"),                 # ✅ correct
    path("download_csv/", views.download_csv_view, name="csv"),     # ✅ correct
    path("report_pdf/", views.download_report_view, name="report"), # ✅ correct
    path("localities/", views.list_localities, name="localities"),  # ✅ correct
]
