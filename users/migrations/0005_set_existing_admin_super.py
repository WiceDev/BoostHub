"""Set existing is_staff users to super_admin role."""
from django.db import migrations


def set_super_admin(apps, schema_editor):
    User = apps.get_model('users', 'User')
    User.objects.filter(is_staff=True, admin_role='').update(admin_role='super_admin')


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0004_user_admin_role_admin_permissions'),
    ]

    operations = [
        migrations.RunPython(set_super_admin, migrations.RunPython.noop),
    ]
