"""
Celery tasks: check live order statuses + sync services catalog from external APIs.
"""
import logging
from decimal import Decimal
from celery import shared_task
from django.utils import timezone
from orders.models import Order
from .rss_client import RSSClient, RSSAPIError
from .smspool_client import SMSPoolClient, SMSPoolAPIError

logger = logging.getLogger(__name__)

STATUS_MAP = {
    'Completed': 'completed',
    'In progress': 'processing',
    'Pending': 'pending',
    'Processing': 'processing',
    'Partial': 'completed',
    'Canceled': 'failed',
}


# ── Order status checkers ─────────────────────────────────────────────────────

@shared_task(name='check_boosting_orders')
def check_boosting_orders():
    """Check status of all in-progress boosting orders from RSS API."""
    orders = Order.objects.filter(
        service_type='smm_boost',
        status__in=['pending', 'processing'],
        external_order_id__isnull=False,
    ).exclude(external_order_id='')

    if not orders.exists():
        return 'No pending boosting orders.'

    try:
        client = RSSClient()
    except RSSAPIError as e:
        logger.error(f'RSS client init failed: {e}')
        return f'RSS client error: {e}'

    updated = 0
    errors = 0

    for order in orders:
        try:
            rss_status = client.check_status(int(order.external_order_id))
            rss_status_str = rss_status.get('status', '')
            new_status = STATUS_MAP.get(rss_status_str, order.status)

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
                updated += 1
                logger.info(f'Order #{order.id} updated: {order.status} -> {new_status}')

        except RSSAPIError as e:
            errors += 1
            logger.warning(f'Failed to check order #{order.id}: {e}')
        except Exception as e:
            errors += 1
            logger.error(f'Unexpected error checking order #{order.id}: {e}')

    return f'Checked {orders.count()} orders. Updated: {updated}, Errors: {errors}'


@shared_task(name='check_sms_orders')
def check_sms_orders():
    """Check status of all in-progress SMS verification orders."""
    orders = Order.objects.filter(
        service_type='phone_number',
        status='processing',
        external_order_id__isnull=False,
    ).exclude(external_order_id='')

    if not orders.exists():
        return 'No pending SMS orders.'

    try:
        client = SMSPoolClient()
    except SMSPoolAPIError as e:
        logger.error(f'SMSPool client init failed: {e}')
        return f'SMSPool client error: {e}'

    updated = 0
    errors = 0
    now = timezone.now()

    for order in orders:
        try:
            age_minutes = (now - order.created_at).total_seconds() / 60
            if age_minutes > 20:
                try:
                    client.cancel_sms(order.external_order_id)
                except SMSPoolAPIError:
                    pass
                order.mark_failed(notes='SMS order timed out (20 min).')
                updated += 1
                logger.info(f'SMS order #{order.id} timed out and refunded.')
                continue

            sms_status = client.check_sms(order.external_order_id)
            status_code = str(sms_status.get('status', ''))
            sms_code = sms_status.get('sms', '') or sms_status.get('full_code', '')

            if status_code == '3':
                order.mark_failed(notes='SMS order expired or cancelled by provider.')
                updated += 1
            elif sms_code:
                order.external_data = order.external_data or {}
                order.external_data['sms_code'] = sms_code
                order.save()
                order.mark_completed(result=sms_code)
                updated += 1
                logger.info(f'SMS order #{order.id} completed with code.')

        except SMSPoolAPIError as e:
            errors += 1
            logger.warning(f'Failed to check SMS order #{order.id}: {e}')
        except Exception as e:
            errors += 1
            logger.error(f'Unexpected error checking SMS order #{order.id}: {e}')

    return f'Checked {orders.count()} SMS orders. Updated: {updated}, Errors: {errors}'


# ── Service catalog sync ───────────────────────────────────────────────────────

def _detect_platform(name: str) -> str:
    lower = name.lower()
    for platform in ['Instagram', 'TikTok', 'Twitter', 'YouTube', 'Facebook',
                     'Telegram', 'Spotify', 'LinkedIn', 'Threads', 'Snapchat',
                     'Discord', 'Twitch', 'SoundCloud', 'Pinterest', 'Reddit']:
        if platform.lower() in lower:
            return platform
    return 'Other'


def _detect_category(name: str) -> str:
    lower = name.lower()
    for cat in ['followers', 'likes', 'views', 'subscribers', 'comments',
                'shares', 'reactions', 'retweets', 'saves', 'impressions',
                'plays', 'members', 'reach']:
        if cat in lower:
            return cat.capitalize()
    return 'Other'


