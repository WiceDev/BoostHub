import django, os, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()
from users.models import User

# Print all users for visibility
print("All users in DB:")
for u in User.objects.all():
    print(f"  {u.email} | staff={u.is_staff} | superuser={u.is_superuser} | verified={u.is_verified}")

# Promote any user whose email contains 'admin' or is the only user
users = User.objects.all()
if users.count() == 1:
    u = users.first()
    u.is_staff = True
    u.is_superuser = True
    u.is_verified = True
    u.save()
    print(f"Promoted single user to admin: {u.email}")
else:
    for u in User.objects.filter(is_superuser=True):
        u.is_verified = True
        u.save()
        print(f"Verified existing superuser: {u.email}")
