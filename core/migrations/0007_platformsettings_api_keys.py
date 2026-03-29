from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0006_bannedip_iplog'),
    ]

    operations = [
        migrations.AddField(
            model_name='platformsettings',
            name='paystack_secret_key',
            field=models.CharField(blank=True, default='', help_text='Overrides PAYSTACK_SECRET_KEY in .env', max_length=255),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='paystack_public_key',
            field=models.CharField(blank=True, default='', help_text='Overrides PAYSTACK_PUBLIC_KEY in .env', max_length=255),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='rss_api_key',
            field=models.CharField(blank=True, default='', help_text='Overrides REAL_SIMPLE_SOCIAL_API_KEY in .env', max_length=255),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='smspool_api_key',
            field=models.CharField(blank=True, default='', help_text='Overrides SMS_POOL_API_KEY in .env', max_length=255),
        ),
    ]
