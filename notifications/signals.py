from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from wallet.models import Transaction
from orders.models import Order
from .models import Notification

# Orders that fail within this window are considered instant provider failures.
# We suppress the noisy "Order Placed → Failed → Refunded" notification chain
# and let the frontend's single error toast handle it.
INSTANT_FAILURE_SECONDS = 15


@receiver(post_save, sender=Transaction)
def notify_on_transaction(sender, instance, created, **kwargs):
    if not created:
        return

    wallet = instance.wallet
    user = wallet.user
    amount = f"{instance.amount:,.2f}"

    # Suppress debit + refund notifications for orders that failed instantly
    if instance.reference and instance.reference.startswith('REFUND-'):
        try:
            order_id = int(instance.reference.split('-', 1)[1])
            order = Order.objects.filter(id=order_id).first()
            if order and (timezone.now() - order.created_at).total_seconds() < INSTANT_FAILURE_SECONDS:
                return  # skip — frontend already showed error toast
        except (ValueError, IndexError):
            pass

    if instance.transaction_type == 'credit' and 'Refund' not in instance.description:
        Notification.objects.create(
            user=user,
            notification_type='deposit',
            title='Deposit Successful',
            message=f'Your wallet has been credited with {amount} NGN. {instance.description}',
        )
    elif instance.transaction_type == 'credit' and 'Refund' in instance.description:
        Notification.objects.create(
            user=user,
            notification_type='refund',
            title='Refund Processed',
            message=f'{amount} NGN has been refunded to your wallet. {instance.description}',
        )
    elif instance.transaction_type == 'debit':
        # Skip "Payment Made" for order payments — the "Order Placed" notification
        # (fired when order reaches 'processing') already confirms the purchase.
        # This avoids double-notifying and noisy spam on instant provider failures.
        desc_lower = (instance.description or '').lower()
        if desc_lower.startswith('payment for '):
            return
        Notification.objects.create(
            user=user,
            notification_type='purchase',
            title='Payment Made',
            message=f'{amount} NGN has been deducted from your wallet. {instance.description}',
        )


@receiver(post_save, sender=Order)
def notify_on_order_update(sender, instance, created, **kwargs):
    user = instance.user

    if created:
        # Don't notify yet — wait until the order is confirmed processing.
        # For provider failures the order goes straight to failed/refunded,
        # so an "Order Placed" notification would be misleading.
        return
    elif instance.status == 'processing':
        Notification.objects.create(
            user=user,
            notification_type='purchase',
            title='Order Placed',
            message=f'Your order for {instance.service_name} has been placed successfully.',
        )
    elif instance.status == 'completed':
        Notification.objects.create(
            user=user,
            notification_type='order_update',
            title='Order Completed',
            message=f'Your order for {instance.service_name} has been completed.',
        )
    elif instance.status == 'failed':
        # Skip notification for instant failures — the user already saw the error
        elapsed = (timezone.now() - instance.created_at).total_seconds()
        if elapsed < INSTANT_FAILURE_SECONDS:
            return
        Notification.objects.create(
            user=user,
            notification_type='order_update',
            title='Order Failed',
            message=f'Your order for {instance.service_name} has failed. A refund has been initiated.',
        )
