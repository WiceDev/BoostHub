"""
Client for the SMSPool API.
API docs: https://api.smspool.net
All requests are POST with form-data.
"""
import requests
from django.conf import settings


class SMSPoolAPIError(Exception):
    """Raised when the SMSPool API returns an error or is unreachable."""
    pass


class SMSPoolClient:
    BASE_URL = 'https://api.smspool.net'

    def __init__(self):
        from core.models import PlatformSettings
        self.api_key = PlatformSettings.get_api_key('smspool_api_key', 'SMS_POOL_API_KEY')
        if not self.api_key:
            raise SMSPoolAPIError('SMSPool API key is not configured.')

    def _post(self, endpoint: str, data: dict = None, auth_required=True):
        payload = data or {}
        if auth_required:
            payload['key'] = self.api_key
        try:
            resp = requests.post(f'{self.BASE_URL}{endpoint}', data=payload, timeout=30)
            resp.raise_for_status()
            result = resp.json()
            # SMSPool returns {"success": 0, "message": "..."} on failure
            if isinstance(result, dict) and result.get('success') == 0:
                raise SMSPoolAPIError(result.get('message', 'SMSPool request failed.'))
            return result
        except requests.exceptions.Timeout:
            raise SMSPoolAPIError('SMSPool API request timed out.')
        except requests.exceptions.ConnectionError:
            raise SMSPoolAPIError('Could not connect to SMSPool API.')
        except requests.exceptions.RequestException as e:
            raise SMSPoolAPIError(f'SMSPool API request failed: {str(e)}')
        except ValueError:
            raise SMSPoolAPIError('SMSPool API returned invalid response.')

    def get_countries(self) -> list:
        """Fetch all available countries. No auth required."""
        return self._post('/country/retrieve_all', auth_required=False)

    def get_services(self) -> list:
        """Fetch all available services. No auth required."""
        return self._post('/service/retrieve_all', auth_required=False)

    def get_price(self, country: str, service: str) -> dict:
        """Get price for a country+service combo. Returns {price, success_rate, ...}."""
        return self._post('/request/price', {
            'country': country,
            'service': service,
        }, auth_required=False)

    def purchase_sms(self, country: str, service: str) -> dict:
        """Purchase an SMS number. Returns {success, number, order_id, country, ...}."""
        return self._post('/purchase/sms', {
            'country': country,
            'service': service,
        })

    def check_sms(self, order_id) -> dict:
        """Check SMS order status. Returns {status, sms, full_code, ...}."""
        return self._post('/sms/check', {'orderid': order_id})

    def cancel_sms(self, order_id) -> dict:
        """Cancel an SMS order. Returns {success: 1} on success."""
        return self._post('/sms/cancel', {'orderid': order_id})

    def get_balance(self) -> dict:
        """Check API account balance. Returns {balance: '...'}."""
        return self._post('/request/balance')
