"""
Admin API views — all require is_staff=True.
"""
import logging
from datetime import timedelta
from django.db.models import Sum, Count, Q
from django.db.models.functions import TruncDay
from django.utils import timezone
from django.core.mail import EmailMessage
from django.conf import settings as django_settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from rest_framework import status
from users.models import User
from core.sanitizers import sanitize_text, sanitize_url, sanitize_dict, MAX_SHORT_TEXT, MAX_MEDIUM_TEXT, MAX_URL, MAX_PHONE, MAX_LONG_TEXT

logger = logging.getLogger(__name__)
from wallet.models import Wallet, Transaction
from orders.models import Order
from core.email_utils import (
    send_order_status_email, send_account_details_email,
    send_gift_status_email, send_crypto_deposit_status_email,
)
from services.models import Gift, BoostingService, SocialMediaAccount, WebDevPortfolio
from core.models import PlatformSettings, BannedIP, IPLog


# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_stats(request):
    users_count = User.objects.count()
    orders_count = Order.objects.count()
    total_revenue = Order.objects.filter(
        status__in=['completed', 'processing']
    ).aggregate(total=Sum('amount'))['total'] or 0
    pending_orders = Order.objects.filter(status='pending').count()
    active_gifts = Gift.objects.filter(is_active=True).count()
    active_services = BoostingService.objects.filter(is_active=True).count()

    return Response({
        'users_count': users_count,
        'orders_count': orders_count,
        'total_revenue': str(total_revenue),
        'pending_orders': pending_orders,
        'active_gifts': active_gifts,
        'active_services': active_services,
    })


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_analytics(request):
    from decimal import Decimal as D

    now = timezone.now()
    start = (now - timedelta(days=29)).replace(hour=0, minute=0, second=0, microsecond=0)
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_end = this_month_start
    last_month_start = (this_month_start - timedelta(days=1)).replace(
        day=1, hour=0, minute=0, second=0, microsecond=0
    )

    ps = PlatformSettings.load()
    boost_markup = D(str(ps.boosting_markup_percent))
    numbers_markup = D(str(ps.numbers_markup_percent))

    def order_profit(o):
        """Compute net profit for a single order."""
        amt = D(str(o.amount))
        # New orders: cost_price stored directly
        if o.cost_price is not None:
            return float(amt - D(str(o.cost_price)))
        # Historical fallback — no API cost for admin/manual service types
        if o.service_type in ('gift', 'social_account', 'website_template'):
            return float(amt)
        # Historical phone_number: cost_ngn stored in external_data
        if o.service_type == 'phone_number':
            cost_ngn = o.external_data.get('cost_ngn')
            if cost_ngn:
                return float(amt - D(str(cost_ngn)))
            m = numbers_markup
            return float(amt * m / (D('100') + m))
        # Historical smm_boost: derive from markup
        if o.service_type == 'smm_boost':
            m = boost_markup
            return float(amt * m / (D('100') + m))
        return float(amt)

    # ── Fetch orders for 30-day window ──
    orders_30d = list(
        Order.objects
        .filter(created_at__gte=start, status__in=['completed', 'processing'])
        .only('created_at', 'amount', 'cost_price', 'service_type', 'external_data')
    )

    # Aggregate by day
    rev_by_day: dict = {}
    for o in orders_30d:
        day = o.created_at.date()
        if day not in rev_by_day:
            rev_by_day[day] = {'revenue': 0.0, 'profit': 0.0, 'count': 0}
        rev_by_day[day]['revenue'] += float(o.amount)
        rev_by_day[day]['profit'] += order_profit(o)
        rev_by_day[day]['count'] += 1

    # ── Daily user signups ──
    daily_users_qs = (
        User.objects
        .filter(date_joined__gte=start)
        .annotate(day=TruncDay('date_joined'))
        .values('day')
        .annotate(count=Count('id'))
        .order_by('day')
    )
    users_by_day = {item['day'].date(): item['count'] for item in daily_users_qs}

    # ── Build 30-day arrays ──
    revenue_chart, orders_chart, users_chart = [], [], []
    for i in range(30):
        day = (start + timedelta(days=i)).date()
        label = day.strftime('%b %d')
        d = rev_by_day.get(day, {'revenue': 0.0, 'profit': 0.0, 'count': 0})
        revenue_chart.append({
            'date': label,
            'revenue': round(d['revenue'], 2),
            'profit': round(d['profit'], 2),
        })
        orders_chart.append({'date': label, 'orders': d['count']})
        users_chart.append({'date': label, 'users': users_by_day.get(day, 0)})

    # ── Service type breakdown ──
    service_breakdown = list(
        Order.objects
        .values('service_type')
        .annotate(count=Count('id'), revenue=Sum('amount'))
        .order_by('-count')
    )
    for item in service_breakdown:
        item['revenue'] = float(item['revenue'] or 0)

    # ── Status breakdown ──
    status_breakdown = list(
        Order.objects
        .values('status')
        .annotate(count=Count('id'))
        .order_by('-count')
    )

    # ── Month-over-month totals ──
    def month_totals(qs):
        paid = list(qs.filter(status__in=['completed', 'processing']).only(
            'amount', 'cost_price', 'service_type', 'external_data'
        ))
        rev = sum(float(o.amount) for o in paid)
        prof = sum(order_profit(o) for o in paid)
        return rev, prof, qs.count()

    this_orders_qs = Order.objects.filter(created_at__gte=this_month_start)
    last_orders_qs = Order.objects.filter(created_at__gte=last_month_start, created_at__lt=last_month_end)

    tm_rev, tm_prof, tm_ord = month_totals(this_orders_qs)
    lm_rev, lm_prof, lm_ord = month_totals(last_orders_qs)

    this_users = User.objects.filter(date_joined__gte=this_month_start).count()
    last_users = User.objects.filter(date_joined__gte=last_month_start, date_joined__lt=last_month_end).count()

    return Response({
        'revenue_chart': revenue_chart,
        'orders_chart': orders_chart,
        'users_chart': users_chart,
        'service_breakdown': service_breakdown,
        'status_breakdown': status_breakdown,
        'this_month': {
            'revenue': round(tm_rev, 2),
            'profit': round(tm_prof, 2),
            'orders': tm_ord,
            'users': this_users,
        },
        'last_month': {
            'revenue': round(lm_rev, 2),
            'profit': round(lm_prof, 2),
            'orders': lm_ord,
            'users': last_users,
        },
    })


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_users(request):
    search = request.query_params.get('search', '')
    users = User.objects.select_related('wallet').all()
    if search:
        users = users.filter(
            Q(email__icontains=search) |
            Q(first_name__icontains=search) |
            Q(last_name__icontains=search) |
            Q(username__icontains=search)
        )
    users = users.order_by('-date_joined')

    data = []
    for u in users:
        wallet_balance = '0.00'
        try:
            wallet_balance = str(u.wallet.balance)
        except Wallet.DoesNotExist:
            pass
        data.append({
            'id': u.id,
            'email': u.email,
            'username': u.username,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'full_name': u.get_full_name(),
            'phone': u.phone,
            'is_verified': u.is_verified,
            'is_staff': u.is_staff,
            'is_active': u.is_active,
            'wallet_balance': wallet_balance,
            'date_joined': u.date_joined.isoformat(),
            'orders_count': u.orders.count(),
        })
    return Response(data)


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_user_detail(request, user_id):
    try:
        u = User.objects.select_related('wallet').get(pk=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=404)

    if request.method == 'GET':
        wallet_balance = '0.00'
        try:
            wallet_balance = str(u.wallet.balance)
        except Wallet.DoesNotExist:
            pass
        transactions = []
        try:
            for t in u.wallet.transactions.all()[:20]:
                transactions.append({
                    'id': t.id,
                    'amount': str(t.amount),
                    'transaction_type': t.transaction_type,
                    'status': t.status,
                    'description': t.description,
                    'created_at': t.created_at.isoformat(),
                })
        except Wallet.DoesNotExist:
            pass
        orders = []
        for o in u.orders.all()[:20]:
            orders.append({
                'id': o.id,
                'service_type': o.service_type,
                'service_name': o.service_name,
                'amount': str(o.amount),
                'status': o.status,
                'created_at': o.created_at.isoformat(),
            })
        return Response({
            'id': u.id,
            'email': u.email,
            'username': u.username,
            'first_name': u.first_name,
            'last_name': u.last_name,
            'full_name': u.get_full_name(),
            'phone': u.phone,
            'is_verified': u.is_verified,
            'is_staff': u.is_staff,
            'is_active': u.is_active,
            'wallet_balance': wallet_balance,
            'date_joined': u.date_joined.isoformat(),
            'transactions': transactions,
            'orders': orders,
        })

    # PATCH — update user fields
    if 'first_name' in request.data:
        u.first_name = sanitize_text(request.data['first_name'], max_length=MAX_NAME)
    if 'last_name' in request.data:
        u.last_name = sanitize_text(request.data['last_name'], max_length=MAX_NAME)
    if 'phone' in request.data:
        u.phone = sanitize_text(request.data['phone'], max_length=MAX_PHONE)
    if 'is_verified' in request.data:
        u.is_verified = request.data['is_verified']
    if 'is_active' in request.data:
        u.is_active = request.data['is_active']
    if 'is_staff' in request.data:
        u.is_staff = request.data['is_staff']
    # Staff users are automatically verified
    if u.is_staff and not u.is_verified:
        u.is_verified = True
    u.save()
    return Response({'detail': 'User updated.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_user_credit(request, user_id):
    """Credit a user's wallet (admin top-up)."""
    try:
        u = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=404)

    amount = request.data.get('amount')
    description = request.data.get('description', 'Admin credit')
    try:
        amount = float(amount)
        if amount <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return Response({'detail': 'Valid positive amount required.'}, status=400)

    u.wallet.credit(amount, description)
    return Response({'detail': f'Credited {amount} to {u.email}', 'balance': str(u.wallet.balance)})


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_user_debit(request, user_id):
    """Debit (deduct from) a user's wallet."""
    try:
        u = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=404)

    amount = request.data.get('amount')
    description = request.data.get('description', 'Admin debit')
    try:
        amount = float(amount)
        if amount <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return Response({'detail': 'Valid positive amount required.'}, status=400)

    try:
        u.wallet.deduct(amount, description)
    except Exception as e:
        return Response({'detail': str(e)}, status=400)
    return Response({'detail': f'Debited {amount} from {u.email}', 'balance': str(u.wallet.balance)})


