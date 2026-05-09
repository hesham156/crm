"""
Google Sheets API utilities for CRM sync.

Supports two auth methods (tried in order):
  1. API Key  — set GOOGLE_SHEETS_API_KEY in .env
               Sheet must be "Anyone with the link can view" (public).
  2. Service Account — set GOOGLE_DRIVE_CREDENTIALS_PATH to a service account JSON.
               Share the sheet with the service account email as Viewer.
"""
import os
import logging
from django.conf import settings
from googleapiclient.discovery import build

logger = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
]


def get_sheets_service():
    """
    Returns an authenticated Google Sheets v4 service.
    Tries API Key first, then Service Account. Raises ValueError if neither is configured.
    """
    # ── Method 1: API Key (public sheets) ─────────────────────────────────────
    api_key = getattr(settings, "GOOGLE_SHEETS_API_KEY", None) or os.environ.get("GOOGLE_SHEETS_API_KEY")
    if api_key:
        try:
            service = build("sheets", "v4", developerKey=api_key, cache_discovery=False)
            logger.debug("Google Sheets: using API Key auth")
            return service
        except Exception as e:
            logger.warning("Google Sheets API Key auth failed: %s", e)

    # ── Method 2: Service Account (private sheets) ────────────────────────────
    creds_path = getattr(settings, "GOOGLE_DRIVE_CREDENTIALS_PATH", None)
    if creds_path and os.path.exists(creds_path):
        try:
            from google.oauth2 import service_account
            creds = service_account.Credentials.from_service_account_file(creds_path, scopes=SCOPES)
            service = build("sheets", "v4", credentials=creds, cache_discovery=False)
            logger.debug("Google Sheets: using Service Account auth")
            return service
        except Exception as e:
            logger.error("Google Sheets Service Account auth failed: %s", e)

    raise ValueError(
        "Google Sheets is not configured. Set GOOGLE_SHEETS_API_KEY (for public sheets) "
        "or GOOGLE_DRIVE_CREDENTIALS_PATH (for private sheets with a service account)."
    )


def read_sheet(spreadsheet_id: str, sheet_name: str = "Sheet1", header_row: int = 1):
    """
    Reads a Google Sheet and returns (headers, data_rows).

    headers     — list of strings from the header row
    data_rows   — list of lists (one per data row, may be shorter than headers if trailing cells are empty)
    """
    service = get_sheets_service()
    if not service:
        raise ValueError(
            "Google Sheets credentials not configured. "
            "Set GOOGLE_DRIVE_CREDENTIALS_PATH in your .env to a valid service account JSON."
        )

    # Use the sheet name as the range to get all data
    range_name = f"'{sheet_name}'"
    try:
        result = (
            service.spreadsheets()
            .values()
            .get(spreadsheetId=spreadsheet_id, range=range_name)
            .execute()
        )
    except Exception as e:
        logger.error("Google Sheets read error (spreadsheet=%s sheet=%s): %s", spreadsheet_id, sheet_name, e)
        raise ValueError(f"Failed to read sheet: {e}") from e

    values = result.get("values", [])
    if not values:
        return [], []

    header_idx = header_row - 1
    if len(values) <= header_idx:
        return [], []

    headers = [str(h).strip() for h in values[header_idx]]
    data_rows = values[header_idx + 1 :]

    return headers, data_rows


def get_sheet_headers(spreadsheet_id: str, sheet_name: str = "Sheet1", header_row: int = 1):
    """Convenience wrapper — returns only the header list."""
    headers, _ = read_sheet(spreadsheet_id, sheet_name, header_row)
    return headers


def test_connection(spreadsheet_id: str, sheet_name: str = "Sheet1", header_row: int = 1):
    """
    Test connectivity and return headers + row count.
    Raises ValueError with a human-readable message on failure.
    """
    headers, rows = read_sheet(spreadsheet_id, sheet_name, header_row)
    return {
        "headers": headers,
        "row_count": len(rows),
        "status": "ok",
    }
