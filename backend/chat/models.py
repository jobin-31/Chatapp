from django.db import models
from django.contrib.auth.models import User


class ChatRoom(models.Model):
    name = models.CharField(max_length=255, blank=True)
    members = models.ManyToManyField(User, related_name="chat_rooms")
    is_private = models.BooleanField(default=False)

    def last_message(self):
        return self.message_set.order_by("-created_at").first()



class Message(models.Model):
    STATUS_CHOICES = (
        ("sent", "Sent"),
        ("delivered", "Delivered"),
        ("read", "Read"),
    )

    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE)
    user = models.ForeignKey(User, on_delete=models.CASCADE)

    message = models.TextField(blank=True, null=True)
    file = models.FileField(upload_to="chat_files/", blank=True, null=True)

    reply_to = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="replies"
    )

    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="sent"   # 🔥 THIS FIXES YOUR CRASH
    )

    edited = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        if self.message:
            return f"{self.user.username}: {self.message[:30]}"
        if self.file:
            return f"{self.user.username}: 📎 File"
        return f"{self.user.username}: (empty)"


class RoomReadStatus(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    room = models.ForeignKey(ChatRoom, on_delete=models.CASCADE)
    last_read_message = models.ForeignKey(
        Message,
        null=True,
        blank=True,
        on_delete=models.SET_NULL
    )

    class Meta:
        unique_together = ("user", "room")
