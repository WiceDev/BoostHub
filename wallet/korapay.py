import requests
import hashlib
import hmac
import json
from django.conf import settings

KORAPAY_BASE_URL = 'https://api.korapay.com/merchant/api/v1'


def _secret_key():
    from core.models import PlatformSettings
    return PlatformSettings.get_api_key('korapay_secret_key', 'KORAPAY_SECRET_KEY')


def _public_key():
    from core.models import PlatformSettings
    return PlatformSettings.get_api_key('korapay_public_key', 'KORAPAY_PUBLIC_KEY')


def _headers():
    return {
        'Authorization': f'Bearer {_secret_key()}',
        'Content-Type': 'application/json',
    }


def initialize_checkout(reference, amount_naira, customer_email, customer_name, redirect_url, notification_url=None):
    """
    Initialize a Korapay checkout session.
    Returns the checkout_url the customer should be redirected to.
    Korapay amounts are in the currency's base unit (Naira, not kobo).
    """
    url = f"{KORAPAY_BASE_URL}/charges/initialize"
    payload = {
        'reference': reference,
        'amount': float(amount_naira),
        'currency': 'NGN',
        'customer': {
            'email': customer_email,
            'name': customer_name,
        },
        'redirect_url': redirect_url,
        'channels': ['card', 'bank_transfer', 'pay_with_bank'],
        'default_channel': 'card',
    }
    if notification_url:
        payload['notification_url'] = notification_url

    try:
        response = requests.post(url, json=payload, headers=_headers(), timeout=30)
        data = response.json()
        return data
    except requests.exceptions.RequestException as e:
        return {'status': False, 'message': str(e)}


def verify_charge(reference):
    """
    Verify a charge/payment status using its reference.
    Always call this before crediting the wallet.
    """
    url = f"{KORAPAY_BASE_URL}/charges/{reference}"
    try:
        response = requests.get(url, headers=_headers(), timeout=30)
        return response.json()
    except requests.exceptions.RequestException as e:
        return {'status': False, 'message': str(e)}


def verify_webhook_signature(payload_body, signature):
    """
    Confirm that the webhook came from Korapay.
    Korapay signs the `data` object of the webhook payload using
    HMAC SHA256 with the merchant's secret key.
    The signature is sent in the x-korapay-signature header.
    """
    try:
        payload = json.loads(payload_body)
        data_str = json.dumps(payload.get('data', {}), separators=(',', ':'), sort_keys=True)
    except (json.JSONDecodeError, TypeError):
        return False

    computed = hmac.new(
        _secret_key().encode('utf-8'),
        data_str.encode('utf-8'),
        digestmod=hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(computed, signature)
