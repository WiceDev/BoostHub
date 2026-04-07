from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Order
from .serializers import OrderSerializer
from .services import get_user_orders, get_order_stats, create_order
from services.models import Gift
from core.email_utils import notify_admin_gift_order


@api_view(['GET'])
def api_orders(request):
    service_type = request.query_params.get('type')
    orders = get_user_orders(request.user, service_type)
    serializer = OrderSerializer(orders, many=True)
    return Response(serializer.data)


@api_view(['POST'])
def api_place_gift_order(request):
    """Place a gift order — deducts from wallet and creates an order."""
    from core.sanitizers import sanitize_text, MAX_SHORT_TEXT, MAX_MEDIUM_TEXT, MAX_PHONE

    data = request.data
    gift_name = sanitize_text(data.get('gift_name', ''), max_length=MAX_SHORT_TEXT)
    gift_id = data.get('gift_id')
    amount = data.get('amount')
    recipient_name = sanitize_text(data.get('recipient_name', ''), max_length=MAX_SHORT_TEXT)
    recipient_phone = sanitize_text(data.get('recipient_phone', ''), max_length=MAX_PHONE)
    delivery_address = sanitize_text(data.get('delivery_address', ''), max_length=MAX_MEDIUM_TEXT)
    sender_name = sanitize_text(data.get('sender_name', ''), max_length=MAX_SHORT_TEXT)

    if not gift_name or not amount:
        return Response({'detail': 'Gift name and amount are required.'}, status=400)

    # Look up buying_price for profit tracking
    buying_price = None
    if gift_id:
        try:
            buying_price = Gift.objects.get(pk=gift_id).buying_price
        except Gift.DoesNotExist:
            pass

    try:
        order = create_order(
            user=request.user,
            service_type='gift',
            service_name=gift_name,
            amount=amount,
            cost_price=buying_price,
            external_data={
                'gift_id': gift_id,
                'recipient_name': recipient_name,
                'recipient_phone': recipient_phone,
                'delivery_address': delivery_address,
                'sender_name': sender_name,
            },
        )
        # Stays as pending until admin reviews
        order.status = 'pending'
        order.save()
        notify_admin_gift_order(request.user, order)
        return Response({
            'detail': 'Gift order placed successfully.',
            'order': OrderSerializer(order).data,
        }, status=201)
    except ValueError as e:
        return Response({'detail': str(e)}, status=400)


@api_view(['GET'])
def api_order_detail(request, order_id):
    try:
        order = Order.objects.get(id=order_id, user=request.user)
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found.'}, status=404)
    return Response(OrderSerializer(order).data)


@api_view(['GET'])
def api_dashboard_stats(request):
    stats = get_order_stats(request.user)
    wallet = request.user.wallet
    return Response({
        'balance': str(wallet.balance),
        'currency': wallet.currency,
        'total_orders': stats['total'],
        'completed_orders': stats['completed'],
        'pending_orders': stats['pending'],
        'failed_orders': stats['failed'],
        'total_spent': str(stats['total_spent']),
    })
