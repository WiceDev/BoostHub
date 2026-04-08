import re
from rest_framework import serializers
from core.sanitizers import SanitizedCharField, sanitize_text, MAX_NAME, MAX_PHONE
from .models import User

_ALPHANUMERIC_RE = re.compile(r'^[a-zA-Z0-9_.-]+$')
_PHONE_RE = re.compile(r'^[+\d\s\-()]{0,30}$')
_NAME_RE = re.compile(r"^[a-zA-ZÀ-ÿ\s'\-\.]+$")


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    is_super_admin = serializers.BooleanField(read_only=True)
    is_service_admin = serializers.BooleanField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name',
            'phone', 'is_verified', 'is_staff', 'full_name', 'date_of_birth',
            'created_at', 'referral_code', 'totp_enabled',
            'admin_role', 'admin_permissions', 'is_super_admin', 'is_service_admin',
        ]
        read_only_fields = [
            'id', 'email', 'is_verified', 'is_staff', 'created_at', 'referral_code',
            'totp_enabled', 'admin_role', 'admin_permissions', 'is_super_admin', 'is_service_admin',
        ]

    def get_full_name(self, obj):
        return obj.get_full_name()


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    username = SanitizedCharField(max_length=150)
    first_name = SanitizedCharField(max_length=MAX_NAME)
    last_name = SanitizedCharField(max_length=MAX_NAME)
    password = serializers.CharField(write_only=True, min_length=8)
    referral_code = SanitizedCharField(max_length=12, required=False, allow_blank=True)

    def validate_email(self, value):
        if User.objects.filter(email=value.lower()).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return value.lower()

    def validate_username(self, value):
        if not _ALPHANUMERIC_RE.match(value):
            raise serializers.ValidationError('Username may only contain letters, numbers, dots, hyphens, and underscores.')
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError('This username is already taken.')
        return value

    def validate_first_name(self, value):
        if value and not _NAME_RE.match(value):
            raise serializers.ValidationError('Name contains invalid characters.')
        return value

    def validate_last_name(self, value):
        if value and not _NAME_RE.match(value):
            raise serializers.ValidationError('Name contains invalid characters.')
        return value

    def validate_referral_code(self, value):
        if not value:
            return ''
        code = value.strip().upper()
        if not User.objects.filter(referral_code=code).exists():
            raise serializers.ValidationError('Invalid referral code.')
        return code

    def create(self, validated_data):
        referral_code = validated_data.pop('referral_code', '')
        referred_by = None
        if referral_code:
            try:
                referred_by = User.objects.get(referral_code=referral_code)
            except User.DoesNotExist:
                pass
        return User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            password=validated_data['password'],
            referred_by=referred_by,
        )


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()


class ProfileUpdateSerializer(serializers.ModelSerializer):
    first_name = SanitizedCharField(max_length=MAX_NAME, required=False)
    last_name = SanitizedCharField(max_length=MAX_NAME, required=False)
    phone = SanitizedCharField(max_length=MAX_PHONE, required=False, allow_blank=True)

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'phone']

    def validate_first_name(self, value):
        if value and not _NAME_RE.match(value):
            raise serializers.ValidationError('Name contains invalid characters.')
        return value

    def validate_last_name(self, value):
        if value and not _NAME_RE.match(value):
            raise serializers.ValidationError('Name contains invalid characters.')
        return value

    def validate_phone(self, value):
        if value and not _PHONE_RE.match(value):
            raise serializers.ValidationError('Invalid phone number format.')
        return value


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField(min_length=8)

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value
