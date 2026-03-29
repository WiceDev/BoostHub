from django.db.models.signals import post_save
from django.dispatch import receiver
from wallet.models import Transaction
from orders.models import Order
from .models import Notification


@receiver(post_save, sender=Transaction)
def notify_on_transaction(sender, instance, created, **kwargs):
    if not created:
        return

    wallet = instance.wallet
    user = wallet.user
    amount = f"{instance.amount:,.2f}"

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
        Notification.objects.create(
            user=user,
            notification_type='order_update',
            title='Order Failed',
            message=f'Your order for {instance.service_name} has failed. A refund has been initiated.',
        )