@shared_task(name='sync_boosting_services')
def sync_boosting_services():
    """Fetch RSS services, sync new/changed ones to DB. Preserves admin is_active toggle."""
    from django.conf import settings as django_settings
    from .models import BoostingServiceSnapshot

    try:
        client = RSSClient()
        raw_services = client.get_services()
    except RSSAPIError as e:
        logger.error(f'RSS sync failed — could not fetch services: {e}')
        return f'Error: {e}'

    created = updated = unchanged = 0

    for svc in raw_services:
        external_id = int(svc['service'])
        cost_ngn = Decimal(str(svc['rate']))
        name = svc.get('name', '')
        service_type = svc.get('type', '')
        platform = _detect_platform(name)
        category = _detect_category(name)
        min_qty = int(svc.get('min', 10))
        max_qty = int(svc.get('max', 10000))
        refill = bool(svc.get('refill', False))
        cancel = bool(svc.get('cancel', False))

        try:
            obj = BoostingServiceSnapshot.objects.get(external_id=external_id)
            # Compare fields — only update if something actually changed
            changed = (
                obj.name != name
                or obj.service_type != service_type
                or obj.platform != platform
                or obj.category != category
                or obj.cost_per_k_ngn != cost_ngn
                or obj.min_quantity != min_qty
                or obj.max_quantity != max_qty
                or obj.refill != refill
                or obj.cancel != cancel
            )
            if changed:
                obj.name = name
                obj.service_type = service_type
                obj.platform = platform
                obj.category = category
                obj.cost_per_k_ngn = cost_ngn
                obj.min_quantity = min_qty
                obj.max_quantity = max_qty
                obj.refill = refill
                obj.cancel = cancel
                obj.save()
                updated += 1
            else:
                # Touch last_synced even if nothing changed
                obj.save(update_fields=['last_synced'])
                unchanged += 1
        except BoostingServiceSnapshot.DoesNotExist:
            BoostingServiceSnapshot.objects.create(
                external_id=external_id,
                name=name,
                service_type=service_type,
                platform=platform,
                category=category,
                cost_per_k_ngn=cost_ngn,
                min_quantity=min_qty,
                max_quantity=max_qty,
                refill=refill,
                cancel=cancel,
                is_active=True,
            )
            created += 1

    # Invalidate the cached service list so users get fresh data next request
    from django.core.cache import cache
    cache.delete('rss_services_list')

    msg = f'Boosting sync: {created} new, {updated} updated, {unchanged} unchanged.'
    logger.info(msg)
    return msg


@shared_task(name='sync_sms_services')
def sync_sms_services():
    """Fetch SMSPool countries + services, sync to DB. Preserves admin is_active toggle."""
    from .models import SMSCountrySnapshot, SMSServiceSnapshot
    from api_integrations.smspool_views import DIAL_CODES

    try:
        client = SMSPoolClient()
    except SMSPoolAPIError as e:
        logger.error(f'SMSPool sync failed — client init error: {e}')
        return f'Error: {e}'

    # ── Countries ──
    c_created = c_updated = c_unchanged = 0
    try:
        raw_countries = client.get_countries()
        for c in raw_countries:
            external_id = str(c.get('ID', c.get('id', '')))
            name = c.get('name', '')
            short_name = c.get('short_name', '')
            dial_code = DIAL_CODES.get(short_name.upper(), '')

            try:
                obj = SMSCountrySnapshot.objects.get(external_id=external_id)
                if obj.name != name or obj.short_name != short_name or obj.dial_code != dial_code:
                    obj.name = name
                    obj.short_name = short_name
                    obj.dial_code = dial_code
                    obj.save()
                    c_updated += 1
                else:
                    obj.save(update_fields=['last_synced'])
                    c_unchanged += 1
            except SMSCountrySnapshot.DoesNotExist:
                SMSCountrySnapshot.objects.create(
                    external_id=external_id,
                    name=name,
                    short_name=short_name,
                    dial_code=dial_code,
                    is_active=True,
                )
                c_created += 1
    except SMSPoolAPIError as e:
        logger.warning(f'SMSPool country sync failed: {e}')

    # ── Services ──
    s_created = s_updated = s_unchanged = 0
    try:
        raw_services = client.get_services()
        for s in raw_services:
            external_id = str(s.get('ID', s.get('id', '')))
            name = s.get('name', '')
            short_name = s.get('short_name', '')

            try:
                obj = SMSServiceSnapshot.objects.get(external_id=external_id)
                if obj.name != name or obj.short_name != short_name:
                    obj.name = name
                    obj.short_name = short_name
                    obj.save()
                    s_updated += 1
                else:
                    obj.save(update_fields=['last_synced'])
                    s_unchanged += 1
            except SMSServiceSnapshot.DoesNotExist:
                SMSServiceSnapshot.objects.create(
                    external_id=external_id,
                    name=name,
                    short_name=short_name,
                    is_active=True,
                )
                s_created += 1
    except SMSPoolAPIError as e:
        logger.warning(f'SMSPool service sync failed: {e}')

    # Invalidate cache
    from django.core.cache import cache
    cache.delete('smspool_countries')
    cache.delete('smspool_services')

    msg = (
        f'SMS sync — Countries: {c_created} new, {c_updated} updated, {c_unchanged} unchanged. '
        f'Services: {s_created} new, {s_updated} updated, {s_unchanged} unchanged.'
    )
    logger.info(msg)
    return msg
