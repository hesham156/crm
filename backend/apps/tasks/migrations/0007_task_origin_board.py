from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0006_task_attachment_add_url_and_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="task",
            name="origin_board",
            field=models.ForeignKey(
                blank=True,
                help_text="The board where this task was originally created",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="originated_tasks",
                to="tasks.board",
            ),
        ),
    ]
