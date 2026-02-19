from .models import RoomReadStatus, Message


def mark_room_as_read(user, room):
    """
    Update the user's last_read_message for a room
    when they open the chat
    """

    last_message = (
        Message.objects
        .filter(room=room)
        .order_by("-id")
        .first()
    )

    if not last_message:
        return

    status, _ = RoomReadStatus.objects.get_or_create(
        user=user,
        room=room
    )

    status.last_read_message = last_message
    status.save()