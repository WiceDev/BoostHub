from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse, FileResponse
from django.views.static import serve as static_serve
from wallet.views import korapay_webhook


def serve_spa(request):
    """Serve the React SPA index.html directly, bypassing the Django template engine."""
    import traceback
    try:
        index_path = settings.BASE_DIR / 'frontend' / 'dist' / 'index.html'
        return FileResponse(open(index_path, 'rb'), content_type='text/html')
    except Exception:
        return HttpResponse(f'<pre>{traceback.format_exc()}</pre>', status=500)


def serve_robots(request):
    robots_path = settings.BASE_DIR / 'frontend' / 'dist' / 'robots.txt'
    if robots_path.exists():
        return FileResponse(open(robots_path, 'rb'), content_type='text/plain')
    return HttpResponse("User-agent: *\nAllow: /\n", content_type='text/plain')


urlpatterns = [
    path('robots.txt', serve_robots),
    path('admin/', admin.site.urls),
    path('api/', include('core.api_urls')),
    # Serve social media icons
    re_path(r'^icons/(?P<path>.*)$', static_serve, {'document_root': settings.BASE_DIR / 'icons'}),
    # Korapay calls this URL directly — set this in Korapay dashboard webhook config
    path('wallet/webhook/korapay/', korapay_webhook, name='korapay_webhook'),
    # Catch-all: serve React SPA for all other routes
    re_path(r'^(?!static/|icons/|media/|admin/|api/|wallet/webhook/).*$', serve_spa),
]
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
