"""
Client for the ReallySimpleSocial (RSS) SMM panel API.
API docs: https://reallysimplesocial.com/api/v2
All requests are POST with JSON responses.
"""
import time
import requests
from django.conf import settings


class RSSAPIError(Exception):
    """Raised when the RSS API returns an error or is unreachable."""
    pass


def _log_call(action, request_data, response_data, http_status, success, error_message, duration_ms, triggered_by=''):
    """Write an APICallLog record. Swallows any DB errors to avoid breaking callers."""
    try:
        from .models import APICallLog
        APICallLog.objects.create(
            provider='rss',
            action=action,
            endpoint='https://reallysimplesocial.com/api/v2',
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


class RSSClient:
    BASE_URL = 'https://reallysimplesocial.com/api/v2'

    def __init__(self, triggered_by=''):
        from core.models import PlatformSettings
        self.api_key = PlatformSettings.get_api_key('rss_api_key', 'REAL_SIMPLE_SOCIAL_API_KEY')
        self._triggered_by = triggered_by
        if not self.api_key:
            raise RSSAPIError('RSS API key is not configured.')

    def _post(self, data: dict):
        action = data.get('action', 'unknown')
        # Strip API key from logged payload
        log_data = {k: v for k, v in data.items() if k != 'key'}
        data['key'] = self.api_key

        start = time.monotonic()
        http_status = None
        try:
            resp = requests.post(self.BASE_URL, data=data, timeout=30)
            http_status = resp.status_code
            duration_ms = int((time.monotonic() - start) * 1000)
            resp.raise_for_status()
            result = resp.json()
            # RSS API returns {"error": "..."} on some failures
            if isinstance(result, dict) and 'error' in result:
                _log_call(action, log_data, result, http_status, False, result['error'], duration_ms, self._triggered_by)
                raise RSSAPIError(result['error'])
            _log_call(action, log_data, result if not isinstance(result, list) else {'count': len(result)},
                      http_status, True, '', duration_ms, self._triggered_by)
            return result
        except RSSAPIError:
            raise
        except requests.exceptions.Timeout:
            duration_ms = int((time.monotonic() - start) * 1000)
            _log_call(action, log_data, None, http_status, False, 'Request timed out.', duration_ms, self._triggered_by)
            raise RSSAPIError('RSS API request timed out.')
        except requests.exceptions.ConnectionError:
            duration_ms = int((time.monotonic() - start) * 1000)
            _log_call(action, log_data, None, http_status, False, 'Connection error.', duration_ms, self._triggered_by)
            raise RSSAPIError('Could not connect to RSS API.')
        except requests.exceptions.RequestException as e:
            duration_ms = int((time.monotonic() - start) * 1000)
            _log_call(action, log_data, None, http_status, False, str(e), duration_ms, self._triggered_by)
            raise RSSAPIError(f'RSS API request failed: {str(e)}')
        except ValueError:
            duration_ms = int((time.monotonic() - start) * 1000)
            _log_call(action, log_data, None, http_status, False, 'Invalid JSON response.', duration_ms, self._triggered_by)
            raise RSSAPIError('RSS API returned invalid response.')

    def get_services(self) -> list:
        """Fetch all available services."""
        return self._post({'action': 'services'})

    def place_order(self, service_id: int, link: str, quantity: int) -> dict:
        """Place an order. Returns {'order': <external_id>}."""
        return self._post({
            'action': 'add',
            'service': service_id,
            'link': link,
            'quantity': quantity,
        })

    def check_status(self, order_id: int) -> dict:
        """Check single order status."""
        return self._post({
            'action': 'status',
            'order': order_id,
        })

    def check_balance(self) -> dict:
        """Check API account balance. Returns {'balance': '...', 'currency': 'USD'}."""
        return self._post({'action': 'balance'})
