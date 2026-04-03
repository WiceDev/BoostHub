from decimal import Decimal, ROUND_UP
from django.core.cache import cache
from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response

from orders.models import Order
from orders.serializers import OrderSerializer
from orders.services import create_order
from orders.utils import is_provider_insufficient_funds, notify_admins_insufficient_funds
from core.models import PlatformSettings
from .smspool_client import SMSPoolClient, SMSPoolAPIError


COUNTRIES_CACHE_KEY = 'smspool_countries'
SERVICES_CACHE_KEY = 'smspool_services'
CACHE_TIMEOUT = 3600  # 1 hour

# ISO 3166-1 alpha-2 → international dial code
DIAL_CODES: dict[str, str] = {
    "AC": "247", "AD": "376", "AE": "971", "AF": "93", "AG": "1",
    "AI": "1", "AL": "355", "AM": "374", "AO": "244", "AQ": "672",
    "AR": "54", "AS": "1", "AT": "43", "AU": "61", "AW": "297",
    "AX": "358", "AZ": "994", "BA": "387", "BB": "1", "BD": "880",
    "BE": "32", "BF": "226", "BG": "359", "BH": "973", "BI": "257",
    "BJ": "229", "BL": "590", "BM": "1", "BN": "673", "BO": "591",
    "BQ": "599", "BR": "55", "BS": "1", "BT": "975", "BW": "267",
    "BY": "375", "BZ": "501", "CA": "1", "CC": "61", "CD": "243",
    "CF": "236", "CG": "242", "CH": "41", "CI": "225", "CK": "682",
    "CL": "56", "CM": "237", "CN": "86", "CO": "57", "CR": "506",
    "CU": "53", "CV": "238", "CW": "599", "CX": "61", "CY": "357",
    "CZ": "420", "DE": "49", "DJ": "253", "DK": "45", "DM": "1",
    "DO": "1", "DZ": "213", "EC": "593", "EE": "372", "EG": "20",
    "EH": "212", "ER": "291", "ES": "34", "ET": "251", "FI": "358",
    "FJ": "679", "FK": "500", "FM": "691", "FO": "298", "FR": "33",
    "GA": "241", "GB": "44", "GD": "1", "GE": "995", "GF": "594",
    "GG": "44", "GH": "233", "GI": "350", "GL": "299", "GM": "220",
    "GN": "224", "GP": "590", "GQ": "240", "GR": "30", "GT": "502",
    "GU": "1", "GW": "245", "GY": "592", "HK": "852", "HN": "504",
    "HR": "385", "HT": "509", "HU": "36", "ID": "62", "IE": "353",
    "IL": "972", "IM": "44", "IN": "91", "IO": "246", "IQ": "964",
    "IR": "98", "IS": "354", "IT": "39", "JE": "44", "JM": "1",
    "JO": "962", "JP": "81", "KE": "254", "KG": "996", "KH": "855",
    "KI": "686", "KM": "269", "KN": "1", "KP": "850", "KR": "82",
    "KW": "965", "KY": "1", "KZ": "7", "LA": "856", "LB": "961",
    "LC": "1", "LI": "423", "LK": "94", "LR": "231", "LS": "266",
    "LT": "370", "LU": "352", "LV": "371", "LY": "218", "MA": "212",
    "MC": "377", "MD": "373", "ME": "382", "MF": "590", "MG": "261",
    "MH": "692", "MK": "389", "ML": "223", "MM": "95", "MN": "976",
    "MO": "853", "MP": "1", "MQ": "596", "MR": "222", "MS": "1",
    "MT": "356", "MU": "230", "MV": "960", "MW": "265", "MX": "52",
    "MY": "60", "MZ": "258", "NA": "264", "NC": "687", "NE": "227",
    "NF": "672", "NG": "234", "NI": "505", "NL": "31", "NO": "47",
    "NP": "977", "NR": "674", "NU": "683", "NZ": "64", "OM": "968",
    "PA": "507", "PE": "51", "PF": "689", "PG": "675", "PH": "63",
    "PK": "92", "PL": "48", "PM": "508", "PR": "1", "PS": "970",
    "PT": "351", "PW": "680", "PY": "595", "QA": "974", "RE": "262",
    "RO": "40", "RS": "381", "RU": "7", "RW": "250", "SA": "966",
    "SB": "677", "SC": "248", "SD": "249", "SE": "46", "SG": "65",
    "SH": "290", "SI": "386", "SJ": "47", "SK": "421", "SL": "232",
    "SM": "378", "SN": "221", "SO": "252", "SR": "597", "SS": "211",
    "ST": "239", "SV": "503", "SX": "1", "SY": "963", "SZ": "268",
    "TC": "1", "TD": "235", "TG": "228", "TH": "66", "TJ": "992",
    "TK": "690", "TL": "670", "TM": "993", "TN": "216", "TO": "676",
    "TR": "90", "TT": "1", "TV": "688", "TW": "886", "TZ": "255",
    "UA": "380", "UG": "256", "US": "1", "UY": "598", "UZ": "998",
    "VA": "379", "VC": "1", "VE": "58", "VG": "1", "VI": "1",
    "VN": "84", "VU": "678", "WF": "681", "WS": "685", "XK": "383",
    "YE": "967", "YT": "262", "ZA": "27", "ZM": "260", "ZW": "263",
}


