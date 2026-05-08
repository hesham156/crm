from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0006_task_attachment_add_url_and_type'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='recurrence_rule',
            field=models.CharField(
                choices=[
                    ('none', 'No Recurrence'),
                    ('daily', 'Daily'),
                    ('weekly', 'Weekly'),
                    ('monthly', 'Monthly'),
                    ('custom', 'Custom (every N days)'),
                ],
                default='none',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='task',
            name='recurrence_interval',
            field=models.PositiveIntegerField(default=1, help_text='Every N days (for custom)'),
        ),
        migrations.AddField(
            model_name='task',
            name='recurrence_end_date',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='task',
            name='is_recurring_template',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='task',
            name='recurring_parent',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='recurrences',
                to='tasks.task',
            ),
        ),
    ]
