import json
import time
from django.http import StreamingHttpResponse, HttpResponse
from django.db import close_old_connections
from rest_framework.decorators import api_view
from rest_framework.response import Response
from .models import Notification, Announcement
from .serializers import NotificationSerializer


@api_view(['GET'])
def api_notifications(request):
    """Return the 10 most recent notifications."""
    notifications = request.user.notifications.all()[:10]
    serializer = NotificationSerializer(notifications, many=True)
    unread_count = request.user.notifications.filter(is_read=False).count()
    return Response({
        'notifications': serializer.data,
        'unread_count': unread_count,
    })


@api_view(['POST'])
def api_mark_notifications_read(request):
    """Mark all notifications as read."""
    request.user.notifications.filter(is_read=False).update(is_read=True)
    return Response({'detail': 'All notifications marked as read.'})


def sse_notifications(request):
    """
    Server-Sent Events stream — pushes new notifications to the client in real time.
    Polls the DB every 2 seconds and emits only notifications newer than the
    client's last-seen ID.  Uses plain Django (not DRF) so we can return a
    StreamingHttpResponse.
    """
    if not request.user.is_authenticated:
        return HttpResponse(status=401)

    user = request.user

    def event_generator():
        close_old_connections()

        # Start cursor at the current newest notification so we only push
        # notifications that arrive *after* the connection is opened.
        try:
            latest = Notification.objects.filter(user=user).only('id').first()
            last_id = latest.id if latest else 0
        except Exception:
            last_id = 0

        # Confirm the connection is alive
        yield 'event: ping\ndata: {}\n\n'

        heartbeat_ticks = 0
        while True:
            try:
                close_old_connections()
                new_notifs = list(
                    Notification.objects
                    .filter(user=user, id__gt=last_id)
                    .order_by('id')[:10]
                )
                for notif in new_notifs:
                    last_id = notif.id
                    payload = json.dumps({
                        'id': notif.id,
                        'notification_type': notif.notification_type,
                        'title': notif.title,
                        'message': notif.message,
                        'is_read': notif.is_read,
                        'created_at': notif.created_at.isoformat(),
                    })
                    yield f'id: {notif.id}\nevent: notification\ndata: {payload}\n\n'

                # Send a comment heartbeat every ~30 s to prevent proxy timeouts
                heartbeat_ticks += 1
                if heartbeat_ticks >= 15:
                    yield ': heartbeat\n\n'
                    heartbeat_ticks = 0

            except GeneratorExit:
                break
            except Exception:
                # Don't crash the stream on transient DB errors
                yield ': error-retry\n\n'

            time.sleep(2)

    response = StreamingHttpResponse(
        event_generator(),
        content_type='text/event-stream; charset=utf-8',
    )
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'   # disable nginx buffering
    response['Connection'] = 'keep-alive'
    return response


@api_view(['GET'])
def api_announcements(request):
    """Return active announcements ordered by newest first."""
    announcements = Announcement.objects.filter(is_active=True).values(
        'id', 'title', 'body', 'created_at'
    )
    return Response(list(announcements))
