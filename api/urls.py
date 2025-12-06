from django.urls import path
from . import views

urlpatterns = [
    path("query/", views.query_view),
    path("download_csv/", views.download_csv_view),
    path("report_pdf/", views.download_report_view),
    path("localities/", views.list_localities),
]
