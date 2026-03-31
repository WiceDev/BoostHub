from decimal import Decimal, ROUND_UP
from django.core.cache import cache
from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response

from orders.models import Order
from orders.serializers import OrderSerializer
from orders.services import create_order
from core.models import PlatformSettings
from .rss_client import RSSClient, RSSAPIError


def detect_platform(name: str) -> str:
    """Guess platform from service name."""
    lower = name.lower()
    for platform in ['Instagram', 'TikTok', 'Twitter', 'YouTube', 'Facebook',
                     'Telegram', 'Spotify', 'LinkedIn', 'Threads', 'Snapchat',
                     'Discord', 'Twitch', 'SoundCloud', 'Pinterest', 'Reddit']:
        if platform.lower() in lower:
            return platform
    return 'Other'


def detect_category(name: str) -> str:
    """Guess category from service name."""
    lower = name.lower()
    for cat in ['followers', 'likes', 'views', 'subscribers', 'comments',
                'shares', 'reactions', 'retweets', 'saves', 'impressions',
                'plays', 'members', 'reach']:
        if cat in lower:
            return cat.capitalize()
    return 'Other'


CACHE_KEY = 'rss_services_list'
CACHE_TIMEOUT = 900  # 15 minutes


def _get_services_cached():
    """Fetch RSS services with caching. RSS rates are in NGN per 1K.
    Applies admin-configurable markup and converts to USD."""
    cached = cache.get(CACHE_KEY)
    if cached:
        return cached

    client = RSSClient()
    raw = client.get_services()
    ngn_to_usd = Decimal('1') / Decimal(str(settings.RSS_USD_TO_NGN))

    # Get admin-configured markup
    platform_settings = PlatformSettings.load()
    markup_multiplier = Decimal('1') + (platform_settings.boosting_markup_percent / Decimal('100'))

    services = []
    for svc in raw:
        cost_ngn = Decimal(str(svc['rate']))
        # Apply markup: cost + markup%
        rate_ngn = (cost_ngn * markup_multiplier).quantize(
            Decimal('0.01'), rounding=ROUND_UP
        )
        rate_usd = (rate_ngn * ngn_to_usd).quantize(
            Decimal('0.01'), rounding=ROUND_UP
        )
        services.append({
            'id': int(svc['service']),
            'name': svc['name'],
            'type': svc.get('type', ''),
            'category': detect_category(svc['name']),
            'rate_per_k_ngn': str(rate_ngn),
            'rate_per_k_usd': str(rate_usd),
            'cost_per_k_ngn': str(cost_ngn),  # raw cost without markup (for order processing)
            'min': int(svc['min']),
            'max': int(svc['max']),
            'platform': detect_platform(svc['name']),
            'refill': svc.get('refill', False),
            'cancel': svc.get('cancel', False),
        })

    cache.set(CACHE_KEY, services, CACHE_TIMEOUT)
    return services


@api_view(['GET'])
def api_boosting_services(request):
    """List all available boosting services from the RSS panel."""
    try:
        services = _get_services_cached()
        return Response(services)
    except RSSAPIError as e:
        return Response({'detail': str(e)}, status=502)


@api_view(['POST'])
def api_boosting_order(request):
    """Place a boosting order — deducts wallet and calls RSS API."""
    from core.sanitizers import sanitize_url, MAX_URL

    service_id = request.data.get('service_id')
    link = sanitize_url(request.data.get('link', ''), max_length=MAX_URL)
    quantity = request.data.get('quantity')

    if not service_id or not link or not quantity:
        return Response(
            {'detail': 'service_id, link, and quantity are required.'},
            status=400,
        )

    try:
        quantity = int(quantity)
    except (TypeError, ValueError):
        return Response({'detail': 'Invalid quantity.'}, status=400)

    # Look up the service to get rate and validate quantity
    try:
        all_services = _get_services_cached()
    except RSSAPIError as e:
        return Response({'detail': str(e)}, status=502)

    service = None
    for s in all_services:
        if s['id'] == int(service_id):
            service = s
            break

    if not service:
        return Response({'detail': 'Service not found.'}, status=404)

    if quantity < service['min'] or quantity > service['max']:
        return Response(
            {'detail': f"Quantity must be between {service['min']} and {service['max']}."},
            status=400,
        )

    # Calculate selling price (with markup) and raw API cost
    rate_ngn = Decimal(service['rate_per_k_ngn'])          # selling price per 1K
    api_cost_per_k = Decimal(service['cost_per_k_ngn'])    # raw API cost per 1K
    selling_ngn = (Decimal(quantity) / Decimal('1000') * rate_ngn).quantize(
        Decimal('0.01'), rounding=ROUND_UP
    )
    api_cost_ngn = (Decimal(quantity) / Decimal('1000') * api_cost_per_k).quantize(
        Decimal('0.01'), rounding=ROUND_UP
    )

    # Deduct wallet and create order record
    try:
        order = create_order(
            user=request.user,
            service_type='smm_boost',
            service_name=service['name'],
            amount=selling_ngn,
            cost_price=api_cost_ngn,
            external_data={
                'rss_service_id': service['id'],
                'link': link,
                'quantity': quantity,
                'rate_per_k_ngn': str(rate_ngn),
                'cost_per_k_ngn': str(api_cost_per_k),
                'platform': service['platform'],
                'category': service['category'],
            },
        )
    except ValueError as e:
        return Response({'detail': str(e)}, status=400)

    # Place order on RSS API
    try:
        client = RSSClient()
        rss_result = client.place_order(service['id'], link, quantity)
        order.external_order_id = str(rss_result.get('order', ''))
        order.status = 'processing'
        order.save()
    except RSSAPIError as e:
        # RSS API failed — refund the user
        order.mark_failed(notes=f'RSS API error: {str(e)}')
        return Response(
            {'detail': f'Order failed and has been refunded. Reason: {str(e)}'},
            status=502,
        )

    return Response({
        'detail': 'Order placed successfully.',
        'order': OrderSerializer(order).data,
    }, status=201)


@api_view(['GET'])
def api_boosting_order_status(request, order_id):
    """Check the live status of a boosting order from RSS."""
    try:
        order = Order.objects.get(id=order_id, user=request.user, service_type='smm_boost')
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found.'}, status=404)

    if not order.external_order_id:
        return Response(OrderSerializer(order).data)

    try:
        client = RSSClient()
        rss_status = client.check_status(int(order.external_order_id))
    except RSSAPIError:
        # Can't reach RSS — return what we have
        return Response(OrderSerializer(order).data)

    # Map RSS status to our internal status
    status_map = {
        'Completed': 'completed',
        'In progress': 'processing',
        'Pending': 'pending',
        'Processing': 'processing',
        'Partial': 'completed',
        'Canceled': 'failed',
    }
    rss_status_str = rss_status.get('status', '')
    new_status = status_map.get(rss_status_str, order.status)

    if new_status != order.status:
        if new_status == 'completed':
            order.mark_completed(
                result=f"Delivered. Start count: {rss_status.get('start_count', 'N/A')}, "
                       f"Remains: {rss_status.get('remains', '0')}"
            )
        elif new_status == 'failed':
            order.mark_failed(notes=f'RSS status: {rss_status_str}')
        else:
            order.status = new_status
            order.save()

    data = OrderSerializer(order).data
    data['rss_status'] = rss_status
    return Response(data)
