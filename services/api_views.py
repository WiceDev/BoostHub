from django.conf import settings as django_settings
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework import status

from .models import SocialMediaAccount, Gift, WebDevPortfolio
from orders.services import create_order


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_gifts(request):
    """List active gifts for users."""
    gifts = Gift.objects.filter(is_active=True).order_by('category', 'name')
    data = [{
        'id': g.id,
        'name': g.name,
        'description': g.description,
        'price': str(g.price),
        'category': g.category,
        'category_display': g.get_category_display(),
        'emoji': g.emoji,
        'color': g.color,
        'image_url': g.image_url,
        'delivery_days': g.delivery_days,
        'notes': g.notes,
        'rating': str(g.rating),
    } for g in gifts]
    return Response(data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_gift_detail(request, gift_id):
    """Get a single active gift by ID."""
    try:
        gift = Gift.objects.get(pk=gift_id, is_active=True)
    except Gift.DoesNotExist:
        return Response({'detail': 'Gift not found.'}, status=404)
    return Response({
        'id': gift.id,
        'name': gift.name,
        'description': gift.description,
        'price': str(gift.price),
        'category': gift.category,
        'category_display': gift.get_category_display(),
        'emoji': gift.emoji,
        'color': gift.color,
        'image_url': gift.image_url,
        'delivery_days': gift.delivery_days,
        'notes': gift.notes,
        'rating': str(gift.rating),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_webdev_portfolio(request):
    """List active web development portfolio items."""
    items = WebDevPortfolio.objects.filter(is_active=True).order_by('-created_at')
    data = [{
        'id': item.id,
        'title': item.title,
        'description': item.description,
        'video_url': item.video_url,
        'website_url': item.website_url,
        'image_url': item.image_url,
        'price': str(item.price),
        'category': item.category,
    } for item in items]
    return Response(data)


@api_view(['GET'])
@permission_classes([AllowAny])
def api_public_settings(request):
    """Public platform settings (no auth required)."""
    return Response({
        'whatsapp': getattr(django_settings, 'PLATFORM_WHATSAPP', ''),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def api_accounts_list(request):
    """List active social media accounts grouped by platform."""
    accounts = SocialMediaAccount.objects.filter(is_active=True).order_by('platform', 'service_name')
    data = [{
        'id': a.id,
        'platform': a.platform,
        'service_name': a.service_name,
        'description': a.description,
        'price': str(a.price),
        'notes': a.notes,
        'required_fields': a.required_fields,
    } for a in accounts]
    return Response(data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def api_place_account_order(request):
    """Purchase a social media account."""
    from core.sanitizers import sanitize_dict

    account_id = request.data.get('account_id')
    user_details = request.data.get('user_details', {})
    if isinstance(user_details, dict):
        user_details = sanitize_dict(user_details)

    if not account_id:
        return Response({'detail': 'account_id is required.'}, status=400)

    try:
        account = SocialMediaAccount.objects.get(pk=account_id, is_active=True)
    except SocialMediaAccount.DoesNotExist:
        return Response({'detail': 'Account not found.'}, status=404)

    # Validate required fields provided by user
    missing = [f for f in (account.required_fields or []) if not user_details.get(f, '').strip()]
    if missing:
        return Response({'detail': f'Missing required fields: {", ".join(missing)}'}, status=400)

    try:
        order = create_order(
            user=request.user,
            service_type='social_account',
            service_name=f'{account.service_name} ({account.platform})',
            amount=account.price,
            cost_price=account.buying_price,
            external_data={
                'account_id': account.id,
                'platform': account.platform,
                'service_name': account.service_name,
                'user_details': user_details,
            },
        )
    except ValueError as e:
        return Response({'detail': str(e)}, status=400)

    return Response({
        'detail': 'Order placed successfully. We will deliver your account shortly.',
        'order_id': order.id,
    }, status=201)
