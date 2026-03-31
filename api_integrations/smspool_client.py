"""
Client for the SMSPool API.
API docs: https://api.smspool.net
All requests are POST with form-data.
"""
import time
import requests
from django.conf import settings


class SMSPoolAPIError(Exception):
    """Raised when the SMSPool API returns an error or is unreachable."""
    pass


def _log_call(action, endpoint, request_data, response_data, http_status, success, error_message, duration_ms, triggered_by=''):
    try:
        from .models import APICallLog
        APICallLog.objects.create(
            provider='smspool',
            action=action,
            endpoint=f'https://api.smspool.net{endpoint}',
            request_data=request_data,
            response_data=response_data,
            http_status=http_status,
            success=success,
            error_message=error_message or '',
            duration_ms=duration_ms,
            triggered_by=triggered_by,
        )
    except Exception:
        pass


class SMSPoolClient:
    BASE_URL = 'https://api.smspool.net'

    def __init__(self, triggered_by=''):
        from core.models import PlatformSettings
        self.api_key = PlatformSettings.get_api_key('smspool_api_key', 'SMS_POOL_API_KEY')
        self._triggered_by = triggered_by
        if not self.api_key:
            raise SMSPoolAPIError('SMSPool API key is not configured.')

    def _post(self, endpoint: str, data: dict = None, auth_required=True):
        payload = data or {}
        # Strip API key from logged payload
        log_data = {k: v for k, v in payload.items() if k != 'key'}
        action = endpoint.strip('/').replace('/', ':')
        if auth_required:
            payload['key'] = self.api_key

        start = time.monotonic()
        http_status = None
        try:
            resp = requests.post(f'{self.BASE_URL}{endpoint}', data=payload, timeout=30)
            http_status = resp.status_code
            duration_ms = int((time.monotonic() - start) * 1000)
            resp.raise_for_status()
            result = resp.json()
            # SMSPool returns {"success": 0, "message": "..."} on failure
            if isinstance(result, dict) and result.get('success') == 0:
                err = result.get('message', 'SMSPool request failed.')
                _log_call(action, endpoint, log_data, result, http_status, False, err, duration_ms, self._triggered_by)
                raise SMSPoolAPIError(err)
            _log_call(action, endpoint, log_data,
                      result if not isinstance(result, list) else {'count': len(result)},
                      http_status, True, '', duration_ms, self._triggered_by)
            return result
        except SMSPoolAPIError:
            raise
        except requests.exceptions.Timeout:
            duration_ms = int((time.monotonic() - start) * 1000)
            _log_call(action, endpoint, log_data, None, http_status, False, 'Request timed out.', duration_ms, self._triggered_by)
            raise SMSPoolAPIError('SMSPool API request timed out.')
        except requests.exceptions.ConnectionError:
            duration_ms = int((time.monotonic() - start) * 1000)
            _log_call(action, endpoint, log_data, None, http_status, False, 'Connection error.', duration_ms, self._triggered_by)
            raise SMSPoolAPIError('Could not connect to SMSPool API.')
        except requests.exceptions.RequestException as e:
            duration_ms = int((time.monotonic() - start) * 1000)
            _log_call(action, endpoint, log_data, None, http_status, False, str(e), duration_ms, self._triggered_by)
            raise SMSPoolAPIError(f'SMSPool API request failed: {str(e)}')
        except ValueError:
            duration_ms = int((time.monotonic() - start) * 1000)
            _log_call(action, endpoint, log_data, None, http_status, False, 'Invalid JSON response.', duration_ms, self._triggered_by)
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
