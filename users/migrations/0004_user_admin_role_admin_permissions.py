from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_user_totp_enabled_user_totp_secret'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='admin_role',
            field=models.CharField(
                blank=True, choices=[('', 'Not Admin'), ('super_admin', 'Super Admin'), ('service_admin', 'Service Admin')],
                default='', help_text='super_admin = full access, service_admin = limited by admin_permissions',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='user',
            name='admin_permissions',
            field=models.JSONField(
                blank=True, default=list,
                help_text='List of permissions for service_admin, e.g. ["manage_gifts", "manage_accounts"]',
            ),
        ),
    ]
