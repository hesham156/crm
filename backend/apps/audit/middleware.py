import json
import threading
from apps.audit.models import AuditLog

# Thread-local storage to pass request context to signal handlers
_audit_context = threading.local()


def get_audit_context():
    return getattr(_audit_context, "context", {})


class AuditLogMiddleware:
    """
    Captures IP, user-agent, and authenticated user for every request.
    Stores them in thread-local so signal handlers can access the context
    and write AuditLog entries without needing the request object.
    """

    TRACKED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Build audit context before the view runs
        _audit_context.context = {
            "ip":         self.get_client_ip(request),
            "user_agent": request.META.get("HTTP_USER_AGENT", "")[:300],
            "user":       None,  # filled after auth runs (see process_view)
        }
        response = self.get_response(request)

        # After the view: log critical write operations
        if (
            request.method in self.TRACKED_METHODS
            and hasattr(request, "user")
            and request.user.is_authenticated
            and response.status_code < 400
        ):
            try:
                path   = request.path
                action = self._method_to_action(request.method)
                model  = self._path_to_model(path)

                if model:  # Only log known models
                    AuditLog.objects.create(
                        user       = request.user,
                        action     = action,
                        model      = model,
                        object_id  = "",
                        object_repr= path,
                        changes    = {},
                        ip_address = _audit_context.context.get("ip"),
                        user_agent = _audit_context.context.get("user_agent", ""),
                    )
            except Exception:
                pass  # Never break a request for audit logging

        # Clear context after request
        _audit_context.context = {}
        return response

    @staticmethod
    def get_client_ip(request):
        x_forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded:
            return x_forwarded.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR")

    @staticmethod
    def _method_to_action(method):
        return {
            "POST":   "create",
            "PUT":    "update",
            "PATCH":  "update",
            "DELETE": "delete",
        }.get(method, "update")

    @staticmethod
    def _path_to_model(path):
        """Map API path to a model label for the AuditLog."""
        mapping = {
            "/api/sales/jobs":        "sales.Job",
            "/api/sales/invoices":    "sales.Invoice",
            "/api/inventory":         "inventory.InventoryItem",
            "/api/tasks/boards":      "tasks.Board",
            "/api/tasks/tasks":       "tasks.Task",
            "/api/design/submissions":"design.DesignSubmission",
            "/api/accounts/users":    "accounts.User",
            "/api/crm/customers":     "crm.Customer",
            "/api/production":        "production.ProductionStage",
        }
        for prefix, label in mapping.items():
            if path.startswith(prefix):
                return label
        return None
