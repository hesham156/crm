import os
import threading
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import DesignSubmission
from utils.google_drive import upload_file

def upload_design_to_drive_task(sub_id):
    try:
        sub = DesignSubmission.objects.get(id=sub_id)
        if not sub.file or not sub.file.path:
            return
            
        local_path = sub.file.path
        filename = (
            sub.filename or 
            os.path.basename(local_path) or 
            f"design_v{sub.version}.tmp"
        )
        
        parent_id = None
        if sub.job and sub.job.drive_folder_id:
            parent_id = sub.job.drive_folder_id
            
        file_id, file_link = upload_file(local_path, filename, parent_id=parent_id)
        
        if file_link:
            # Update submission
            sub.file_url = file_link
            
            # Optional: Delete local file to save space
            try:
                os.remove(local_path)
                sub.file.name = "" # Clear the field
            except Exception as e:
                print(f"Error removing local file: {e}")
                
            sub.save(update_fields=['file_url', 'file'])
            
    except Exception as e:
        print(f"Error uploading design to drive: {e}")

@receiver(post_save, sender=DesignSubmission)
def design_post_save(sender, instance, created, **kwargs):
    if instance.file and not instance.file_url:
        t = threading.Thread(target=upload_design_to_drive_task, args=(instance.id,))
        t.start()
