from django.utils import timezone
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth.models import AnonymousUser
from apps.accounts.models import User


@database_sync_to_async
def get_user_from_token(token_key):
    try:
        token = AccessToken(token_key)
        user_id = token["user_id"]
        return User.objects.get(id=user_id)
    except Exception:
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        headers = dict(scope.get("headers", {}))
        token = None

        # Try Authorization header
        auth_header = headers.get(b"authorization", b"").decode()
        if auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

        # Try query string: ?token=...
        if not token:
            query_string = scope.get("query_string", b"").decode()
            for part in query_string.split("&"):
                if part.startswith("token="):
                    token = part.split("=", 1)[1]
                    break

        scope["user"] = await get_user_from_token(token) if token else AnonymousUser()
        return await super().__call__(scope, receive, send)


def JWTAuthMiddlewareStack(inner):
    return JWTAuthMiddleware(inner)


class UpdateLastSeenMiddleware:
    """Updates user's last_seen on every request."""
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        if request.user.is_authenticated:
            User.objects.filter(pk=request.user.pk).update(last_seen=timezone.now())
        return response
