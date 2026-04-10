from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('services', '0006_pendingsubmission'),
    ]

    operations = [
        migrations.CreateModel(
            name='GiftImage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('image', models.ImageField(upload_to='gifts/')),
                ('position', models.PositiveIntegerField(default=0, help_text='Display order (lower = first)')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('gift', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='images', to='services.gift')),
            ],
            options={
                'ordering': ['position', 'id'],
            },
        ),
        migrations.CreateModel(
            name='WebDevMedia',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.FileField(upload_to='webdev/')),
                ('media_type', models.CharField(choices=[('image', 'Image'), ('video', 'Video')], max_length=10)),
                ('position', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('portfolio', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='media_files', to='services.webdevportfolio')),
            ],
            options={
                'ordering': ['position', 'id'],
            },
        ),
    ]
