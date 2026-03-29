from rest_framework import serializers
from .models import Ticket


class TicketSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name  = serializers.SerializerMethodField()

    class Meta:
        model = Ticket
        fields = [
            'id', 'user_email', 'user_name',
            'order_number', 'subject', 'message',
            'status', 'admin_response',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'user_email', 'user_name', 'status', 'admin_response', 'created_at', 'updated_at']

    def get_user_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}".strip() or obj.user.email
