from django.urls import path
from . import views  # <-- REQUIRED

urlpatterns = [
    path("query/", views.query_api),
    path("download_csv/", views.download_csv),
    path("report_pdf/", views.report_pdf),
    path("localities/", views.list_localities),
]