@api_view(['DELETE'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_user_delete(request, user_id):
    """Delete a user account."""
    try:
        u = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=404)

    if u.is_staff:
        return Response({'detail': 'Cannot delete staff users.'}, status=400)

    u.delete()
    return Response({'detail': 'User deleted.'}, status=204)


# ---------------------------------------------------------------------------
# Gifts CRUD
# ---------------------------------------------------------------------------

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_gifts(request):
    if request.method == 'GET':
        gifts = Gift.objects.all()
        data = [{
            'id': g.id,
            'name': g.name,
            'description': g.description,
            'price': str(g.price),
            'buying_price': str(g.buying_price) if g.buying_price is not None else None,
            'category': g.category,
            'emoji': g.emoji,
            'color': g.color,
            'image_url': g.image_url,
            'delivery_days': g.delivery_days,
            'notes': g.notes,
            'rating': str(g.rating),
            'is_active': g.is_active,
            'created_at': g.created_at.isoformat(),
        } for g in gifts]
        return Response(data)

    # POST — create gift
    required = ['name', 'price', 'category']
    for field in required:
        if not request.data.get(field):
            return Response({'detail': f'{field} is required.'}, status=400)

    buying_price_raw = request.data.get('buying_price')
    gift = Gift.objects.create(
        name=sanitize_text(request.data['name'], max_length=MAX_SHORT_TEXT),
        description=sanitize_text(request.data.get('description', ''), max_length=MAX_MEDIUM_TEXT),
        price=request.data['price'],
        buying_price=buying_price_raw if buying_price_raw not in (None, '') else None,
        category=sanitize_text(request.data['category'], max_length=MAX_SHORT_TEXT),
        emoji=sanitize_text(request.data.get('emoji', ''), max_length=10),
        color=sanitize_text(request.data.get('color', ''), max_length=20),
        image_url=sanitize_url(request.data.get('image_url', ''), max_length=MAX_URL),
        delivery_days=request.data.get('delivery_days', 3),
        notes=sanitize_text(request.data.get('notes', ''), max_length=MAX_MEDIUM_TEXT),
        rating=request.data.get('rating', 4.5),
        is_active=request.data.get('is_active', True),
    )
    return Response({
        'id': gift.id,
        'detail': 'Gift created.',
    }, status=201)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_gift_detail(request, gift_id):
    try:
        gift = Gift.objects.get(pk=gift_id)
    except Gift.DoesNotExist:
        return Response({'detail': 'Gift not found.'}, status=404)

    if request.method == 'GET':
        return Response({
            'id': gift.id,
            'name': gift.name,
            'description': gift.description,
            'price': str(gift.price),
            'buying_price': str(gift.buying_price) if gift.buying_price is not None else None,
            'category': gift.category,
            'emoji': gift.emoji,
            'color': gift.color,
            'image_url': gift.image_url,
            'delivery_days': gift.delivery_days,
            'notes': gift.notes,
            'rating': str(gift.rating),
            'is_active': gift.is_active,
        })

    if request.method == 'PATCH':
        if 'name' in request.data:
            gift.name = sanitize_text(request.data['name'], max_length=MAX_SHORT_TEXT)
        if 'description' in request.data:
            gift.description = sanitize_text(request.data['description'], max_length=MAX_MEDIUM_TEXT)
        if 'price' in request.data:
            gift.price = request.data['price']
        if 'category' in request.data:
            gift.category = sanitize_text(request.data['category'], max_length=MAX_SHORT_TEXT)
        if 'emoji' in request.data:
            gift.emoji = sanitize_text(request.data['emoji'], max_length=10)
        if 'color' in request.data:
            gift.color = sanitize_text(request.data['color'], max_length=20)
        if 'image_url' in request.data:
            gift.image_url = sanitize_url(request.data['image_url'], max_length=MAX_URL)
        if 'delivery_days' in request.data:
            gift.delivery_days = request.data['delivery_days']
        if 'notes' in request.data:
            gift.notes = sanitize_text(request.data['notes'], max_length=MAX_MEDIUM_TEXT)
        if 'rating' in request.data:
            gift.rating = request.data['rating']
        if 'is_active' in request.data:
            gift.is_active = request.data['is_active']
        if 'buying_price' in request.data:
            raw = request.data['buying_price']
            gift.buying_price = raw if raw not in (None, '') else None
        gift.save()
        return Response({'detail': 'Gift updated.'})

    if request.method == 'DELETE':
        gift.delete()
        return Response({'detail': 'Gift deleted.'}, status=204)


# ---------------------------------------------------------------------------
# Boosting Services CRUD
# ---------------------------------------------------------------------------

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_boosting_services(request):
    if request.method == 'GET':
        services = BoostingService.objects.all()
        data = [{
            'id': s.id,
            'name': s.name,
            'platform': s.platform,
            'category': s.category,
            'price_per_k': str(s.price_per_k),
            'min_quantity': s.min_quantity,
            'max_quantity': s.max_quantity,
            'is_active': s.is_active,
            'created_at': s.created_at.isoformat(),
        } for s in services]
        return Response(data)

    required = ['name', 'platform', 'category', 'price_per_k']
    for field in required:
        if not request.data.get(field):
            return Response({'detail': f'{field} is required.'}, status=400)

    svc = BoostingService.objects.create(
        name=sanitize_text(request.data['name'], max_length=MAX_SHORT_TEXT),
        platform=sanitize_text(request.data['platform'], max_length=MAX_SHORT_TEXT),
        category=sanitize_text(request.data['category'], max_length=MAX_SHORT_TEXT),
        price_per_k=request.data['price_per_k'],
        min_quantity=request.data.get('min_quantity', 100),
        max_quantity=request.data.get('max_quantity', 100000),
        is_active=request.data.get('is_active', True),
    )
    return Response({'id': svc.id, 'detail': 'Service created.'}, status=201)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_boosting_service_detail(request, service_id):
    try:
        svc = BoostingService.objects.get(pk=service_id)
    except BoostingService.DoesNotExist:
        return Response({'detail': 'Service not found.'}, status=404)

    if request.method == 'GET':
        return Response({
            'id': svc.id,
            'name': svc.name,
            'platform': svc.platform,
            'category': svc.category,
            'price_per_k': str(svc.price_per_k),
            'min_quantity': svc.min_quantity,
            'max_quantity': svc.max_quantity,
            'is_active': svc.is_active,
        })

    if request.method == 'PATCH':
        if 'name' in request.data:
            svc.name = sanitize_text(request.data['name'], max_length=MAX_SHORT_TEXT)
        if 'platform' in request.data:
            svc.platform = sanitize_text(request.data['platform'], max_length=MAX_SHORT_TEXT)
        if 'category' in request.data:
            svc.category = sanitize_text(request.data['category'], max_length=MAX_SHORT_TEXT)
        if 'price_per_k' in request.data:
            svc.price_per_k = request.data['price_per_k']
        if 'min_quantity' in request.data:
            svc.min_quantity = request.data['min_quantity']
        if 'max_quantity' in request.data:
            svc.max_quantity = request.data['max_quantity']
        if 'is_active' in request.data:
            svc.is_active = request.data['is_active']
        svc.save()
        return Response({'detail': 'Service updated.'})

    if request.method == 'DELETE':
        svc.delete()
        return Response({'detail': 'Service deleted.'}, status=204)


# ---------------------------------------------------------------------------
# Orders management
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_orders(request):
    status_filter = request.query_params.get('status', '')
    service_type = request.query_params.get('type', '')
    search = request.query_params.get('search', '')

    orders = Order.objects.select_related('user').all()
    if status_filter:
        orders = orders.filter(status=status_filter)
    if service_type:
        orders = orders.filter(service_type=service_type)
    if search:
        orders = orders.filter(
            Q(user__email__icontains=search) |
            Q(service_name__icontains=search) |
            Q(id__icontains=search)
        )

    data = [{
        'id': o.id,
        'user_email': o.user.email,
        'user_id': o.user.id,
        'service_type': o.service_type,
        'service_name': o.service_name,
        'amount': str(o.amount),
        'status': o.status,
        'notes': o.notes,
        'result': o.result,
        'external_data': o.external_data or {},
        'tracking_code': o.tracking_code,
        'tracking_url': o.tracking_url,
        'created_at': o.created_at.isoformat(),
    } for o in orders[:100]]
    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_create_order(request):
    """Create an order on behalf of any user — optionally deduct from their wallet."""
    from decimal import Decimal, InvalidOperation
    from orders.services import create_order as svc_create_order

    user_id = request.data.get('user_id')
    service_type = sanitize_text((request.data.get('service_type') or ''), max_length=30)
    service_name = sanitize_text((request.data.get('service_name') or ''), max_length=MAX_SHORT_TEXT)
    amount = request.data.get('amount')
    deduct_wallet = request.data.get('deduct_wallet', True)
    notes = sanitize_text((request.data.get('notes') or ''), max_length=MAX_MEDIUM_TEXT)
    initial_status = sanitize_text((request.data.get('status') or 'pending'), max_length=20)
    result = sanitize_text((request.data.get('result') or ''), max_length=MAX_MEDIUM_TEXT)

    if not user_id:
        return Response({'detail': 'user_id is required.'}, status=400)
    if not service_type:
        return Response({'detail': 'service_type is required.'}, status=400)
    if not service_name:
        return Response({'detail': 'service_name is required.'}, status=400)
    if amount is None:
        return Response({'detail': 'amount is required.'}, status=400)

    valid_types = [t[0] for t in Order.SERVICE_TYPES]
    if service_type not in valid_types:
        return Response({'detail': f'Invalid service_type.'}, status=400)

    valid_statuses = [s[0] for s in Order.STATUS_CHOICES]
    if initial_status not in valid_statuses:
        return Response({'detail': 'Invalid status.'}, status=400)

    try:
        amount = Decimal(str(amount))
        if amount < 0:
            raise ValueError
    except (InvalidOperation, ValueError):
        return Response({'detail': 'Invalid amount.'}, status=400)

    try:
        user = User.objects.select_related('wallet').get(pk=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=404)

    if deduct_wallet:
        try:
            order = svc_create_order(
                user=user,
                service_type=service_type,
                service_name=service_name,
                amount=amount,
                external_data={'manual': True, 'created_by_admin': True},
            )
        except ValueError as e:
            return Response({'detail': str(e)}, status=400)
    else:
        order = Order.objects.create(
            user=user,
            service_type=service_type,
            service_name=service_name,
            amount=amount,
            status='pending',
            external_data={'manual': True, 'created_by_admin': True, 'no_charge': True},
        )

    # Apply extra fields after creation
    changed = False
    if notes:
        order.notes = notes
        changed = True
    if initial_status != 'pending':
        order.status = initial_status
        changed = True
    if result:
        order.result = result
        changed = True
    if changed:
        order.save()

    return Response({
        'detail': f'Order #{order.id} created for {user.email}.',
        'order_id': order.id,
        'status': order.status,
    }, status=201)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_order_update(request, order_id):
    try:
        order = Order.objects.get(pk=order_id)
    except Order.DoesNotExist:
        return Response({'detail': 'Order not found.'}, status=404)

    new_status = request.data.get('status')
    notes = sanitize_text(request.data.get('notes', ''), max_length=MAX_MEDIUM_TEXT)

    old_status = order.status

    if new_status == 'completed':
        result = sanitize_text(request.data.get('result', ''), max_length=MAX_MEDIUM_TEXT)
        order.mark_completed(result=result)
    elif new_status == 'failed':
        order.mark_failed(notes=notes)
    elif new_status == 'refunded':
        if order.status == 'refunded':
            return Response({'detail': 'Order has already been refunded.'}, status=400)
        if notes:
            order.notes = notes
            order.save()
        order.refund()
    elif new_status in ('processing', 'pending', 'cancelled', 'in_transit'):
        order.status = new_status
        if notes:
            order.notes = notes
        # Save tracking info when moving to in_transit
        if new_status == 'in_transit':
            tracking_code = sanitize_text(request.data.get('tracking_code', ''), max_length=MAX_SHORT_TEXT)
            tracking_url = sanitize_url(request.data.get('tracking_url', ''), max_length=MAX_URL)
            if tracking_code:
                order.tracking_code = tracking_code
            if tracking_url:
                order.tracking_url = tracking_url
        order.save()
    else:
        return Response({'detail': 'Invalid status.'}, status=400)

    # ── Email notifications on status change ──────────────────────────────
    if new_status != old_status:
        try:
            if order.service_type == 'gift':
                send_gift_status_email(order.user, order)
            elif order.service_type == 'social_account' and new_status == 'completed':
                send_account_details_email(order.user, order)
            elif new_status in ('completed', 'failed', 'refunded'):
                send_order_status_email(order.user, order)
        except Exception as e:
            logger.warning(f'Failed to send order status email for #{order.id}: {e}')

    return Response({'detail': f'Order #{order.id} updated to {order.status}.'})


# ---------------------------------------------------------------------------
# Platform Settings
# ---------------------------------------------------------------------------

def _mask_key(value):
    """Return a safely masked version of an API key for display."""
    if not value:
        return None
    if len(value) <= 8:
        return '****'
    return value[:4] + '****' + value[-4:]


def _key_info(db_val, settings_attr):
    """Return display info for one API key slot."""
    resolved = db_val.strip() if db_val else ''
    env_val = (getattr(django_settings, settings_attr, '') or '').strip()
    if resolved:
        return {'masked': _mask_key(resolved), 'source': 'database'}
    if env_val:
        return {'masked': _mask_key(env_val), 'source': 'env'}
    return {'masked': None, 'source': 'not_set'}


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_platform_settings(request):
    settings_obj = PlatformSettings.load()

    if request.method == 'GET':
        return Response({
            'boosting_markup_percent': str(settings_obj.boosting_markup_percent),
            'numbers_markup_percent': str(settings_obj.numbers_markup_percent),
            'usd_to_ngn_rate': str(settings_obj.usd_to_ngn_rate),
            'crypto_usd_rate': str(settings_obj.crypto_usd_rate),
            'crypto_methods': settings_obj.crypto_methods or [],
            'api_keys': {
                'korapay_secret':     _key_info(settings_obj.korapay_secret_key, 'KORAPAY_SECRET_KEY'),
                'korapay_public':     _key_info(settings_obj.korapay_public_key, 'KORAPAY_PUBLIC_KEY'),
                'korapay_encryption': _key_info(settings_obj.korapay_encryption_key, 'KORAPAY_ENCRYPTION_KEY'),
                'rss_api_key':        _key_info(settings_obj.rss_api_key, 'REAL_SIMPLE_SOCIAL_API_KEY'),
                'smspool_api_key':    _key_info(settings_obj.smspool_api_key, 'SMS_POOL_API_KEY'),
            },
        })

    # PATCH — update settings
    for field in ('boosting_markup_percent', 'numbers_markup_percent'):
        val = request.data.get(field)
        if val is not None:
            try:
                val = float(val)
                if val < 0 or val > 500:
                    return Response({'detail': f'{field} must be between 0 and 500.'}, status=400)
                setattr(settings_obj, field, val)
            except (TypeError, ValueError):
                return Response({'detail': f'Invalid {field} value.'}, status=400)

    # Exchange rate
    usd_rate = request.data.get('usd_to_ngn_rate')
    if usd_rate is not None:
        try:
            usd_rate = float(usd_rate)
            if usd_rate < 1:
                return Response({'detail': 'Exchange rate must be at least 1.'}, status=400)
            settings_obj.usd_to_ngn_rate = usd_rate
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid exchange rate value.'}, status=400)

    # Crypto-specific exchange rate
    crypto_rate = request.data.get('crypto_usd_rate')
    if crypto_rate is not None:
        try:
            crypto_rate = float(crypto_rate)
            if crypto_rate < 1:
                return Response({'detail': 'Crypto exchange rate must be at least 1.'}, status=400)
            settings_obj.crypto_usd_rate = crypto_rate
        except (TypeError, ValueError):
            return Response({'detail': 'Invalid crypto exchange rate value.'}, status=400)

    # Crypto methods — full list replacement
    if 'crypto_methods' in request.data:
        import uuid
        methods = request.data['crypto_methods']
        if not isinstance(methods, list):
            return Response({'detail': 'crypto_methods must be a list.'}, status=400)
        cleaned = []
        for m in methods:
            if not isinstance(m, dict):
                continue
            name = sanitize_text(m.get('name', ''), max_length=MAX_SHORT_TEXT)
            network = sanitize_text(m.get('network', ''), max_length=MAX_SHORT_TEXT)
            address = sanitize_text(m.get('address', ''), max_length=MAX_SHORT_TEXT)
            if not name or not address:
                continue
            cleaned.append({
                'id': str(m.get('id') or uuid.uuid4()),
                'name': name,
                'network': network,
                'address': address,
            })
        settings_obj.crypto_methods = cleaned

    # API key overrides — only update if a non-empty value is supplied
    API_KEY_FIELDS = {
        'korapay_secret':     ('korapay_secret_key',     'korapay_secret_key'),
        'korapay_public':     ('korapay_public_key',     'korapay_public_key'),
        'korapay_encryption': ('korapay_encryption_key', 'korapay_encryption_key'),
        'rss_api_key':        ('rss_api_key',            'rss_api_key'),
        'smspool_api_key':    ('smspool_api_key',        'smspool_api_key'),
    }
    api_keys_data = request.data.get('api_keys', {})
    cleared_key_caches = []
    for payload_key, (model_attr, cache_attr) in API_KEY_FIELDS.items():
        new_val = api_keys_data.get(payload_key)
        if new_val is None:
            continue
        new_val = str(new_val).strip()
        setattr(settings_obj, model_attr, new_val)
        cleared_key_caches.append(cache_attr)

    settings_obj.save()

    # Clear caches
    from django.core.cache import cache
    cache.delete('rss_services_db_v1')
    for attr in cleared_key_caches:
        PlatformSettings.clear_api_key_cache(attr)

    return Response({
        'detail': 'Settings updated.',
        'boosting_markup_percent': str(settings_obj.boosting_markup_percent),
        'numbers_markup_percent': str(settings_obj.numbers_markup_percent),
        'usd_to_ngn_rate': str(settings_obj.usd_to_ngn_rate),
        'crypto_usd_rate': str(settings_obj.crypto_usd_rate),
        'crypto_methods': settings_obj.crypto_methods or [],
        'api_keys': {
            'korapay_secret':     _key_info(settings_obj.korapay_secret_key, 'KORAPAY_SECRET_KEY'),
            'korapay_public':     _key_info(settings_obj.korapay_public_key, 'KORAPAY_PUBLIC_KEY'),
            'korapay_encryption': _key_info(settings_obj.korapay_encryption_key, 'KORAPAY_ENCRYPTION_KEY'),
            'rss_api_key':        _key_info(settings_obj.rss_api_key, 'REAL_SIMPLE_SOCIAL_API_KEY'),
            'smspool_api_key':    _key_info(settings_obj.smspool_api_key, 'SMS_POOL_API_KEY'),
        },
    })


# ---------------------------------------------------------------------------
# Public: crypto payment methods (used on deposit page, no auth required)
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([])
def public_crypto_methods(request):
    settings_obj = PlatformSettings.load()
    return Response({
        'crypto_usd_rate': str(settings_obj.crypto_usd_rate),
        'methods': settings_obj.crypto_methods or [],
    })


# ---------------------------------------------------------------------------
# Social Media Accounts CRUD
# ---------------------------------------------------------------------------

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_accounts(request):
    if request.method == 'GET':
        accounts = SocialMediaAccount.objects.all()
        data = [{
            'id': a.id,
            'platform': a.platform,
            'service_name': a.service_name,
            'description': a.description,
            'price': str(a.price),
            'buying_price': str(a.buying_price) if a.buying_price is not None else None,
            'notes': a.notes,
            'required_fields': a.required_fields,
            'is_active': a.is_active,
            'created_at': a.created_at.isoformat(),
        } for a in accounts]
        return Response(data)

    # POST
    required = ['platform', 'service_name', 'price']
    for field in required:
        if not request.data.get(field):
            return Response({'detail': f'{field} is required.'}, status=400)

    buying_price_raw = request.data.get('buying_price')
    required_fields = request.data.get('required_fields', [])
    if required_fields and isinstance(required_fields, list):
        required_fields = [sanitize_text(str(f), max_length=MAX_SHORT_TEXT) for f in required_fields]
    account = SocialMediaAccount.objects.create(
        platform=sanitize_text(request.data['platform'], max_length=MAX_SHORT_TEXT),
        service_name=sanitize_text(request.data['service_name'], max_length=MAX_SHORT_TEXT),
        description=sanitize_text(request.data.get('description', ''), max_length=MAX_MEDIUM_TEXT),
        price=request.data['price'],
        buying_price=buying_price_raw if buying_price_raw not in (None, '') else None,
        notes=sanitize_text(request.data.get('notes', ''), max_length=MAX_MEDIUM_TEXT),
        required_fields=required_fields or [],
        is_active=request.data.get('is_active', True),
    )
    return Response({'id': account.id, 'detail': 'Account created.'}, status=201)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_account_detail(request, account_id):
    try:
        account = SocialMediaAccount.objects.get(pk=account_id)
    except SocialMediaAccount.DoesNotExist:
        return Response({'detail': 'Account not found.'}, status=404)

    if request.method == 'GET':
        return Response({
            'id': account.id,
            'platform': account.platform,
            'service_name': account.service_name,
            'description': account.description,
            'price': str(account.price),
            'buying_price': str(account.buying_price) if account.buying_price is not None else None,
            'notes': account.notes,
            'required_fields': account.required_fields,
            'is_active': account.is_active,
        })

    if request.method == 'PATCH':
        if 'platform' in request.data:
            account.platform = sanitize_text(request.data['platform'], max_length=MAX_SHORT_TEXT)
        if 'service_name' in request.data:
            account.service_name = sanitize_text(request.data['service_name'], max_length=MAX_SHORT_TEXT)
        if 'description' in request.data:
            account.description = sanitize_text(request.data['description'], max_length=MAX_MEDIUM_TEXT)
        if 'price' in request.data:
            account.price = request.data['price']
        if 'notes' in request.data:
            account.notes = sanitize_text(request.data['notes'], max_length=MAX_MEDIUM_TEXT)
        if 'required_fields' in request.data:
            rf = request.data['required_fields']
            if rf and isinstance(rf, list):
                account.required_fields = [sanitize_text(str(f), max_length=MAX_SHORT_TEXT) for f in rf]
            else:
                account.required_fields = []
        if 'is_active' in request.data:
            account.is_active = request.data['is_active']
        if 'buying_price' in request.data:
            raw = request.data['buying_price']
            account.buying_price = raw if raw not in (None, '') else None
        account.save()
        return Response({'detail': 'Account updated.'})

    if request.method == 'DELETE':
        account.delete()
        return Response({'detail': 'Account deleted.'}, status=204)


# ---------------------------------------------------------------------------
# Web Development Portfolio CRUD
# ---------------------------------------------------------------------------

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_webdev(request):
    if request.method == 'GET':
        items = WebDevPortfolio.objects.all()
        data = [{
            'id': w.id,
            'title': w.title,
            'description': w.description,
            'video_url': w.video_url,
            'website_url': w.website_url,
            'image_url': w.image_url,
            'price': str(w.price),
            'category': w.category,
            'is_active': w.is_active,
            'created_at': w.created_at.isoformat(),
        } for w in items]
        return Response(data)

    # POST
    required = ['title', 'price']
    for field in required:
        if not request.data.get(field):
            return Response({'detail': f'{field} is required.'}, status=400)

    item = WebDevPortfolio.objects.create(
        title=sanitize_text(request.data['title'], max_length=MAX_SHORT_TEXT),
        description=sanitize_text(request.data.get('description', ''), max_length=MAX_MEDIUM_TEXT),
        video_url=sanitize_url(request.data.get('video_url', ''), max_length=MAX_URL),
        website_url=sanitize_url(request.data.get('website_url', ''), max_length=MAX_URL),
        image_url=sanitize_url(request.data.get('image_url', ''), max_length=MAX_URL),
        price=request.data['price'],
        category=sanitize_text(request.data.get('category', ''), max_length=MAX_SHORT_TEXT),
        is_active=request.data.get('is_active', True),
    )
    return Response({'id': item.id, 'detail': 'Portfolio item created.'}, status=201)


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_webdev_detail(request, item_id):
    try:
        item = WebDevPortfolio.objects.get(pk=item_id)
    except WebDevPortfolio.DoesNotExist:
        return Response({'detail': 'Portfolio item not found.'}, status=404)

    if request.method == 'GET':
        return Response({
            'id': item.id,
            'title': item.title,
            'description': item.description,
            'video_url': item.video_url,
            'website_url': item.website_url,
            'image_url': item.image_url,
            'price': str(item.price),
            'category': item.category,
            'is_active': item.is_active,
        })

    if request.method == 'PATCH':
        if 'title' in request.data:
            item.title = sanitize_text(request.data['title'], max_length=MAX_SHORT_TEXT)
        if 'description' in request.data:
            item.description = sanitize_text(request.data['description'], max_length=MAX_MEDIUM_TEXT)
        if 'video_url' in request.data:
            item.video_url = sanitize_url(request.data['video_url'], max_length=MAX_URL)
        if 'website_url' in request.data:
            item.website_url = sanitize_url(request.data['website_url'], max_length=MAX_URL)
        if 'image_url' in request.data:
            item.image_url = sanitize_url(request.data['image_url'], max_length=MAX_URL)
        if 'price' in request.data:
            item.price = request.data['price']
        if 'category' in request.data:
            item.category = sanitize_text(request.data['category'], max_length=MAX_SHORT_TEXT)
        if 'is_active' in request.data:
            item.is_active = request.data['is_active']
        item.save()
        return Response({'detail': 'Portfolio item updated.'})

    if request.method == 'DELETE':
        item.delete()
        return Response({'detail': 'Portfolio item deleted.'}, status=204)


# ---------------------------------------------------------------------------
# Email
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_send_email(request):
    """Send email to specific users or all users.

    Expects:
      subject: str
      html_body: str (rich HTML content from editor)
      recipient_type: 'all' | 'selected'
      user_ids: list[int]  (required when recipient_type='selected')
    """
    subject = sanitize_text(request.data.get('subject', ''), max_length=MAX_SHORT_TEXT)
    html_body = request.data.get('html_body', '').strip()  # Admin-curated HTML content; kept as-is
    recipient_type = request.data.get('recipient_type', 'selected')
    user_ids = request.data.get('user_ids', [])

    if not subject:
        return Response({'detail': 'Subject is required.'}, status=400)
    if not html_body:
        return Response({'detail': 'Email body is required.'}, status=400)

    # Resolve recipients
    if recipient_type == 'all':
        recipients = list(
            User.objects.filter(is_active=True)
            .exclude(email='')
            .values_list('email', flat=True)
        )
    else:
        if not user_ids:
            return Response({'detail': 'No recipients selected.'}, status=400)
        recipients = list(
            User.objects.filter(id__in=user_ids, is_active=True)
            .exclude(email='')
            .values_list('email', flat=True)
        )

    if not recipients:
        return Response({'detail': 'No valid recipients found.'}, status=400)

    # Wrap in a simple HTML template
    full_html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:600px;margin:20px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:24px 32px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;">{subject}</h1>
    </div>
    <div style="padding:28px 32px;color:#333333;font-size:15px;line-height:1.7;">
      {html_body}
    </div>
    <div style="padding:16px 32px;border-top:1px solid #eee;text-align:center;">
      <p style="margin:0;color:#999;font-size:12px;">Sent from WicePlatform</p>
    </div>
  </div>
</body>
</html>"""

    # Send — use BCC for bulk to protect privacy
    failed = 0
    sent = 0
    batch_size = 50
    from_email = django_settings.DEFAULT_FROM_EMAIL

    for i in range(0, len(recipients), batch_size):
        batch = recipients[i:i + batch_size]
        try:
            email = EmailMessage(
                subject=subject,
                body=full_html,
                from_email=from_email,
                to=[from_email],
                bcc=batch,
            )
            email.content_subtype = 'html'
            email.send(fail_silently=False)
            sent += len(batch)
        except Exception as e:
            logger.error(f"Email batch send failed: {e}")
            failed += len(batch)

    if failed and not sent:
        return Response({'detail': 'Failed to send emails. Check email configuration.'}, status=500)

    msg = f'Email sent to {sent} recipient{"s" if sent != 1 else ""}.'
    if failed:
        msg += f' {failed} failed.'
    return Response({'detail': msg, 'sent': sent, 'failed': failed})



# ---------------------------------------------------------------------------
# Admin Deposits — all credit transactions across all users
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_deposits(request):
    from wallet.models import Transaction
    txns = (
        Transaction.objects
        .filter(transaction_type='credit')
        .select_related('wallet__user')
        .order_by('-created_at')[:500]
    )
    data = []
    for t in txns:
        user = t.wallet.user
        # Infer deposit method from description / reference
        desc = t.description or ''
        ref = t.reference or ''
        if 'korapay' in desc.lower() or (ref and not ref.startswith('admin')):
            method = 'Korapay'
        elif 'crypto' in desc.lower() or 'bitcoin' in desc.lower() or 'usdt' in desc.lower():
            method = 'Crypto'
        elif 'admin' in desc.lower() or not ref:
            method = f'Manual — {desc}' if desc else 'Manual Credit'
        else:
            method = desc or 'Unknown'

        data.append({
            'id': t.id,
            'user_email': user.email,
            'user_id': user.id,
            'user_name': user.get_full_name() or user.email,
            'amount': str(t.amount),
            'description': desc,
            'reference': ref,
            'method': method,
            'status': t.status,
            'created_at': t.created_at.isoformat(),
        })
    return Response(data)


# ---------------------------------------------------------------------------
# Admin: Crypto Deposit Management
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_crypto_deposits(request):
    from wallet.models import CryptoDeposit
    status_filter = request.query_params.get('status')
    qs = CryptoDeposit.objects.select_related('user').order_by('-created_at')
    if status_filter:
        qs = qs.filter(status=status_filter)
    data = [{
        'id': d.id,
        'user_id': d.user.id,
        'user_email': d.user.email,
        'user_name': d.user.get_full_name() or d.user.email,
        'amount_usd': str(d.amount_usd) if d.amount_usd is not None else None,
        'amount_ngn': str(d.amount_ngn),
        'crypto_name': d.crypto_name,
        'transaction_hash': d.transaction_hash,
        'status': d.status,
        'admin_note': d.admin_note,
        'created_at': d.created_at.isoformat(),
        'updated_at': d.updated_at.isoformat(),
    } for d in qs[:200]]
    return Response(data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_crypto_deposit_action(request, deposit_id):
    """Confirm or reject a pending crypto deposit."""
    from wallet.models import CryptoDeposit
    try:
        dep = CryptoDeposit.objects.select_related('user__wallet').get(pk=deposit_id)
    except CryptoDeposit.DoesNotExist:
        return Response({'detail': 'Deposit not found.'}, status=404)

    if dep.status != 'pending':
        return Response({'detail': f'Deposit is already {dep.status}.'}, status=400)

    action = request.data.get('action')  # 'confirm' or 'reject'
    admin_note = sanitize_text((request.data.get('admin_note') or ''), max_length=MAX_MEDIUM_TEXT)

    if action == 'confirm':
        dep.status = 'completed'
        dep.admin_note = admin_note
        dep.save()
        # Credit wallet
        wallet = dep.user.wallet
        wallet.credit(
            amount=dep.amount_ngn,
            description=f'Crypto deposit — {dep.crypto_name}',
            reference=f'CRYPTO-{dep.id}-{dep.transaction_hash[:12]}',
        )
        send_crypto_deposit_status_email(dep.user, dep, 'confirm')
        return Response({'detail': f'Deposit confirmed. ₦{dep.amount_ngn} credited to {dep.user.email}.'})

    elif action == 'reject':
        dep.status = 'rejected'
        dep.admin_note = admin_note or 'Rejected by admin.'
        dep.save()
        send_crypto_deposit_status_email(dep.user, dep, 'reject')
        return Response({'detail': f'Deposit rejected.'})

    return Response({'detail': 'action must be "confirm" or "reject".'}, status=400)


# ---------------------------------------------------------------------------
# Security — IP logs & banned IPs
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_ip_logs(request):
    """Recent IP activity log (login attempts, registrations)."""
    ip_filter = request.query_params.get('ip', '').strip()
    qs = IPLog.objects.select_related('user').all()
    if ip_filter:
        qs = qs.filter(ip_address__icontains=ip_filter)
    data = [{
        'id': log.id,
        'ip_address': log.ip_address,
        'action': log.action,
        'user_email': log.user.email if log.user else None,
        'user_id': log.user.id if log.user else None,
        'user_agent': log.user_agent,
        'created_at': log.created_at.isoformat(),
    } for log in qs[:500]]
    return Response(data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_banned_ips(request):
    """List or add banned IPs."""
    if request.method == 'GET':
        bans = BannedIP.objects.select_related('banned_by').all()
        data = [{
            'id': b.id,
            'ip_address': b.ip_address,
            'reason': b.reason,
            'banned_by': b.banned_by.email if b.banned_by else 'System',
            'created_at': b.created_at.isoformat(),
        } for b in bans]
        return Response(data)

    # POST — ban an IP
    ip = (request.data.get('ip_address') or '').strip()
    reason = sanitize_text((request.data.get('reason') or ''), max_length=MAX_MEDIUM_TEXT)
    if not ip:
        return Response({'detail': 'ip_address is required.'}, status=400)

    # Validate IP format
    import ipaddress
    try:
        ipaddress.ip_address(ip)
    except ValueError:
        return Response({'detail': 'Invalid IP address format.'}, status=400)

    obj, created = BannedIP.objects.get_or_create(
        ip_address=ip,
        defaults={'reason': reason, 'banned_by': request.user},
    )
    if not created:
        return Response({'detail': 'This IP is already banned.'}, status=409)

    # Invalidate cache immediately
    from django.core.cache import cache
    cache.delete(f'banned_ip:{ip}')

    return Response({'detail': f'{ip} has been banned.', 'id': obj.id}, status=201)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_banned_ip_detail(request, ban_id):
    """Unban an IP."""
    try:
        ban = BannedIP.objects.get(pk=ban_id)
    except BannedIP.DoesNotExist:
        return Response({'detail': 'Not found.'}, status=404)

    ip = ban.ip_address
    ban.delete()

    # Invalidate cache immediately
    from django.core.cache import cache
    cache.delete(f'banned_ip:{ip}')

    return Response({'detail': f'{ip} has been unbanned.'})


# ---------------------------------------------------------------------------
# Service Catalog — Boosting (BoostingServiceSnapshot)
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_catalog_boosting(request):
    """List all synced boosting services with is_active toggle state."""
    from api_integrations.models import BoostingServiceSnapshot
    platform = request.query_params.get('platform', '')
    qs = BoostingServiceSnapshot.objects.all().order_by('platform', 'category', 'name')
    if platform:
        qs = qs.filter(platform=platform)
    data = [{
        'id': s.id,
        'external_id': s.external_id,
        'name': s.name,
        'service_type': s.service_type,
        'platform': s.platform,
        'category': s.category,
        'cost_per_k_ngn': str(s.cost_per_k_ngn),
        'min_quantity': s.min_quantity,
        'max_quantity': s.max_quantity,
        'refill': s.refill,
        'cancel': s.cancel,
        'is_active': s.is_active,
        'last_synced': s.last_synced.isoformat(),
    } for s in qs]
    return Response(data)


def _sync_boosting_service(svc):
    """Create or update a BoostingService record from a BoostingServiceSnapshot."""
    from decimal import Decimal, ROUND_UP
    from services.models import BoostingService
    platform_settings = PlatformSettings.load()
    markup = Decimal('1') + (platform_settings.boosting_markup_percent / Decimal('100'))
    price_per_k = (svc.cost_per_k_ngn * markup).quantize(Decimal('0.01'), rounding=ROUND_UP)
    if svc.is_active:
        BoostingService.objects.update_or_create(
            catalog_snapshot_id=svc.external_id,
            defaults={
                'name': svc.name,
                'platform': svc.platform,
                'category': svc.category or 'Other',
                'price_per_k': price_per_k,
                'min_quantity': svc.min_quantity,
                'max_quantity': svc.max_quantity,
                'is_active': True,
            }
        )
    else:
        from services.models import BoostingService
        BoostingService.objects.filter(catalog_snapshot_id=svc.external_id).update(is_active=False)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_catalog_boosting_detail(request, service_id):
    """Toggle is_active for a boosting service snapshot; syncs to Manage Services."""
    from api_integrations.models import BoostingServiceSnapshot
    from django.core.cache import cache
    try:
        svc = BoostingServiceSnapshot.objects.get(pk=service_id)
    except BoostingServiceSnapshot.DoesNotExist:
        return Response({'detail': 'Service not found.'}, status=404)

    if 'is_active' in request.data:
        svc.is_active = bool(request.data['is_active'])
        svc.save(update_fields=['is_active'])
        cache.delete('rss_services_db_v1')
        _sync_boosting_service(svc)

    return Response({'id': svc.id, 'is_active': svc.is_active})


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_catalog_boosting_bulk(request):
    """Bulk toggle is_active for multiple boosting service snapshots."""
    from api_integrations.models import BoostingServiceSnapshot
    from django.core.cache import cache
    ids = request.data.get('ids', [])
    is_active = bool(request.data.get('is_active', False))

    if not ids:
        return Response({'detail': 'ids list is required.'}, status=400)

    updated = BoostingServiceSnapshot.objects.filter(pk__in=ids).update(is_active=is_active)
    cache.delete('rss_services_db_v1')

    # Sync each affected snapshot to BoostingService
    for svc in BoostingServiceSnapshot.objects.filter(pk__in=ids):
        _sync_boosting_service(svc)

    return Response({'updated': updated, 'is_active': is_active})


# ---------------------------------------------------------------------------
# Service Catalog — SMS Countries (SMSCountrySnapshot)
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_catalog_sms_countries(request):
    """List all synced SMS countries with is_active toggle state."""
    from api_integrations.models import SMSCountrySnapshot
    qs = SMSCountrySnapshot.objects.all().order_by('name')
    data = [{
        'id': c.id,
        'external_id': c.external_id,
        'name': c.name,
        'short_name': c.short_name,
        'dial_code': c.dial_code,
        'is_active': c.is_active,
        'last_synced': c.last_synced.isoformat(),
    } for c in qs]
    return Response(data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_catalog_sms_country_detail(request, country_id):
    """Toggle is_active for an SMS country snapshot."""
    from api_integrations.models import SMSCountrySnapshot
    from django.core.cache import cache
    try:
        obj = SMSCountrySnapshot.objects.get(pk=country_id)
    except SMSCountrySnapshot.DoesNotExist:
        return Response({'detail': 'Country not found.'}, status=404)

    if 'is_active' in request.data:
        obj.is_active = bool(request.data['is_active'])
        obj.save(update_fields=['is_active'])
        cache.delete('smspool_countries')

    return Response({'id': obj.id, 'is_active': obj.is_active})


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_catalog_sms_countries_bulk(request):
    """Bulk toggle is_active for SMS country snapshots."""
    from api_integrations.models import SMSCountrySnapshot
    from django.core.cache import cache
    ids = request.data.get('ids', [])
    is_active = bool(request.data.get('is_active', False))
    if not ids:
        return Response({'detail': 'ids list is required.'}, status=400)
    updated = SMSCountrySnapshot.objects.filter(pk__in=ids).update(is_active=is_active)
    cache.delete('smspool_countries')
    return Response({'updated': updated, 'is_active': is_active})


# ---------------------------------------------------------------------------
# Service Catalog — SMS Services (SMSServiceSnapshot)
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_catalog_sms_services(request):
    """List all synced SMS services with is_active toggle state."""
    from api_integrations.models import SMSServiceSnapshot
    qs = SMSServiceSnapshot.objects.all().order_by('name')
    data = [{
        'id': s.id,
        'external_id': s.external_id,
        'name': s.name,
        'short_name': s.short_name,
        'is_active': s.is_active,
        'last_synced': s.last_synced.isoformat(),
    } for s in qs]
    return Response(data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_catalog_sms_service_detail(request, sms_service_id):
    """Toggle is_active for an SMS service snapshot."""
    from api_integrations.models import SMSServiceSnapshot
    from django.core.cache import cache
    try:
        obj = SMSServiceSnapshot.objects.get(pk=sms_service_id)
    except SMSServiceSnapshot.DoesNotExist:
        return Response({'detail': 'Service not found.'}, status=404)

    if 'is_active' in request.data:
        obj.is_active = bool(request.data['is_active'])
        obj.save(update_fields=['is_active'])
        cache.delete('smspool_services')

    return Response({'id': obj.id, 'is_active': obj.is_active})


@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_catalog_sms_services_bulk(request):
    """Bulk toggle is_active for SMS service snapshots."""
    from api_integrations.models import SMSServiceSnapshot
    from django.core.cache import cache
    ids = request.data.get('ids', [])
    is_active = bool(request.data.get('is_active', False))
    if not ids:
        return Response({'detail': 'ids list is required.'}, status=400)
    updated = SMSServiceSnapshot.objects.filter(pk__in=ids).update(is_active=is_active)
    cache.delete('smspool_services')
    return Response({'updated': updated, 'is_active': is_active})


# ---------------------------------------------------------------------------
# Service Catalog — Manual Sync (runs sync tasks inline, no Celery required)
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_catalog_sync(request):
    """Manually trigger service catalog sync from external APIs.
    Runs synchronously so Celery is not required for an initial sync.
    """
    target = request.data.get('target', 'all')  # 'boosting', 'sms', or 'all'
    results = {}

    if target in ('boosting', 'all'):
        try:
            from api_integrations.tasks import sync_boosting_services
            result = sync_boosting_services()
            results['boosting'] = result
        except Exception as e:
            logger.error(f'Manual boosting sync failed: {e}')
            results['boosting'] = f'Error: {e}'

    if target in ('sms', 'all'):
        try:
            from api_integrations.tasks import sync_sms_services
            result = sync_sms_services()
            results['sms'] = result
        except Exception as e:
            logger.error(f'Manual SMS sync failed: {e}')
            results['sms'] = f'Error: {e}'

    return Response(results)


# ---------------------------------------------------------------------------
# Announcements CRUD
# ---------------------------------------------------------------------------

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_announcements(request):
    from notifications.models import Announcement

    if request.method == 'GET':
        announcements = Announcement.objects.all()
        data = [{
            'id': a.id,
            'title': a.title,
            'body': a.body,
            'is_active': a.is_active,
            'created_at': a.created_at.isoformat(),
            'updated_at': a.updated_at.isoformat(),
        } for a in announcements]
        return Response(data)

    # POST — create new announcement
    title = sanitize_text(request.data.get('title', ''), max_length=MAX_SHORT_TEXT)
    body = sanitize_text(request.data.get('body', ''), max_length=MAX_LONG_TEXT)
    if not title or not body:
        return Response({'detail': 'title and body are required.'}, status=400)

    announcement = Announcement.objects.create(
        title=title,
        body=body,
        is_active=request.data.get('is_active', True),
    )
    return Response({
        'id': announcement.id,
        'title': announcement.title,
        'body': announcement.body,
        'is_active': announcement.is_active,
        'created_at': announcement.created_at.isoformat(),
        'updated_at': announcement.updated_at.isoformat(),
    }, status=201)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_announcement_detail(request, announcement_id):
    from notifications.models import Announcement

    try:
        announcement = Announcement.objects.get(pk=announcement_id)
    except Announcement.DoesNotExist:
        return Response({'detail': 'Announcement not found.'}, status=404)

    if request.method == 'DELETE':
        announcement.delete()
        return Response({'detail': 'Announcement deleted.'})

    # PATCH
    if 'title' in request.data:
        announcement.title = sanitize_text(request.data['title'], max_length=MAX_SHORT_TEXT)
    if 'body' in request.data:
        announcement.body = sanitize_text(request.data['body'], max_length=MAX_LONG_TEXT)
    if 'is_active' in request.data:
        announcement.is_active = bool(request.data['is_active'])
    announcement.save()
    return Response({
        'id': announcement.id,
        'title': announcement.title,
        'body': announcement.body,
        'is_active': announcement.is_active,
        'created_at': announcement.created_at.isoformat(),
        'updated_at': announcement.updated_at.isoformat(),
    })


# ---------------------------------------------------------------------------
# API Call Logs
# ---------------------------------------------------------------------------

@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated, IsAdminUser])
def admin_api_logs(request):
    from api_integrations.models import APICallLog

    if request.method == 'DELETE':
        # Clear all logs (or filtered by provider)
        provider = request.query_params.get('provider')
        qs = APICallLog.objects.all()
        if provider:
            qs = qs.filter(provider=provider)
        count, _ = qs.delete()
        return Response({'detail': f'Deleted {count} log entries.'})

    # GET — paginated list with filters
    qs = APICallLog.objects.all()

    provider = request.query_params.get('provider')
    if provider:
        qs = qs.filter(provider=provider)

    success_filter = request.query_params.get('success')
    if success_filter == 'true':
        qs = qs.filter(success=True)
    elif success_filter == 'false':
        qs = qs.filter(success=False)

    action = request.query_params.get('action')
    if action:
        qs = qs.filter(action__icontains=action)

    triggered_by = request.query_params.get('triggered_by')
    if triggered_by:
        qs = qs.filter(triggered_by__icontains=triggered_by)

    # Summary stats
    total = APICallLog.objects.count()
    total_success = APICallLog.objects.filter(success=True).count()
    total_fail = APICallLog.objects.filter(success=False).count()

    # Pagination
    try:
        page = max(1, int(request.query_params.get('page', 1)))
        page_size = min(100, max(10, int(request.query_params.get('page_size', 50))))
    except (ValueError, TypeError):
        page = 1
        page_size = 50

    total_filtered = qs.count()
    offset = (page - 1) * page_size
    logs = qs[offset:offset + page_size]

    data = []
    for log in logs:
        data.append({
            'id': log.id,
            'provider': log.provider,
            'action': log.action,
            'endpoint': log.endpoint,
            'request_data': log.request_data,
            'response_data': log.response_data,
            'http_status': log.http_status,
            'success': log.success,
            'error_message': log.error_message,
            'duration_ms': log.duration_ms,
            'triggered_by': log.triggered_by,
            'created_at': log.created_at.isoformat(),
        })

    return Response({
        'summary': {
            'total': total,
            'success': total_success,
            'failed': total_fail,
        },
        'total': total_filtered,
        'page': page,
        'page_size': page_size,
        'results': data,
    })
