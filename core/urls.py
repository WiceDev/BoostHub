from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.generic import TemplateView
from wallet.views import paystack_webhook

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('core.api_urls')),
    # Paystack calls this URL directly — do not change without updating Paystack dashboard
    path('wallet/webhook/paystack/', paystack_webhook, name='paystack_webhook'),
    # Catch-all: serve React SPA for all other routes
    re_path(r'^(?!static/|media/|admin/|api/|wallet/webhook/).*$',
            TemplateView.as_view(template_name='index.html')),
]
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
