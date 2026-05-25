from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ep_files_app', '0014_merge_file_trash_user_avatar'),
    ]

    operations = [
        migrations.AddField(
            model_name='folder',
            name='deleted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='folder',
            name='is_deleted',
            field=models.BooleanField(db_index=True, default=False),
        ),
    ]
