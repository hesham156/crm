import os
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from django.conf import settings
from apps.crm.models import Customer
from .models import SyncLog
from django.utils import timezone


class GoogleSheetsService:
    SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly']

    def __init__(self):
        # We assume GOOGLE_SHEETS_CREDENTIALS_PATH is set in settings or .env
        creds_path = getattr(settings, 'GOOGLE_DRIVE_CREDENTIALS_PATH', 'credentials.json')
        if not os.path.exists(creds_path):
            raise FileNotFoundError(
                f"Google Service Account credentials file not found at {creds_path}. "
                "Please configure GOOGLE_DRIVE_CREDENTIALS_PATH in your .env file."
            )

        self.credentials = Credentials.from_service_account_file(
            creds_path, scopes=self.SCOPES
        )
        self.service = build('sheets', 'v4', credentials=self.credentials)

    def fetch_rows(self, spreadsheet_id, sheet_name, start_row=2):
        """
        Fetches rows from a given sheet starting from `start_row`.
        Uses A:Z range to get a reasonable amount of columns.
        """
        range_name = f"{sheet_name}!A{start_row}:Z"
        sheet = self.service.spreadsheets()
        result = sheet.values().get(spreadsheetId=spreadsheet_id, range=range_name).execute()
        values = result.get('values', [])
        return values

    def fetch_headers(self, spreadsheet_id, sheet_name, header_row=1):
        """Fetches the header row to determine column indices."""
        range_name = f"{sheet_name}!A{header_row}:Z{header_row}"
        sheet = self.service.spreadsheets()
        result = sheet.values().get(spreadsheetId=spreadsheet_id, range=range_name).execute()
        values = result.get('values', [])
        return values[0] if values else []

    def sync_integration(self, integration, triggered_by="scheduler"):
        """
        Syncs a single integration. Reads new rows and creates/updates Customers.
        """
        sync_log = SyncLog.objects.create(integration=integration, triggered_by=triggered_by)
        
        try:
            spreadsheet_id = integration.get_spreadsheet_id()
            sheet_name = integration.sheet_name
            header_row = integration.header_row
            mapping = integration.column_mapping
            
            # 1. Fetch Headers to know which index corresponds to which mapped column name
            headers = self.fetch_headers(spreadsheet_id, sheet_name, header_row)
            
            # Map CRM fields to their list index based on headers
            # mapping is like {"name": "First Name", "email": "Email Address"}
            index_mapping = {}
            for crm_field, sheet_col_name in mapping.items():
                if not sheet_col_name:
                    continue
                try:
                    # Case-insensitive header matching
                    headers_lower = [h.lower().strip() for h in headers]
                    idx = headers_lower.index(sheet_col_name.lower().strip())
                    index_mapping[crm_field] = idx
                except ValueError:
                    # Header not found, skip this field
                    pass
            
            if not index_mapping and mapping:
                 # If mapping exists but nothing matched headers, we might have a problem.
                 # Let's try to see if mapping values are letters (A, B, C...)
                 for crm_field, sheet_col in mapping.items():
                    if sheet_col and len(sheet_col) <= 2 and sheet_col.isalpha():
                         # Convert letter to index (A=0, B=1, ..., Z=25)
                         col_idx = 0
                         for char in sheet_col.upper():
                             col_idx = col_idx * 26 + (ord(char) - ord('A') + 1)
                         index_mapping[crm_field] = col_idx - 1


            # 2. Fetch new rows
            start_row = max(integration.last_synced_row + 1, header_row + 1)
            rows = self.fetch_rows(spreadsheet_id, sheet_name, start_row)
            
            sync_log.rows_read = len(rows)
            
            # 3. Process rows
            for i, row in enumerate(rows):
                try:
                    customer_data = {
                        "type": integration.default_customer_type,
                        "stage": integration.default_customer_stage,
                        "assigned_to": integration.default_assigned_to,
                    }
                    
                    # Extract data based on index mapping
                    for crm_field, idx in index_mapping.items():
                        if idx < len(row):
                            customer_data[crm_field] = row[idx].strip()
                    
                    # Ensure minimum required fields (e.g., name)
                    if not customer_data.get("name"):
                        customer_data["name"] = f"Unknown Customer (Sheet Row {start_row + i})"
                    
                    email = customer_data.get("email", "")
                    
                    if email:
                        existing_customer = Customer.objects.filter(email=email).first()
                        if existing_customer:
                            if integration.conflict_strategy == "skip":
                                sync_log.rows_skipped += 1
                                continue
                            elif integration.conflict_strategy == "update":
                                # Update existing
                                for key, value in customer_data.items():
                                    setattr(existing_customer, key, value)
                                existing_customer.save()
                                sync_log.rows_updated += 1
                                continue
                    
                    # Create new customer
                    Customer.objects.create(**customer_data)
                    sync_log.rows_created += 1
                    
                except Exception as row_error:
                    sync_log.rows_failed += 1
                    sync_log.error_message += f"Row {start_row + i} error: {str(row_error)}\n"
            
            # 4. Update integration state
            integration.last_synced_row = start_row + len(rows) - 1
            integration.last_sync_at = timezone.now()
            integration.last_sync_status = "success"
            if sync_log.error_message:
                integration.last_sync_status = "error"
                integration.last_sync_message = "Completed with some row errors."
            else:
                integration.last_sync_message = "Synced successfully."
            
            integration.save()
            
            sync_log.status = "success" if not sync_log.error_message else "error"
            sync_log.finished_at = timezone.now()
            sync_log.save()
            
            return sync_log

        except Exception as e:
            # Handle catastrophic failure
            integration.last_sync_status = "error"
            integration.last_sync_message = str(e)
            integration.last_sync_at = timezone.now()
            integration.save()
            
            sync_log.status = "error"
            sync_log.error_message = str(e)
            sync_log.finished_at = timezone.now()
            sync_log.save()
            
            return sync_log
