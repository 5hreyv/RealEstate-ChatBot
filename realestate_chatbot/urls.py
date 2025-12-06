from django.http import JsonResponse

def home(request):
    return JsonResponse({"status": "Backend running", "api_base": "/api/"})

urlpatterns = [
    path("", home),
    path("admin/", admin.site.urls),
    path("api/", include("api.urls")),
]
