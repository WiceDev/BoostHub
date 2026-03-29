from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('services', '0002_socialmediaaccount_webdevportfolio_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='socialmediaaccount',
            name='required_fields',
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='Field labels the buyer must fill in, e.g. ["Target Username", "Email"]',
            ),
        ),
    ]
