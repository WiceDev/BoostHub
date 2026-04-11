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


def serve_sitemap(request):
    """Generate a dynamic XML sitemap for public pages."""
    from django.utils import timezone
    base = getattr(settings, 'FRONTEND_URL', 'https://www.priveboost.com').rstrip('/')
    today = timezone.now().strftime('%Y-%m-%d')

    # Static public pages: (path, priority, changefreq)
    pages = [
        ('/',                1.0,  'weekly'),
        ('/services',        0.9,  'weekly'),
        ('/web-development', 0.8,  'monthly'),
        ('/login',           0.5,  'monthly'),
        ('/signup',          0.6,  'monthly'),
        ('/legal',           0.3,  'yearly'),
    ]

    urls = []
    for path_str, priority, freq in pages:
        urls.append(
            f'  <url>\n'
            f'    <loc>{base}{path_str}</loc>\n'
            f'    <lastmod>{today}</lastmod>\n'
            f'    <changefreq>{freq}</changefreq>\n'
            f'    <priority>{priority}</priority>\n'
            f'  </url>'
        )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + '\n'.join(urls) + '\n'
        '</urlset>\n'
    )
    return HttpResponse(xml, content_type='application/xml')


urlpatterns = [
    path('robots.txt', serve_robots),
    path('sitemap.xml', serve_sitemap),
    path('admin/', admin.site.urls),
    path('api/', include('core.api_urls')),
    # Serve social media icons
    re_path(r'^icons/(?P<path>.*)$', static_serve, {'document_root': settings.BASE_DIR / 'icons'}),
    # Korapay calls this URL directly — set this in Korapay dashboard webhook config
    path('wallet/webhook/korapay/', korapay_webhook, name='korapay_webhook'),
    # Catch-all: serve React SPA for all other routes
    re_path(r'^(?!static/|icons/|media/|admin/|api/|wallet/webhook/|sitemap\.xml).*$', serve_spa),
]
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