def _get_countries_cached():
    cached = cache.get(COUNTRIES_CACHE_KEY)
    if cached:
        return cached

    from .models import SMSCountrySnapshot

    countries = [
        {
            'id': c.external_id,
            'name': c.name,
            'short_name': c.short_name,
            'dial_code': c.dial_code,
        }
        for c in SMSCountrySnapshot.objects.filter(is_active=True).order_by('name')
    ]
    cache.set(COUNTRIES_CACHE_KEY, countries, CACHE_TIMEOUT)
    return countries


def _get_services_cached():
    cached = cache.get(SERVICES_CACHE_KEY)
    if cached:
        return cached

    from .models import SMSServiceSnapshot

    services = [
        {
            'id': s.external_id,
            'name': s.name,
            'short_name': s.short_name,
        }
        for s in SMSServiceSnapshot.objects.filter(is_active=True).order_by('name')
    ]
    cache.set(SERVICES_CACHE_KEY, services, CACHE_TIMEOUT)
    return services


def _calculate_price_ngn(usd_price_str: str) -> tuple[Decimal, Decimal]:
    """Convert USD price to NGN with markup. Returns (price_ngn, cost_ngn)."""
    usd_price = Decimal(str(usd_price_str))
    usd_to_ngn = Decimal(str(settings.RSS_USD_TO_NGN))
    cost_ngn = (usd_price * usd_to_ngn).quantize(Decimal('0.01'), rounding=ROUND_UP)

    platform_settings = PlatformSettings.load()
    markup = Decimal('1') + (platform_settings.numbers_markup_percent / Decimal('100'))
    price_ngn = (cost_ngn * markup).quantize(Decimal('0.01'), rounding=ROUND_UP)
    return price_ngn, cost_ngn


@api_view(['GET'])
def api_numbers_countries(request):
    """List all available countries from SMSPool."""
    try:
        countries = _get_countries_cached()
        return Response(countries)
    except SMSPoolAPIError as e:
        return Response({'detail': str(e)}, status=502)


@api_view(['GET'])
def api_numbers_services(request):
    """List all available services from SMSPool."""
    try:
        services = _get_services_cached()
        return Response(services)
    except SMSPoolAPIError as e:
        return Response({'detail': str(e)}, status=502)


@api_view(['POST'])
def api_numbers_price(request):
    """Get price for a country+service combination."""
    country = request.data.get('country')
    service = request.data.get('service')
    if not country or not service:
        return Response({'detail': 'country and service are required.'}, status=400)

    try:
        client = SMSPoolClient(triggered_by=f'user:{request.user.id}')
        result = client.get_price(country, service)
    except SMSPoolAPIError as e:
        return Response({'detail': str(e)}, status=502)

    usd_price = result.get('price', '0')
    price_ngn, cost_ngn = _calculate_price_ngn(usd_price)
    ngn_to_usd = Decimal('1') / Decimal(str(settings.RSS_USD_TO_NGN))

    return Response({
        'price_ngn': str(price_ngn),
        'price_usd': str((price_ngn * ngn_to_usd).quantize(Decimal('0.01'), rounding=ROUND_UP)),
        'success_rate': result.get('success_rate', ''),
    })


