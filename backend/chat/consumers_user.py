import json
from channels.generic.websocket import AsyncWebsocketConsumer


class UserConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.user = self.scope["user"]

        if not self.user.is_authenticated:
            await self.close()
            return

        self.group_name = f"user_{self.user.id}"

        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    # 🔔 UNREAD UPDATE EVENT
    async def unread_update(self, event):
        await self.send(text_data=json.dumps({
            "type": "unread_update",
            "room_id": event["room_id"],
            "last_message": event.get("last_message"),
            "has_file": event.get("has_file", False),
        }))
