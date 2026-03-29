import secrets
import string
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def _make_code():
    alphabet = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(alphabet) for _ in range(8))


def populate_referral_codes(apps, schema_editor):
    """Assign a unique referral code to every existing user."""
    User = apps.get_model('users', 'User')
    used = set()
    for user in User.objects.filter(referral_code=''):
        code = _make_code()
        while code in used or User.objects.filter(referral_code=code).exists():
            code = _make_code()
        used.add(code)
        user.referral_code = code
        user.save(update_fields=['referral_code'])


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        # 1. Add bonus_paid and referred_by first (no uniqueness issue)
        migrations.AddField(
            model_name='user',
            name='referral_bonus_paid',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='user',
            name='referred_by',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='referrals',
                to=settings.AUTH_USER_MODEL,
            ),
        ),
        # 2. Add referral_code as nullable/non-unique first
        migrations.AddField(
            model_name='user',
            name='referral_code',
            field=models.CharField(blank=True, max_length=12, default=''),
        ),
        # 3. Populate codes for existing users
        migrations.RunPython(populate_referral_codes, migrations.RunPython.noop),
        # 4. Now enforce uniqueness
        migrations.AlterField(
            model_name='user',
            name='referral_code',
            field=models.CharField(blank=True, max_length=12, unique=True),
        ),
    ]