@api_view(['POST'])
def api_numbers_order(request):
    """Purchase an SMS verification number."""
    country = request.data.get('country')
    service = request.data.get('service')
    service_name = request.data.get('service_name', 'SMS Verification')
    country_name = request.data.get('country_name', '')
    country_short_name = request.data.get('country_short_name', '')
    dial_code = request.data.get('dial_code', '') or DIAL_CODES.get(country_short_name.upper(), '')

    if not country or not service:
        return Response({'detail': 'country and service are required.'}, status=400)

    # Get live price
    try:
        client = SMSPoolClient(triggered_by=f'user:{request.user.id}')
        price_result = client.get_price(country, service)
    except SMSPoolAPIError as e:
        return Response({'detail': str(e)}, status=502)

    usd_price = price_result.get('price', '0')
    price_ngn, cost_ngn = _calculate_price_ngn(usd_price)

    # Create order and deduct wallet
    try:
        order = create_order(
            user=request.user,
            service_type='phone_number',
            service_name=f'{service_name} - {country_name}'.strip(' -'),
            amount=price_ngn,
            cost_price=cost_ngn,
            external_data={
                'smspool_country': country,
                'smspool_service': service,
                'service_name': service_name,
                'country_name': country_name,
                'country_short_name': country_short_name,
                'dial_code': dial_code,
                'cost_usd': usd_price,
                'cost_ngn': str(cost_ngn),
            },
        )
    except ValueError as e:
        return Response({'detail': str(e)}, status=400)

    # Purchase number from SMSPool
    try:
        sms_result = client.purchase_sms(country, service)
        phone_number = sms_result.get('phonenumber', sms_result.get('number', ''))
        smspool_order_id = str(sms_result.get('order_id', ''))

        order.external_order_id = smspool_order_id
        order.external_data['phone_number'] = phone_number
        order.status = 'processing'
        order.save()
    except SMSPoolAPIError as e:
        error_str = str(e)
        order.mark_failed(notes=f'SMSPool API error: {error_str}')
        if is_provider_insufficient_funds(error_str):
            notify_admins_insufficient_funds('SMSPool', error_str, order.id)
        return Response(
            {'detail': 'Order failed. Please try again later.'},
            status=502,
        )

    data = OrderSerializer(order).data
    data['phone_number'] = phone_number
    return Response({
        'detail': 'Number purchased successfully. Waiting for SMS code.',
        'order': data,
        'phone_number': phone_number,
    }, status=201)


@api_view(['GET'])
def api_numbers_order_status(request, order_id):
    """Check the live status of an SMS order."""
    try:
        order = Order.objects.get(id=order_id, user=request.user, service_type='phone_number')
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found.'}, status=404)

    phone_number = (order.external_data or {}).get('phone_number', '')

    # If already in a terminal state, return what we have
    if order.status in ('completed', 'failed', 'refunded', 'cancelled'):
        data = OrderSerializer(order).data
        data['phone_number'] = phone_number
        data['sms_code'] = order.result if order.status == 'completed' else None
        return Response(data)

    if not order.external_order_id:
        data = OrderSerializer(order).data
        data['phone_number'] = phone_number
        data['sms_code'] = None
        return Response(data)

    # Check live status from SMSPool
    try:
        client = SMSPoolClient(triggered_by=f'user:{request.user.id}')
        sms_status = client.check_sms(order.external_order_id)
    except SMSPoolAPIError:
        data = OrderSerializer(order).data
        data['phone_number'] = phone_number
        data['sms_code'] = None
        return Response(data)

    status_code = str(sms_status.get('status', ''))
    sms_code = sms_status.get('sms', '') or sms_status.get('full_code', '')

    # Status mapping: 1=pending, 2=completed (code received), 3=cancelled/expired
    if status_code == '3' and order.status not in ('failed', 'refunded', 'cancelled'):
        order.mark_failed(notes='SMS order expired or cancelled by provider.')
    elif sms_code and order.status not in ('completed', 'failed', 'refunded'):
        order.external_data['sms_code'] = sms_code
        order.save()
        order.mark_completed(result=sms_code)

    data = OrderSerializer(order).data
    data['phone_number'] = phone_number
    data['sms_code'] = sms_code if sms_code else None
    return Response(data)


@api_view(['POST'])
def api_numbers_cancel(request, order_id):
    """Cancel an SMS order and refund the user."""
    try:
        order = Order.objects.get(id=order_id, user=request.user, service_type='phone_number')
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found.'}, status=404)

    if order.status not in ('pending', 'processing'):
        return Response({'detail': 'This order cannot be cancelled.'}, status=400)

    if order.external_order_id:
        try:
            client = SMSPoolClient(triggered_by=f'user:{request.user.id}')
            client.cancel_sms(order.external_order_id)
        except SMSPoolAPIError as e:
            return Response({'detail': f'Could not cancel: {str(e)}'}, status=400)

    # Refund and mark as cancelled (not failed)
    order.user.wallet.credit(
        amount=order.amount,
        description=f'Refund for cancelled Order #{order.id} - {order.service_name}',
        reference=f'REFUND-{order.id}',
        transaction_type='refund'
    )
    order.status = 'cancelled'
    order.notes = 'Cancelled by user.'
    order.save()
    return Response({'detail': 'Order cancelled and refunded.'})
