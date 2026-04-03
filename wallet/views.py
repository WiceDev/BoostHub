import json
from decimal import Decimal
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.http import HttpResponse
from django.db.models import Sum
from .models import Transaction
from .paystack import verify_webhook_signature

REFERRAL_DEPOSIT_THRESHOLD = Decimal('10000')
REFERRAL_BONUS_AMOUNT = Decimal('2000')


@csrf_exempt
@require_POST
def paystack_webhook(request):
    """
    Paystack calls this URL automatically when a payment is made.
    This is the REAL confirmation - not the redirect.
    """
    signature = request.headers.get('X-Paystack-Signature', '')
    payload_body = request.body
    if not verify_webhook_signature(payload_body, signature):
        return HttpResponse(status=400)
    try:
        payload = json.loads(payload_body)
        event = payload.get('event')
        if event == 'charge.success':
            data = payload['data']
            reference = data['reference']
            amount_kobo = data['amount']
            amount_naira = amount_kobo / 100
            email = data['customer']['email']
            # Skip if already processed
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.select_related('referred_by', 'wallet').get(email=email)
                if Transaction.objects.filter(reference=reference, wallet=user.wallet).exists():
                    return HttpResponse(status=200)
                user.wallet.credit(
                    amount=amount_naira,
                    description='Wallet deposit via Paystack (webhook)',
                    reference=reference
                )
                # ── Referral bonus check ──────────────────────────────────
                # If this user was referred and bonus hasn't been paid yet,
                # check if their cumulative deposits have now reached ₦10,000.
                if user.referred_by and not user.referral_bonus_paid:
                    total_deposited = user.wallet.transactions.filter(
                        transaction_type='credit', status='completed'
                    ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
                    if total_deposited >= REFERRAL_DEPOSIT_THRESHOLD:
                        user.referred_by.wallet.credit(
                            amount=REFERRAL_BONUS_AMOUNT,
                            description=f'Referral bonus — {user.email} reached ₦10,000 in deposits',
                        )
                        user.referral_bonus_paid = True
                        user.save(update_fields=['referral_bonus_paid'])
            except User.DoesNotExist:
                pass
    except (json.JSONDecodeError, KeyError):
        return HttpResponse(status=400)
    return HttpResponse(status=200)
