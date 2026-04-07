from rest_framework.permissions import BasePermission

ROLE_HIERARCHY = {
    "admin": 5,
    "manager": 4,
    "sales": 3,
    "designer": 2,
    "production": 1,
}


def has_role(user, *roles):
    return user.is_authenticated and user.role in roles


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return has_role(request.user, "admin")


class IsAdminOrManager(BasePermission):
    def has_permission(self, request, view):
        return has_role(request.user, "admin", "manager")


class IsSalesOrAbove(BasePermission):
    def has_permission(self, request, view):
        return has_role(request.user, "admin", "manager", "sales")


class IsDesignerOrAbove(BasePermission):
    def has_permission(self, request, view):
        return has_role(request.user, "admin", "manager", "designer")


class IsProductionOrAbove(BasePermission):
    def has_permission(self, request, view):
        return has_role(request.user, "admin", "manager", "production")


class IsOwnerOrAdmin(BasePermission):
    """Allow object owners or admins to edit/delete."""
    def has_object_permission(self, request, view, obj):
        if has_role(request.user, "admin", "manager"):
            return True
        return getattr(obj, "created_by_id", None) == request.user.id or obj == request.user
