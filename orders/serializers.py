from rest_framework import serializers
from .models import Order


class OrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Order
        fields = [
            'id', 'service_type', 'service_name', 'amount', 'status',
            'external_order_id', 'external_data', 'result', 'tracking_code', 'tracking_url',
            'created_at', 'updated_at',
        ]
