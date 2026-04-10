from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0008_remove_platformsettings_paystack_public_key_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='platformsettings',
            name='gifts_enabled',
            field=models.BooleanField(default=False, help_text='Show Gifts page to users (off = Coming Soon)'),
        ),
        migrations.AddField(
            model_name='platformsettings',
            name='webdev_enabled',
            field=models.BooleanField(default=False, help_text='Show Web Development page to users (off = Coming Soon)'),
        ),
    ]
