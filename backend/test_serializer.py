import sys, os, django

# Setup Django
sys.path.append(os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.design.urls import DesignSubmissionSerializer

payload = {
    "job": "d46eb30b-3422-4a00-ba53-61ce5cd5c6f6",  # Dummy job ID, might fail job validation
    "file_url": "https://example.com/a" * 10,
    "filename": "test document.pdf"
}
s = DesignSubmissionSerializer(data=payload)
print("Valid:", s.is_valid())
print("Errors:", s.errors)
