from urllib.parse import parse_qs
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.db import close_old_connections


@database_sync_to_async
def get_user_from_token(token):
    """
    Validate JWT token safely AFTER Django apps are ready
    """
    try:
        from rest_framework_simplejwt.authentication import JWTAuthentication
        from django.contrib.auth.models import AnonymousUser

        jwt_auth = JWTAuthentication()
        validated_token = jwt_auth.get_validated_token(token)
        user = jwt_auth.get_user(validated_token)
        return user

    except Exception as e:
        print("[JWTAuthMiddleware] Token validation failed:", e)
        from django.contrib.auth.models import AnonymousUser
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        close_old_connections()

        from django.contrib.auth.models import AnonymousUser
        scope["user"] = AnonymousUser()

        try:
            query_string = scope.get("query_string", b"").decode()
            token = parse_qs(query_string).get("token", [None])[0]

            if token:
                user = await get_user_from_token(token)
                scope["user"] = user

                if user.is_authenticated:
                    print(f"[JWTAuthMiddleware] WS user authenticated: {user.username}")
                else:
                    print("[JWTAuthMiddleware] Invalid token → Anonymous")
            else:
                print("[JWTAuthMiddleware] No token provided")

        except Exception as e:
            print("[JWTAuthMiddleware] Middleware error:", e)
            scope["user"] = AnonymousUser()

        return await super().__call__(scope, receive, send)
