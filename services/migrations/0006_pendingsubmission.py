import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('services', '0005_boostingservice_catalog_snapshot_id_and_more'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PendingSubmission',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('submission_type', models.CharField(
                    choices=[
                        ('boosting_service', 'Boosting Service'),
                        ('sms_service', 'SMS/Number Service'),
                        ('social_account', 'Social Media Account'),
                        ('gift', 'Gift Item'),
                        ('webdev_portfolio', 'Web Dev Portfolio'),
                    ],
                    max_length=30,
                )),
                ('data', models.JSONField(help_text='Serialized service data submitted by the admin')),
                ('status', models.CharField(
                    choices=[('pending', 'Pending Review'), ('approved', 'Approved'), ('rejected', 'Rejected')],
                    default='pending', max_length=20,
                )),
                ('review_note', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('submitted_by', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='pending_submissions',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('reviewed_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='reviewed_submissions',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
