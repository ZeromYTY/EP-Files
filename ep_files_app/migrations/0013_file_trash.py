from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ep_files_app', '0012_file_report'),
    ]

    operations = [
        migrations.AddField(
            model_name='file',
            name='deleted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='file',
            name='is_deleted',
            field=models.BooleanField(db_index=True, default=False),
        ),
    ]
