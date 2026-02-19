from django.urls import re_path
from . import consumers
from .consumers_user import UserConsumer

websocket_urlpatterns = [
    # WebSocket route for chat rooms
    re_path(r"ws/chat/(?P<room_id>\d+)/$", consumers.ChatConsumer.as_asgi()),
    re_path(r"ws/user/$", UserConsumer.as_asgi()),
]