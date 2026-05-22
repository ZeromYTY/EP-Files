from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ep_files_app", "0010_user_storage_limit"),
    ]

    operations = [
        migrations.AddField(
            model_name="file",
            name="public_expires_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="folder",
            name="public_expires_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
