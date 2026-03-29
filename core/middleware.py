from django.http import JsonResponse
from django.core.cache import cache
import re


def get_client_ip(request):
    """Extract real client IP, respecting common proxy headers."""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        return x_forwarded_for.split(',')[0].strip()
    return request.META.get('HTTP_X_REAL_IP') or request.META.get('REMOTE_ADDR', '')


def log_ip_action(request, action, user=None):
    """Record an IP log entry. Fire-and-forget — never raises.

    Uses a 10-second cache lock to prevent duplicate entries from
    being created if the same IP+action is triggered more than once
    within a single request cycle (e.g. DRF session auth processing).
    """
    try:
        from core.models import IPLog
        ip = get_client_ip(request)
        dedup_key = f'iplog_dedup:{ip}:{action}'
        if cache.get(dedup_key):
            return
        cache.set(dedup_key, True, 10)
        ua = request.META.get('HTTP_USER_AGENT', '')[:300]
        IPLog.objects.create(ip_address=ip, user=user, action=action, user_agent=ua)
    except Exception:
        pass


class RateLimitMiddleware:
    """
    Sliding fixed-window rate limiter backed by Redis (via Django cache).

    Rules are matched top-to-bottom; the first match applies.
    key_type='ip'   → keyed by client IP (public / unauthenticated endpoints)
    key_type='user' → keyed by user PK when authenticated, falls back to IP
    """

    # (url_prefix, http_method_or_None, max_requests, window_seconds, key_type)
    LIMITS = [
        # ── Auth  (brute-force / spam protection) ──────────────────────
        ('/api/auth/login/',                'POST', 10,  60,   'ip'),   # 10 attempts/min
        ('/api/auth/register/',             'POST', 5,   60,   'ip'),   # 5 signups/min
        ('/api/auth/forgot-password/',      'POST', 5,   3600, 'ip'),   # 5 resets/hour
        ('/api/auth/reset-password/',       'POST', 5,   60,   'ip'),   # 5 resets/min
        ('/api/auth/2fa/verify/',           'POST', 10,  60,   'ip'),   # 10 TOTP attempts/min
        ('/api/auth/resend-verification/',  'POST', 3,   3600, 'ip'),   # 3 emails/hour
        # ── Order placement (user-keyed to avoid penalising shared IPs) ─
        ('/api/boosting/order/',            'POST', 20,  60,   'user'), # 20 orders/min
        ('/api/accounts/order/',            'POST', 10,  60,   'user'), # 10 orders/min
        ('/api/numbers/order/',             'POST', 20,  60,   'user'), # 20 orders/min
        ('/api/orders/gift/',               'POST', 10,  60,   'user'), # 10 orders/min
        # ── Wallet ───────────────────────────────────────────────────────
        ('/api/wallet/deposit/',            'POST', 10,  60,   'user'), # 10 deposits/min
        # ── Global API fallback (catches everything else) ─────────────
        ('/api/',                           None,   300, 60,   'ip'),   # 300 req/min
    ]

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        path = request.path

        for (prefix, method, limit, window, key_type) in self.LIMITS:
            if not path.startswith(prefix):
                continue
            if method and method != request.method:
                continue

            # Determine identifier
            if key_type == 'user' and getattr(request, 'user', None) and request.user.is_authenticated:
                identifier = f'u{request.user.pk}'
            else:
                identifier = f'ip_{get_client_ip(request)}'

            cache_key = f'rl:{re.sub(r"[^a-z0-9]", "_", prefix)}:{identifier}'

            try:
                # Atomic increment; set expiry only on first hit
                count = cache.get(cache_key)
                if count is None:
                    cache.set(cache_key, 1, window)
                    count = 1
                else:
                    count = cache.incr(cache_key)

                if count > limit:
                    return JsonResponse(
                        {'detail': 'Too many requests. Please slow down and try again shortly.'},
                        status=429,
                    )
            except Exception:
                pass  # Fail open — never block users because Redis hiccupped

            break  # First matching rule wins

        return self.get_response(request)


class IPBanMiddleware:
    """Block requests from banned IPs with a 403. Uses a short cache to avoid per-request DB hits."""

    CACHE_TTL = 300  # 5 minutes

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        ip = get_client_ip(request)
        if ip and self._is_banned(ip):
            return JsonResponse(
                {'detail': 'Access denied. Your IP has been blocked.'},
                status=403,
            )
        return self.get_response(request)

    def _is_banned(self, ip):
        cache_key = f'banned_ip:{ip}'
        cached = cache.get(cache_key)
        if cached is not None:
            return cached
        try:
            from core.models import BannedIP
            result = BannedIP.objects.filter(ip_address=ip).exists()
        except Exception:
            result = False
        cache.set(cache_key, result, self.CACHE_TTL)
        return result
