from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ep_files_app", "0009_alter_favoritefile_unique_together_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="storage_limit",
            field=models.BigIntegerField(default=104857600),
        ),
    ]
