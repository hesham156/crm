import threading
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import Job
from utils.google_drive import get_or_create_root_folder, create_folder

def create_job_drive_folder_task(job_id):
    try:
        job = Job.objects.get(id=job_id)
        if job.drive_folder_id:
            return  # Already created
            
        root_id = get_or_create_root_folder()
        if not root_id:
            return
            
        # Optional: Nested under customer -> Job
        # For simplicity, we just put it in Root directly with Job Number
        folder_name = f"{job.job_number} - {job.title}"
        f_id, f_link = create_folder(folder_name, parent_id=root_id)
        
        if f_id:
            job.drive_folder_id = f_id
            job.drive_folder_url = f_link
            job.save(update_fields=['drive_folder_id', 'drive_folder_url'])
            
    except Exception as e:
        print(f"Error creating drive folder for job: {e}")

@receiver(post_save, sender=Job)
def jpb_post_save(sender, instance, created, **kwargs):
    if created and not instance.drive_folder_id:
        # Run in background to not block the request
        t = threading.Thread(target=create_job_drive_folder_task, args=(instance.id,))
        t.start()
