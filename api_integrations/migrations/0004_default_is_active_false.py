"""Change is_active default to False on all snapshot models and deactivate existing records."""

from django.db import migrations, models


def deactivate_all_snapshots(apps, schema_editor):
    """Set all existing snapshot records to is_active=False."""
    BoostingServiceSnapshot = apps.get_model('api_integrations', 'BoostingServiceSnapshot')
    SMSCountrySnapshot = apps.get_model('api_integrations', 'SMSCountrySnapshot')
    SMSServiceSnapshot = apps.get_model('api_integrations', 'SMSServiceSnapshot')

    BoostingServiceSnapshot.objects.all().update(is_active=False)
    SMSCountrySnapshot.objects.all().update(is_active=False)
    SMSServiceSnapshot.objects.all().update(is_active=False)


class Migration(migrations.Migration):

    dependencies = [
        ('api_integrations', '0003_celerytasklog_userpurchaselog_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='boostingservicesnapshot',
            name='is_active',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AlterField(
            model_name='smscountrysnapshot',
            name='is_active',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AlterField(
            model_name='smsservicesnapshot',
            name='is_active',
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.RunPython(deactivate_all_snapshots, migrations.RunPython.noop),
    ]
