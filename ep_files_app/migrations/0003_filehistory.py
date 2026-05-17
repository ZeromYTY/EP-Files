# Generated migration for FileHistory model

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('ep_files_app', '0002_user_name'),
    ]

    operations = [
        migrations.CreateModel(
            name='FileHistory',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file_name', models.CharField(help_text='Имя файла на момент события', max_length=255)),
                ('event_type', models.CharField(choices=[('upload', 'Загрузка'), ('download', 'Скачивание'), ('rename', 'Переименование'), ('move', 'Перемещение'), ('delete', 'Удаление'), ('update', 'Обновление')], help_text='Тип события', max_length=20)),
                ('timestamp', models.DateTimeField(auto_now_add=True, help_text='Время события')),
                ('old_value', models.TextField(blank=True, help_text='Старое значение (для переименования/перемещения)', null=True)),
                ('new_value', models.TextField(blank=True, help_text='Новое значение (для переименования/перемещения)', null=True)),
                ('details', models.JSONField(blank=True, default=dict, help_text='Дополнительные детали события')),
                ('ip_address', models.GenericIPAddressField(blank=True, help_text='IP адрес пользователя', null=True)),
                ('file', models.ForeignKey(blank=True, help_text='Файл (может быть null если файл удален)', null=True, on_delete=django.db.models.deletion.CASCADE, related_name='history', to='ep_files_app.file')),
                ('user', models.ForeignKey(help_text='Пользователь, выполнивший действие', null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='file_actions', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'История файла',
                'verbose_name_plural': 'История файлов',
                'ordering': ['-timestamp'],
            },
        ),
        migrations.AddIndex(
            model_name='filehistory',
            index=models.Index(fields=['file', '-timestamp'], name='ep_files_ap_file_id_b8c9e5_idx'),
        ),
        migrations.AddIndex(
            model_name='filehistory',
            index=models.Index(fields=['user', '-timestamp'], name='ep_files_ap_user_id_a1b2c3_idx'),
        ),
        migrations.AddIndex(
            model_name='filehistory',
            index=models.Index(fields=['event_type', '-timestamp'], name='ep_files_ap_event_t_d4e5f6_idx'),
        ),
    ]
