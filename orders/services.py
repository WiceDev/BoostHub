from decimal import Decimal
from .models import Order


def create_order(user, service_type, service_name, amount, external_data=None, cost_price=None):
    """
    Create an order and deduct from wallet in one safe operation.
    Returns the order if successful, raises an error if not.
    """
    amount = Decimal(str(amount))
    wallet = user.wallet
    if not wallet.can_afford(amount):
        raise ValueError(
            f"Insufficient balance. You need {amount} but have {wallet.balance}."
        )
    # Deduct from wallet first
    wallet.deduct(
        amount=amount,
        description=f'Payment for {service_name}'
    )
    # Create the order record
    order = Order.objects.create(
        user=user,
        service_type=service_type,
        service_name=service_name,
        amount=amount,
        cost_price=Decimal(str(cost_price)) if cost_price is not None else None,
        status='pending',
        external_data=external_data or {}
    )
    return order


def get_user_orders(user, service_type=None):
    """
    Get all orders for a user, optionally filtered by service type.
    """
    orders = Order.objects.filter(user=user)
    if service_type:
        orders = orders.filter(service_type=service_type)
    return orders


def get_order_stats(user):
    """
    Get order statistics for a user's dashboard.
    """
    orders = Order.objects.filter(user=user)
    return {
        'total': orders.count(),
        'completed': orders.filter(status='completed').count(),
        'pending': orders.filter(status='pending').count(),
        'failed': orders.filter(status='failed').count(),
        'refunded': orders.filter(status='refunded').count(),
        'total_spent': sum(
            o.amount for o in orders.filter(
                status__in=['completed', 'pending', 'processing']
            )
        ),
    }
