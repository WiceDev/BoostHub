from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse, FileResponse
from wallet.views import paystack_webhook


def serve_spa(request):
    """Serve the React SPA index.html directly, bypassing the Django template engine."""
    index_path = settings.BASE_DIR / 'frontend' / 'dist' / 'index.html'
    return FileResponse(open(index_path, 'rb'), content_type='text/html')


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.api_urls')),
    # Paystack calls this URL directly — do not change without updating Paystack dashboard
    path('wallet/webhook/paystack/', paystack_webhook, name='paystack_webhook'),
    # Catch-all: serve React SPA for all other routes
    re_path(r'^(?!static/|media/|admin/|api/|wallet/webhook/).*$', serve_spa),
]
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
