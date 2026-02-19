from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync

from .models import ChatRoom, Message
from .serializers import ChatRoomSerializer, MessageSerializer
from django.core.files.storage import default_storage
from django.contrib.auth.models import User
from .utils import mark_room_as_read


# ======================= ROOMS =======================

class ChatRoomList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rooms = ChatRoom.objects.filter(members=request.user)

        return Response(
            ChatRoomSerializer(
                rooms,
                many=True,
                context={"request": request}
            ).data
        )

# ======================= TEXT MESSAGE (REST) =======================

class SendMessage(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, room_id):
        room = get_object_or_404(ChatRoom, id=room_id)

        msg = Message.objects.create(
            room=room,
            user=request.user,
            message=request.data.get("content", "").strip()
        )

        serializer = MessageSerializer(msg)

        # 🔥 Broadcast (NO DB CREATE IN WS)
        channel_layer = get_channel_layer()
        async_to_sync(channel_layer.group_send)(
            f"chat_{room_id}",
            {
                "type": "message",
                **serializer.data
            }
        )

        return Response(serializer.data)



class ChatRoomDetail(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, room_id):
        room = get_object_or_404(ChatRoom, id=room_id)

        messages = Message.objects.filter(room=room).order_by("created_at")

        # ✅ mark as read ONLY when room is opened
        mark_room_as_read(request.user, room)

        return Response({
            "id": room.id,
            "name": room.name,
            "is_private": room.is_private,
            "messages": MessageSerializer(messages, many=True).data,
        })

# ======================= FILE UPLOAD (ONLY PLACE FILE IS SAVED) =======================

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def upload_file(request, room_id):
    file = request.FILES.get("file")

    if not file:
        return Response({"error": "No file"}, status=400)

    path = default_storage.save(f"chat_files/{file.name}", file)

    return Response({"file": path})


# ======================= DELETE MESSAGE =======================

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_message(request, message_id):
    msg = get_object_or_404(Message, id=message_id, user=request.user)
    room_id = msg.room_id
    msg_id = msg.id
    msg.delete()

    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"chat_{room_id}",
        {
            "type": "delete",
            "id": msg_id,
        }
    )

    return Response({"success": True, "id": msg_id})


# ======================= EDIT MESSAGE =======================

@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def edit_message(request, message_id):
    msg = get_object_or_404(Message, id=message_id, user=request.user)

    content = request.data.get("content", "").strip()
    if not content:
        return Response({"error": "Empty message"}, status=400)

    msg.message = content
    msg.edited = True
    msg.save()

    serializer = MessageSerializer(msg)

    channel_layer = get_channel_layer()
    async_to_sync(channel_layer.group_send)(
        f"chat_{msg.room_id}",
        {
            "type": "edit",
            **serializer.data
        }
    )

    return Response(serializer.data)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def get_or_create_private_room(request):
    other_user_id = request.data.get("user_id")

    if not other_user_id:
        return Response({"error": "user_id required"}, status=400)

    other_user = get_object_or_404(User, id=other_user_id)

    room = (
        ChatRoom.objects
        .filter(is_private=True, members=request.user)
        .filter(members=other_user)
        .first()
    )

    if not room:
        room = ChatRoom.objects.create(is_private=True)
        room.members.add(request.user, other_user)

    return Response(ChatRoomSerializer(room).data)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def list_users(request):
    users = User.objects.exclude(id=request.user.id)
    data = [
        {"id": u.id, "username": u.username}
        for u in users
    ]
    return Response(data)

