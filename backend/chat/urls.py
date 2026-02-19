# from django.urls import path
# from .views import (
#     ChatRoomList,
#     ChatRoomDetail,
#     SendMessage,
#     upload_file,
#     delete_message,
#     edit_message,
# )

# urlpatterns = [
#    path("rooms/", ChatRoomList.as_view()),
#     path("rooms/<int:room_id>/", ChatRoomDetail.as_view()),
#     path("rooms/<int:room_id>/send/", SendMessage.as_view()),
#     path("rooms/<int:room_id>/upload/", upload_file),
#     path("messages/<int:message_id>/edit/", edit_message),
#     path("messages/<int:message_id>/delete/", delete_message),
# ]
from django.urls import path
from .views import (
    ChatRoomList,
    ChatRoomDetail,
    SendMessage,
    upload_file,
    delete_message,
    edit_message,
    get_or_create_private_room,
    list_users,
)

urlpatterns = [
    # Chat rooms
    path("rooms/", ChatRoomList.as_view(), name="room-list"),
    path("rooms/<int:room_id>/", ChatRoomDetail.as_view(), name="room-detail"),

    # Messages
    path("rooms/<int:room_id>/send/", SendMessage.as_view(), name="send-message"),
    path("rooms/<int:room_id>/upload/", upload_file, name="upload-file"),
    path("messages/<int:message_id>/edit/", edit_message, name="edit-message"),
    path("messages/<int:message_id>/delete/", delete_message, name="delete-message"),
    path("chat/private/", get_or_create_private_room),
     path("users/", list_users),

]