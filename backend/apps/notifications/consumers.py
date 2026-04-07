import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        user = self.scope.get("user")

        if not user or not user.is_authenticated:
            await self.close()
            return

        self.user_id = str(user.id)
        self.group_name = f"notifications_{self.user_id}"

        # Join user-specific notification group
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

        # Send unread count on connect
        unread_count = await self.get_unread_count(user)
        await self.send(json.dumps({"type": "connected", "unread_count": unread_count}))

    async def disconnect(self, close_code):
        if hasattr(self, "group_name"):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        """Handle messages from client (e.g., mark-read)."""
        try:
            data = json.loads(text_data)
            action = data.get("action")

            if action == "mark_read":
                notification_id = data.get("id")
                if notification_id:
                    await self.mark_notification_read(notification_id)
                    await self.send(json.dumps({"type": "marked_read", "id": notification_id}))

            elif action == "mark_all_read":
                await self.mark_all_read()
                await self.send(json.dumps({"type": "all_marked_read"}))

        except json.JSONDecodeError:
            pass

    async def send_notification(self, event):
        """Receive from channel layer and forward to WebSocket client."""
        await self.send(json.dumps({
            "type": "notification",
            "notification": event["notification"],
        }))

    @database_sync_to_async
    def get_unread_count(self, user):
        from apps.notifications.models import Notification
        return Notification.objects.filter(recipient=user, is_read=False).count()

    @database_sync_to_async
    def mark_notification_read(self, notification_id):
        from apps.notifications.models import Notification
        Notification.objects.filter(
            id=notification_id, recipient_id=self.user_id
        ).update(is_read=True)

    @database_sync_to_async
    def mark_all_read(self):
        from apps.notifications.models import Notification
        Notification.objects.filter(recipient_id=self.user_id, is_read=False).update(is_read=True)
