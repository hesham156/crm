from django.db import migrations, models
import django.db.models.deletion
import uuid
from django.conf import settings


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ('tasks', '0008_custom_fields'),
    ]

    operations = [
        migrations.CreateModel(
            name='Sprint',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=200)),
                ('goal', models.TextField(blank=True)),
                ('status', models.CharField(
                    choices=[('planning', 'Planning'), ('active', 'Active'), ('completed', 'Completed')],
                    default='planning',
                    max_length=20,
                )),
                ('start_date', models.DateField(blank=True, null=True)),
                ('end_date', models.DateField(blank=True, null=True)),
                ('velocity', models.PositiveIntegerField(default=0, help_text='Story points completed')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('board', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='sprints',
                    to='tasks.board',
                )),
                ('created_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={'ordering': ['-created_at']},
        ),
        migrations.AddField(
            model_name='task',
            name='sprint',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='tasks',
                to='tasks.sprint',
            ),
        ),
        migrations.AddField(
            model_name='task',
            name='story_points',
            field=models.PositiveIntegerField(default=0, help_text='Story points for sprint planning'),
        ),
    ]
