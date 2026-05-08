from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('tasks', '0007_task_recurrence_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='custom_field_values',
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.CreateModel(
            name='BoardCustomField',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=100)),
                ('field_type', models.CharField(
                    choices=[
                        ('text', 'Text'),
                        ('number', 'Number'),
                        ('date', 'Date'),
                        ('select', 'Select (dropdown)'),
                        ('checkbox', 'Checkbox'),
                        ('url', 'URL'),
                    ],
                    default='text',
                    max_length=20,
                )),
                ('options', models.JSONField(blank=True, default=list, help_text='Options for select fields')),
                ('position', models.PositiveIntegerField(default=0)),
                ('is_required', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('board', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='custom_fields',
                    to='tasks.board',
                )),
            ],
            options={
                'ordering': ['position'],
            },
        ),
    ]
