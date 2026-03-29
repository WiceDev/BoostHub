from django.urls import path

app_name = 'wallet'

# Legacy template routes removed — wallet API is at /api/wallet/.
# Paystack webhook is registered directly in core/urls.py.
urlpatterns = []
