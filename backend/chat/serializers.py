from rest_framework import serializers
from django.contrib.auth.models import User
from .models import ChatRoom, Message
from .models import RoomReadStatus

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["id", "username"]


class MessageSerializer(serializers.ModelSerializer):
    file = serializers.SerializerMethodField()
    user = serializers.SerializerMethodField()
    reply_to = serializers.SerializerMethodField()

    class Meta:
        model = Message
        fields = [
            "id",
            "room",
            "user",
            "user_id",
            "message",
            "file",
            "reply_to",
            "edited",
            "created_at",
        ]

    def get_file(self, obj):
        return obj.file.url if obj.file else None

    def get_user(self, obj):
        return {
            "id": obj.user.id,
            "username": obj.user.username
        }

    def get_reply_to(self, obj):
        if not obj.reply_to:
            return None
        return {
            "id": obj.reply_to.id,
            "message": obj.reply_to.message,
            "user": {
                "id": obj.reply_to.user.id,
                "username": obj.reply_to.user.username,
            }
        }


class ChatRoomSerializer(serializers.ModelSerializer):
    members = UserSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = ChatRoom
        fields = [
            "id",
            "name",
            "is_private",
            "members",
            "last_message",
            "unread_count",
        ]

    def get_last_message(self, obj):
        msg = obj.message_set.order_by("-created_at").first()
        if not msg:
            return None
        return {
            "id": msg.id,
            "message": msg.message,
            "created_at": msg.created_at,
            "user": msg.user.username,
        }

    def get_unread_count(self, obj):
        user = self.context["request"].user

        status, _ = RoomReadStatus.objects.get_or_create(
            user=user,
            room=obj
        )

        if not status.last_read_message:
            return obj.message_set.exclude(user=user).count()

        return obj.message_set.filter(
            id__gt=status.last_read_message.id
        ).exclude(user=user).count()

