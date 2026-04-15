import os
from django.conf import settings
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

SCOPES = ['https://www.googleapis.com/auth/drive']


def get_drive_service():
    """Returns an authenticated Google Drive service."""
    creds_path = getattr(settings, 'GOOGLE_DRIVE_CREDENTIALS_PATH', None)
    if not creds_path or not os.path.exists(creds_path):
        return None
        
    try:
        creds = service_account.Credentials.from_service_account_file(
            creds_path, scopes=SCOPES)
        service = build('drive', 'v3', credentials=creds, cache_discovery=False)
        return service
    except Exception as e:
        print(f"Failed to auth Google Drive: {e}")
        return None


def create_folder(name, parent_id=None):
    service = get_drive_service()
    if not service:
        return None, None
        
    file_metadata = {
        'name': name,
        'mimeType': 'application/vnd.google-apps.folder'
    }
    if parent_id:
        file_metadata['parents'] = [parent_id]
        
    try:
        folder = service.files().create(body=file_metadata, fields='id, webViewLink').execute()
        
        # Make the folder accessible to anyone with the link
        service.permissions().create(
            fileId=folder.get('id'),
            body={'type': 'anyone', 'role': 'writer'},
            fields='id'
        ).execute()
            
        return folder.get('id'), folder.get('webViewLink')
    except Exception as e:
        print(f"Google Drive Create Folder Error: {e}")
        return None, None


def upload_file(local_path, name, parent_id=None):
    service = get_drive_service()
    if not service:
        return None, None
        
    file_metadata = {'name': name}
    if parent_id:
        file_metadata['parents'] = [parent_id]
        
    media = MediaFileUpload(local_path, resumable=True)
    try:
        file = service.files().create(
            body=file_metadata, 
            media_body=media, 
            fields='id, webViewLink'
        ).execute()
        
        # Public writer access
        service.permissions().create(
            fileId=file.get('id'),
            body={'type': 'anyone', 'role': 'writer'},
            fields='id'
        ).execute()
        
        return file.get('id'), file.get('webViewLink')
    except Exception as e:
        print(f"Google Drive Upload File Error: {e}")
        return None, None


def get_or_create_root_folder():
    """Finds or creates the 'ProSticker ERP' root folder, or returns predefined."""
    predefined_id = getattr(settings, 'GOOGLE_DRIVE_ROOT_FOLDER_ID', None)
    if predefined_id:
        return predefined_id

    service = get_drive_service()
    if not service:
        return None
        
    try:
        results = service.files().list(
            q="mimeType='application/vnd.google-apps.folder' and name='ProSticker ERP' and trashed=false",
            spaces='drive',
            fields='files(id, name)'
        ).execute()
        
        items = results.get('files', [])
        if not items:
            f_id, _ = create_folder('ProSticker ERP')
            return f_id
        return items[0].get('id')
    except Exception as e:
        print(f"Google Drive Root Folder Error: {e}")
        return None
