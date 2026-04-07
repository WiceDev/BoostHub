import uuid
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Transaction, CryptoDeposit
from .serializers import WalletSerializer, TransactionSerializer
from .korapay import initialize_checkout


@api_view(['GET'])
def api_wallet(request):
    wallet = request.user.wallet
    return Response(WalletSerializer(wallet).data)


@api_view(['GET'])
def api_transactions(request):
    wallet = request.user.wallet
    transactions = wallet.transactions.all()
    serializer = TransactionSerializer(transactions, many=True)
    return Response(serializer.data)


@api_view(['POST'])
def api_deposit_korapay(request):
    """Initiate a Korapay checkout and return the checkout URL."""
    try:
        amount = float(request.data.get('amount', 0))
    except (ValueError, TypeError):
        return Response(
            {'detail': 'Please enter a valid amount.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if amount < 100:
        return Response(
            {'detail': 'Minimum deposit amount is 100 NGN.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    from core.sanitizers import sanitize_url

    reference = f"DEP-{uuid.uuid4().hex[:12].upper()}"
    # Build redirect URL pointing to the React frontend deposit page
    default_redirect = request.build_absolute_uri('/dashboard/deposit') + f'?verify=true&reference={reference}'
    redirect_url = sanitize_url(
        request.data.get('callback_url', default_redirect)
    ) or default_redirect

    user = request.user
    customer_name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email.split('@')[0]

    result = initialize_checkout(
        reference=reference,
        amount_naira=amount,
        customer_email=user.email,
        customer_name=customer_name,
        redirect_url=redirect_url,
    )

    if result.get('status') and result.get('data', {}).get('checkout_url'):
        return Response({
            'checkout_url': result['data']['checkout_url'],
            'reference': reference,
        })
    else:
        return Response(
            {'detail': result.get('message', 'Payment initialization failed.')},
            status=status.HTTP_502_BAD_GATEWAY,
        )


@api_view(['GET'])
def api_verify_deposit(request):
    """Verify a Korapay payment after redirect and return updated wallet."""
    from .korapay import verify_charge

    reference = request.query_params.get('reference')
    if not reference:
        return Response(
            {'detail': 'Missing payment reference.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if Transaction.objects.filter(reference=reference, wallet__user=request.user).exists():
        return Response(
            {'detail': 'This payment has already been processed.'},
            status=status.HTTP_409_CONFLICT,
        )

    result = verify_charge(reference)
    if result.get('status') and result.get('data', {}).get('status') == 'success':
        amount_naira = float(result['data']['amount'])
        wallet = request.user.wallet
        wallet.credit(
            amount=amount_naira,
            description='Wallet deposit via Korapay',
            reference=reference,
        )
        return Response({
            'detail': f'{amount_naira:,.2f} NGN has been added to your wallet!',
            'wallet': WalletSerializer(wallet).data,
        })
    else:
        return Response(
            {'detail': 'Payment verification failed. Contact support if money was deducted.'},
            status=status.HTTP_400_BAD_REQUEST,
        )


@api_view(['POST'])
def api_submit_crypto_deposit(request):
    """User submits a crypto deposit claim — creates a pending CryptoDeposit."""
    from core.sanitizers import sanitize_text, MAX_HASH, MAX_SHORT_TEXT

    amount_ngn = request.data.get('amount_ngn')
    amount_usd = request.data.get('amount_usd')
    transaction_hash = sanitize_text(request.data.get('transaction_hash') or '', max_length=MAX_HASH)
    crypto_name = sanitize_text(request.data.get('crypto_name') or '', max_length=MAX_SHORT_TEXT)

    if not amount_ngn or not transaction_hash or not crypto_name:
        return Response(
            {'detail': 'amount_ngn, transaction_hash and crypto_name are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        amount_ngn = Decimal(str(amount_ngn))
        if amount_ngn <= 0:
            raise ValueError
    except (ValueError, Exception):
        return Response({'detail': 'Invalid amount.'}, status=status.HTTP_400_BAD_REQUEST)

    parsed_usd = None
    if amount_usd is not None:
        try:
            parsed_usd = Decimal(str(amount_usd))
            if parsed_usd <= 0:
                parsed_usd = None
        except Exception:
            parsed_usd = None

    if len(transaction_hash) < 10:
        return Response({'detail': 'Transaction hash is too short.'}, status=status.HTTP_400_BAD_REQUEST)

    if CryptoDeposit.objects.filter(transaction_hash=transaction_hash).exists():
        return Response(
            {'detail': 'This transaction hash has already been submitted.'},
            status=status.HTTP_409_CONFLICT,
        )

    dep = CryptoDeposit.objects.create(
        user=request.user,
        amount_usd=parsed_usd,
        amount_ngn=amount_ngn,
        crypto_name=crypto_name,
        transaction_hash=transaction_hash,
    )

    return Response({
        'detail': 'Deposit submitted. An admin will verify and credit your wallet shortly.',
        'id': dep.id,
        'status': dep.status,
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
def api_my_crypto_deposits(request):
    """Return the logged-in user's crypto deposit history."""
    deps = CryptoDeposit.objects.filter(user=request.user)
    data = [{
        'id': d.id,
        'amount_usd': str(d.amount_usd) if d.amount_usd is not None else None,
        'amount_ngn': str(d.amount_ngn),
        'crypto_name': d.crypto_name,
        'transaction_hash': d.transaction_hash,
        'status': d.status,
        'admin_note': d.admin_note,
        'created_at': d.created_at.isoformat(),
    } for d in deps]
    return Response(data)
