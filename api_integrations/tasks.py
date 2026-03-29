"""
Celery tasks for checking boosting order status from the RSS panel.
"""
import logging
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
            # Auto-cancel orders older than 20 minutes
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
                logger.info(f'SMS order #{order.id} expired/cancelled.')
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
