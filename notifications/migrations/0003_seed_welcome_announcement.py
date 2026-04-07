from django.db import migrations


WELCOME_BODY = (
    "Welcome to PriveBoost and this is our first week of launch! "
    "We hope to provide you with the best services ranging from social media boosting, "
    "verification numbers, social media accounts, gift cards, to web development — and much more to come.\n\n"
    "If you have a problem or something you feel isn't right with the site, kindly reach out to support "
    "or create a ticket. We will be more than willing to assist you all the way.\n\n"
    "Thanks for joining us and we look forward to serving you so much better."
)


def seed_announcement(apps, schema_editor):
    Announcement = apps.get_model('notifications', 'Announcement')
    Announcement.objects.create(
        title='Welcome to PriveBoost 🎉',
        body=WELCOME_BODY,
        is_active=True,
    )


def remove_announcement(apps, schema_editor):
    Announcement = apps.get_model('notifications', 'Announcement')
    Announcement.objects.filter(title='Welcome to PriveBoost 🎉').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0002_announcement'),
    ]

    operations = [
        migrations.RunPython(seed_announcement, remove_announcement),
    ]
