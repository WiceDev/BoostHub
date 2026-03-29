from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('wallet', '0002_add_crypto_deposit'),
    ]

    operations = [
        migrations.AddField(
            model_name='cryptodeposit',
            name='amount_usd',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True),
        ),
    ]
