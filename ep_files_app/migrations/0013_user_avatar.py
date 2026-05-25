from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ep_files_app', '0012_file_report'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='avatar',
            field=models.ImageField(blank=True, null=True, upload_to='avatars'),
        ),
    ]
