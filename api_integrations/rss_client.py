"""
Client for the ReallySimpleSocial (RSS) SMM panel API.
API docs: https://reallysimplesocial.com/api/v2
All requests are POST with JSON responses.
"""
import requests
from django.conf import settings


class RSSAPIError(Exception):
    """Raised when the RSS API returns an error or is unreachable."""
    pass


class RSSClient:
    BASE_URL = 'https://reallysimplesocial.com/api/v2'

    def __init__(self):
        from core.models import PlatformSettings
        self.api_key = PlatformSettings.get_api_key('rss_api_key', 'REAL_SIMPLE_SOCIAL_API_KEY')
        if not self.api_key:
            raise RSSAPIError('RSS API key is not configured.')

    def _post(self, data: dict):
        data['key'] = self.api_key
        try:
            resp = requests.post(self.BASE_URL, data=data, timeout=30)
            resp.raise_for_status()
            result = resp.json()
            # RSS API returns {"error": "..."} on some failures
            if isinstance(result, dict) and 'error' in result:
                raise RSSAPIError(result['error'])
            return result
        except requests.exceptions.Timeout:
            raise RSSAPIError('RSS API request timed out.')
        except requests.exceptions.ConnectionError:
            raise RSSAPIError('Could not connect to RSS API.')
        except requests.exceptions.RequestException as e:
            raise RSSAPIError(f'RSS API request failed: {str(e)}')
        except ValueError:
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
