import requests
import hashlib
import hmac
from django.conf import settings

PAYSTACK_BASE_URL = 'https://api.paystack.co'


def _secret_key():
    from core.models import PlatformSettings
    return PlatformSettings.get_api_key('paystack_secret_key', 'PAYSTACK_SECRET_KEY')


def initialize_payment(email, amount_naira, reference, callback_url):
    """
    Start a Paystack payment session.
    amount_naira: amount in Naira (we convert to kobo for Paystack)
    """
    url = f"{PAYSTACK_BASE_URL}/transaction/initialize"
    headers = {
        'Authorization': f'Bearer {_secret_key()}',
        'Content-Type': 'application/json',
    }
    # Paystack works in kobo (100 kobo = 1 Naira)
    amount_kobo = int(float(amount_naira) * 100)
    payload = {
        'email': email,
        'amount': amount_kobo,
        'reference': reference,
        'callback_url': callback_url,
        'currency': 'NGN',
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        return response.json()
    except requests.exceptions.RequestException as e:
        return {'status': False, 'message': str(e)}


def verify_payment(reference):
    """
    Verify a payment using its reference.
    Always call this before crediting the wallet.
    """
    url = f"{PAYSTACK_BASE_URL}/transaction/verify/{reference}"
    headers = {
        'Authorization': f'Bearer {_secret_key()}',
    }
    try:
        response = requests.get(url, headers=headers, timeout=30)
        return response.json()
    except requests.exceptions.RequestException as e:
        return {'status': False, 'message': str(e)}


def verify_webhook_signature(payload_body, signature):
    """
    Confirm that the webhook actually came from Paystack
    and not from a hacker trying to fake a payment.
    """
    computed = hmac.new(
        _secret_key().encode('utf-8'),
        payload_body,
        digestmod=hashlib.sha512
    ).hexdigest()
    return hmac.compare_digest(computed, signature)
