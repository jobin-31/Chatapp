import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.core.exceptions import ObjectDoesNotExist
from .models import ChatRoom, Message, RoomReadStatus


class ChatConsumer(AsyncWebsocketConsumer):

    # ================= CONNECTION =================

    async def connect(self):
        self.room_id = self.scope["url_route"]["kwargs"]["room_id"]
        self.room_group = f"chat_{self.room_id}"
        self.user = self.scope["user"]

        if not self.user.is_authenticated or not await self.is_member():
            await self.close()
            return

        # 🔥 USER CHANNEL (for unread updates)
        self.user_group = f"user_{self.user.id}"

        await self.channel_layer.group_add(self.room_group, self.channel_name)
        await self.channel_layer.group_add(self.user_group, self.channel_name)

        await self.accept()

        # ✅ mark as read when room opens
        await self.mark_room_as_read()

        await self.broadcast_status("online")

    async def disconnect(self, code):
        await self.broadcast_status("offline")
        await self.channel_layer.group_discard(self.room_group, self.channel_name)
        await self.channel_layer.group_discard(self.user_group, self.channel_name)

    # ================= RECEIVE =================

    async def receive(self, text_data):
        data = json.loads(text_data)
        event_type = data.get("type")

        if event_type == "typing":
            await self.channel_layer.group_send(
                self.room_group,
                {
                    "type": "typing",
                    "user": self.user_payload(),
                }
            )
            return

        if event_type == "edit":
            await self.edit_message(data)
            return

        if event_type == "delete":
            await self.delete_message(data)
            return

        if event_type == "message":
            await self.create_message(data)

    # ================= WS EVENTS =================

    async def message(self, event):
        await self.send(text_data=json.dumps(event))

    async def typing(self, event):
        await self.send(text_data=json.dumps(event))

    async def status(self, event):
        await self.send(text_data=json.dumps(event))

    async def edit(self, event):
        await self.send(text_data=json.dumps(event))

    async def delete(self, event):
        await self.send(text_data=json.dumps(event))

    async def unread_update(self, event):
        await self.send(text_data=json.dumps({
            "type": "unread_update",
            "room_id": event["room_id"],
            "message": event["message"],
            "file": event["file"],
        }))

    # ================= HELPERS =================

    def user_payload(self):
        return {
            "id": self.user.id,
            "username": self.user.username,
        }

    async def broadcast_status(self, status):
        await self.channel_layer.group_send(
            self.room_group,
            {
                "type": "status",
                "status": status,
                "user": self.user_payload(),
            }
        )

    @database_sync_to_async
    def is_member(self):
        return ChatRoom.objects.filter(id=self.room_id, members=self.user).exists()

    # ================= READ STATUS =================

    @database_sync_to_async
    def mark_room_as_read(self):
        last_msg = (
            Message.objects
            .filter(room_id=self.room_id)
            .order_by("-created_at")
            .first()
        )

        status, _ = RoomReadStatus.objects.get_or_create(
            user=self.user,
            room_id=self.room_id
        )

        if last_msg:
            status.last_read_message = last_msg
            status.save()

    @database_sync_to_async
    def get_other_member_ids(self):
        return list(
            ChatRoom.objects
            .get(id=self.room_id)
            .members
            .exclude(id=self.user.id)
            .values_list("id", flat=True)
        )

    # ================= MESSAGE HELPERS =================

    @database_sync_to_async
    def save_message(self, text, file_path, reply_to):
        msg = Message(
            room_id=self.room_id,
            user=self.user,
            message=text,
            reply_to_id=reply_to,
        )

        if file_path:
            msg.file.name = file_path

        msg.save()
        return msg

    @database_sync_to_async
    def get_reply(self, reply_id):
        if not reply_id:
            return None

        msg = Message.objects.select_related("user").filter(id=reply_id).first()
        if not msg:
            return None

        return {
            "id": msg.id,
            "message": msg.message,
            "user": {
                "id": msg.user.id,
                "username": msg.user.username,
            },
        }

    # ================= CREATE MESSAGE =================

    async def create_message(self, data):
        text = (data.get("message") or "").strip()
        file_path = data.get("file")
        reply_to = data.get("reply_to")

        if not text and not file_path:
            return

        msg = await self.save_message(text, file_path, reply_to)
        reply = await self.get_reply(reply_to)

        # 🔥 SEND MESSAGE TO ROOM
        await self.channel_layer.group_send(
            self.room_group,
            {
                "type": "message",
                "room_id": self.room_id,
                "id": msg.id,
                "client_id": data.get("client_id"),
                "user": self.user_payload(),
                "user_id": self.user.id,
                "message": msg.message,
                "file": msg.file.url if msg.file else None,
                "reply_to": reply,
                "edited": False,
                "created_at": msg.created_at.isoformat(),
            }
        )

        # 🔥 LIVE UNREAD UPDATE FOR OTHER USERS
        member_ids = await self.get_other_member_ids()

        for uid in member_ids:
            await self.channel_layer.group_send(
                f"user_{uid}",
                {
                    "type": "unread_update",
                    "room_id": self.room_id,
                    "message": msg.message,
                    "file": bool(msg.file),
                }
            )

    # ================= EDIT MESSAGE =================

    async def edit_message(self, data):
        msg_id = data.get("id")
        new_text = (data.get("message") or "").strip()

        if not msg_id or not new_text:
            return

        try:
            msg = await database_sync_to_async(Message.objects.get)(id=msg_id)
        except ObjectDoesNotExist:
            return

        if msg.user_id != self.user.id:
            return

        msg.message = new_text
        msg.edited = True
        await database_sync_to_async(msg.save)()

        await self.channel_layer.group_send(
            self.room_group,
            {
                "type": "edit",
                "id": msg.id,
                "message": msg.message,
                "edited": True,
            }
        )

    # ================= DELETE MESSAGE =================

    async def delete_message(self, data):
        msg_id = data.get("id")
        if not msg_id:
            return

        try:
            msg = await database_sync_to_async(Message.objects.get)(id=msg_id)
        except ObjectDoesNotExist:
            return

        if msg.user_id != self.user.id:
            return

        await database_sync_to_async(msg.delete)()

        await self.channel_layer.group_send(
            self.room_group,
            {
                "type": "delete",
                "id": msg_id,
            }
        )
