import uuid
from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Transaction, CryptoDeposit
from .serializers import WalletSerializer, TransactionSerializer
from .paystack import initialize_payment


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
def api_deposit_paystack(request):
    """Initiate a Paystack payment and return the authorization URL."""
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

    reference = f"DEP-{uuid.uuid4().hex[:12].upper()}"
    # Build callback URL pointing to the React frontend
    callback_url = request.data.get(
        'callback_url',
        request.build_absolute_uri('/wallet/verify/') + f'?reference={reference}'
    )

    result = initialize_payment(
        email=request.user.email,
        amount_naira=amount,
        reference=reference,
        callback_url=callback_url,
    )

    if result.get('status'):
        return Response({
            'authorization_url': result['data']['authorization_url'],
            'reference': reference,
        })
    else:
        return Response(
            {'detail': result.get('message', 'Payment initialization failed.')},
            status=status.HTTP_502_BAD_GATEWAY,
        )


@api_view(['GET'])
def api_verify_deposit(request):
    """Verify a Paystack payment after redirect and return updated wallet."""
    from .paystack import verify_payment

    reference = request.query_params.get('reference')
    if not reference:
        return Response(
            {'detail': 'Missing payment reference.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if Transaction.objects.filter(reference=reference).exists():
        return Response(
            {'detail': 'This payment has already been processed.'},
            status=status.HTTP_409_CONFLICT,
        )

    result = verify_payment(reference)
    if result.get('status') and result['data']['status'] == 'success':
        amount_kobo = result['data']['amount']
        amount_naira = amount_kobo / 100
        wallet = request.user.wallet
        wallet.credit(
            amount=amount_naira,
            description='Wallet deposit via Paystack',
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
    amount_ngn = request.data.get('amount_ngn')
    amount_usd = request.data.get('amount_usd')
    transaction_hash = (request.data.get('transaction_hash') or '').strip()
    crypto_name = (request.data.get('crypto_name') or '').strip()

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
