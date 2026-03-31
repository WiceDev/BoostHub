from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from rest_framework.response import Response
from .models import Ticket
from .serializers import TicketSerializer


# ── User endpoints ──────────────────────────────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def api_tickets(request):
    if request.method == 'GET':
        tickets = Ticket.objects.filter(user=request.user)
        return Response(TicketSerializer(tickets, many=True).data)

    # POST — create ticket
    from core.sanitizers import sanitize_text, MAX_SHORT_TEXT, MAX_LONG_TEXT

    subject = sanitize_text(request.data.get('subject', ''), max_length=MAX_SHORT_TEXT)
    message = sanitize_text(request.data.get('message', ''), max_length=MAX_LONG_TEXT)
    order_number = sanitize_text(request.data.get('order_number', ''), max_length=50)

    if not subject or not message:
        return Response({'detail': 'Subject and message are required.'}, status=400)

    ticket = Ticket.objects.create(
        user=request.user,
        subject=subject,
        message=message,
        order_number=order_number,
    )
    return Response(TicketSerializer(ticket).data, status=201)


# ── Admin endpoints ──────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_tickets(request):
    status_filter = request.query_params.get('status')
    tickets = Ticket.objects.select_related('user').all()
    if status_filter:
        tickets = tickets.filter(status=status_filter)
    return Response(TicketSerializer(tickets, many=True).data)


@api_view(['PATCH'])
@permission_classes([IsAdminUser])
def admin_ticket_update(request, ticket_id):
    try:
        ticket = Ticket.objects.get(pk=ticket_id)
    except Ticket.DoesNotExist:
        return Response({'detail': 'Ticket not found.'}, status=404)

    status = request.data.get('status')
    admin_response = request.data.get('admin_response')

    if status and status in dict(Ticket.STATUS_CHOICES):
        ticket.status = status
    if admin_response is not None:
        ticket.admin_response = admin_response

    ticket.save()
    return Response(TicketSerializer(ticket).data)
