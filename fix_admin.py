import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from users.models import User
u = User.objects.filter(is_superuser=True).first()
if u:
    u.is_staff = True
    u.is_verified = True
    u.save()
    print(f'Fixed: {u.email}')
else:
    print('No superuser found')
