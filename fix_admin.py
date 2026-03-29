import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from users.models import User

email = 'admin@admin.com'
password = 'admin12345678'

u, created = User.objects.get_or_create(email=email, defaults={'username': 'admin'})
u.set_password(password)
u.is_staff = True
u.is_superuser = True
u.is_verified = True
u.save()
print(f"{'Created' if created else 'Updated'} admin: {u.email}")
