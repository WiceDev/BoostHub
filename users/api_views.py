from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import csrf_exempt
from django.db.models import Sum
from django.conf import settings as django_settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from .serializers import (
    UserSerializer, RegisterSerializer, LoginSerializer,
    ProfileUpdateSerializer, ChangePasswordSerializer,
)
from core.recaptcha import verify_recaptcha
from core.middleware import log_ip_action
from .verification import send_verification_email, send_welcome_email, verify_token
from .password_reset import send_reset_email, verify_reset_token
from .models import User
from .totp_utils import generate_secret, verify_code, provisioning_uri
from core.email_utils import notify_admin_new_user, send_password_changed_email


@api_view(['POST'])
@permission_classes([AllowAny])
def api_register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = serializer.save()
    login(request, user)
    log_ip_action(request, 'register', user=user)
    # Send verification email + notify admin
    send_verification_email(user, request)
    notify_admin_new_user(user)
    return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([AllowAny])
def api_verify_email(request):
    """Verify a user's email via signed token."""
    token = request.query_params.get('token', '')
    if not token:
        return Response({'detail': 'Missing token.'}, status=status.HTTP_400_BAD_REQUEST)

    user_id = verify_token(token)
    if user_id is None:
        return Response({'detail': 'Invalid or expired verification link.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    if user.is_verified:
        return Response({'detail': 'Email already verified.'})

    user.is_verified = True
    user.save(update_fields=['is_verified'])
    send_welcome_email(user)
    return Response({'detail': 'Email verified successfully.'})


@api_view(['POST'])
def api_resend_verification(request):
    """Resend verification email for the logged-in user."""
    if request.user.is_verified:
        return Response({'detail': 'Email already verified.'})
    send_verification_email(request.user, request)
    return Response({'detail': 'Verification email sent.'})


@api_view(['POST'])
@permission_classes([AllowAny])
def api_login(request):
    # Verify reCAPTCHA token
    recaptcha_token = request.data.get('recaptcha_token', '')
    if not verify_recaptcha(recaptcha_token, action='login'):
        return Response(
            {'detail': 'reCAPTCHA verification failed. Please try again.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    user = authenticate(
        request,
        username=serializer.validated_data['email'],
        password=serializer.validated_data['password'],
    )
    if user is None:
        log_ip_action(request, 'login_fail')
        return Response(
            {'detail': 'Invalid email or password.'},
            status=status.HTTP_401_UNAUTHORIZED,
        )

    # If this admin has 2FA enabled, hold the session pending TOTP verification
    if user.is_staff and user.totp_enabled:
        request.session['_2fa_pending_user_id'] = user.id
        request.session.modified = True
        return Response({'requires_2fa': True})

    login(request, user)
    log_ip_action(request, 'login_ok', user=user)
    return Response(UserSerializer(user).data)


@csrf_exempt
@api_view(['POST'])
@permission_classes([AllowAny])
def api_logout(request):
    logout(request)
    response = Response({'detail': 'Logged out successfully.'})
    response.delete_cookie('sessionid')
    response.delete_cookie('csrftoken')
    return response


@api_view(['GET'])
def api_me(request):
    return Response(UserSerializer(request.user).data)


@api_view(['PUT', 'PATCH'])
def api_update_profile(request):
    serializer = ProfileUpdateSerializer(
        request.user, data=request.data, partial=True
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(UserSerializer(request.user).data)


@api_view(['POST'])
def api_change_password(request):
    serializer = ChangePasswordSerializer(
        data=request.data, context={'request': request}
    )
    serializer.is_valid(raise_exception=True)
    request.user.set_password(serializer.validated_data['new_password'])
    request.user.save()
    login(request, request.user)
    send_password_changed_email(request.user)
    return Response({'detail': 'Password updated successfully.'})


@api_view(['POST'])
@permission_classes([AllowAny])
def api_forgot_password(request):
    """Send a password reset email. Always returns 200 to prevent user enumeration."""
    email = request.data.get('email', '').strip().lower()
    if email:
        try:
            user = User.objects.get(email=email)
            send_reset_email(user, request)
        except User.DoesNotExist:
            pass  # silently ignore unknown emails
    return Response({'detail': 'If that email is registered, a reset link has been sent.'})


@api_view(['GET'])
def api_referral_stats(request):
    """Return the current user's referral code, link, and referral stats."""
    user = request.user
    referrals = User.objects.filter(referred_by=user).select_related('wallet')

    # Count referred users whose total completed deposits have reached ₦10,000
    threshold = 10000
    bonus_per_referral = 2000
    qualified = 0
    for ref_user in referrals:
        try:
            total = ref_user.wallet.transactions.filter(
                transaction_type='credit', status='completed'
            ).aggregate(total=Sum('amount'))['total'] or 0
            if total >= threshold:
                qualified += 1
        except Exception:
            pass

    # Build referral link using FRONTEND_URL setting or a safe fallback
    frontend_url = getattr(django_settings, 'FRONTEND_URL', '').rstrip('/')
    if not frontend_url:
        frontend_url = 'https://priveboost.com'

    return Response({
        'referral_code': user.referral_code,
        'referral_link': f'{frontend_url}/signup?ref={user.referral_code}',
        'total_referred': referrals.count(),
        'qualified_referrals': qualified,
        'total_bonus_earned': qualified * bonus_per_referral,
        'bonus_per_referral': bonus_per_referral,
        'deposit_threshold': threshold,
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def api_reset_password(request):
    """Validate reset token and set new password."""
    token = request.data.get('token', '')
    new_password = request.data.get('new_password', '')

    if not token:
        return Response({'detail': 'Missing token.'}, status=status.HTTP_400_BAD_REQUEST)
    if len(new_password) < 8:
        return Response({'detail': 'Password must be at least 8 characters.'}, status=status.HTTP_400_BAD_REQUEST)

    user_id = verify_reset_token(token)
    if user_id is None:
        return Response({'detail': 'This reset link is invalid or has expired.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

    user.set_password(new_password)
    user.save()
    send_password_changed_email(user)
    return Response({'detail': 'Password reset successfully. You can now log in.'})


# ── Admin 2FA endpoints ──────────────────────────────────────────────────────

@api_view(['GET'])
def api_2fa_setup(request):
    """Return a fresh TOTP secret + provisioning URI for scanning with an authenticator app.
    Only available to staff accounts that do not yet have 2FA enabled."""
    if not request.user.is_staff:
        return Response({'detail': 'Not authorised.'}, status=status.HTTP_403_FORBIDDEN)
    if request.user.totp_enabled:
        return Response({'detail': '2FA is already enabled.'}, status=status.HTTP_400_BAD_REQUEST)

    # Generate (or reuse a pending) secret and stash it in session until confirmed
    secret = request.session.get('_2fa_pending_secret') or generate_secret()
    request.session['_2fa_pending_secret'] = secret
    request.session.modified = True

    return Response({
        'secret': secret,
        'otpauth_uri': provisioning_uri(secret, request.user.email),
    })


@api_view(['POST'])
def api_2fa_enable(request):
    """Confirm a TOTP code and permanently enable 2FA on the account."""
    if not request.user.is_staff:
        return Response({'detail': 'Not authorised.'}, status=status.HTTP_403_FORBIDDEN)
    if request.user.totp_enabled:
        return Response({'detail': '2FA is already enabled.'}, status=status.HTTP_400_BAD_REQUEST)

    secret = request.session.get('_2fa_pending_secret', '')
    if not secret:
        return Response({'detail': 'No pending setup found. Please restart the setup.'}, status=status.HTTP_400_BAD_REQUEST)

    code = request.data.get('code', '').strip()
    if not verify_code(secret, code):
        return Response({'detail': 'Invalid code. Please try again.'}, status=status.HTTP_400_BAD_REQUEST)

    request.user.totp_secret = secret
    request.user.totp_enabled = True
    request.user.save(update_fields=['totp_secret', 'totp_enabled'])
    del request.session['_2fa_pending_secret']
    return Response({'detail': '2FA enabled successfully.'})


@api_view(['POST'])
def api_2fa_disable(request):
    """Verify the current TOTP code and disable 2FA."""
    if not request.user.is_staff:
        return Response({'detail': 'Not authorised.'}, status=status.HTTP_403_FORBIDDEN)
    if not request.user.totp_enabled:
        return Response({'detail': '2FA is not enabled.'}, status=status.HTTP_400_BAD_REQUEST)

    code = request.data.get('code', '').strip()
    if not verify_code(request.user.totp_secret, code):
        return Response({'detail': 'Invalid code. Please try again.'}, status=status.HTTP_400_BAD_REQUEST)

    request.user.totp_secret = ''
    request.user.totp_enabled = False
    request.user.save(update_fields=['totp_secret', 'totp_enabled'])
    return Response({'detail': '2FA disabled.'})


@api_view(['POST'])
@permission_classes([AllowAny])
def api_2fa_verify_login(request):
    """Complete a pending 2FA login by verifying the TOTP code."""
    user_id = request.session.get('_2fa_pending_user_id')
    if not user_id:
        return Response({'detail': 'No pending 2FA session.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return Response({'detail': 'Session expired. Please log in again.'}, status=status.HTTP_400_BAD_REQUEST)

    code = request.data.get('code', '').strip()
    if not verify_code(user.totp_secret, code):
        return Response({'detail': 'Invalid code. Please try again.'}, status=status.HTTP_401_UNAUTHORIZED)

    del request.session['_2fa_pending_user_id']
    login(request, user)
    log_ip_action(request, 'login_ok', user=user)
    return Response(UserSerializer(user).data)
