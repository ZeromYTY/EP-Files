from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('ep_files_app', '0011_public_link_expiration'),
    ]

    operations = [
        migrations.CreateModel(
            name='FileReport',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file_name', models.CharField(max_length=255)),
                ('file_owner_email', models.EmailField(blank=True, default='', max_length=254)),
                ('public_token', models.CharField(blank=True, db_index=True, default='', max_length=100)),
                ('reporter_email', models.EmailField(blank=True, default='', max_length=254)),
                ('reason', models.CharField(max_length=120)),
                ('message', models.TextField(blank=True, default='')),
                ('status', models.CharField(choices=[('pending', 'На рассмотрении'), ('resolved', 'Решена')], default='pending', max_length=20)),
                ('admin_action', models.CharField(blank=True, choices=[('keep', 'Оставить файл'), ('disable_public', 'Отключить публичную ссылку'), ('delete_file', 'Удалить файл')], default='', max_length=30)),
                ('admin_note', models.TextField(blank=True, default='')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('resolved_at', models.DateTimeField(blank=True, null=True)),
                ('file', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reports', to='ep_files_app.file')),
                ('reviewed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reviewed_file_reports', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
