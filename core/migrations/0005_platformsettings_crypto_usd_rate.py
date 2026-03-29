from django.db import migrations, models
import django.core.validators


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_add_crypto_methods'),
    ]

    operations = [
        migrations.AddField(
            model_name='platformsettings',
            name='crypto_usd_rate',
            field=models.DecimalField(
                decimal_places=2,
                default=1600.0,
                help_text='USD to NGN rate applied specifically to crypto deposits',
                max_digits=10,
                validators=[django.core.validators.MinValueValidator(1)],
            ),
        ),
    ]
