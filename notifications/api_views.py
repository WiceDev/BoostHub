from django.http import HttpResponse
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
    SSE endpoint disabled — sync gunicorn workers cannot handle long-lived
    streaming connections (each SSE connection blocks a worker until timeout).
    Frontend uses polling via the /api/notifications/ endpoint instead.
    """
    return HttpResponse(status=501)


@api_view(['GET'])
def api_announcements(request):
    """Return active announcements ordered by newest first."""
    announcements = Announcement.objects.filter(is_active=True).values(
        'id', 'title', 'body', 'created_at'
    )
    return Response(list(announcements))
