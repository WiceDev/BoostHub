from django.db import models
from services.pending import PendingSubmission  # noqa: F401 — ensure migration picks it up


class Gift(models.Model):
    CATEGORY_CHOICES = [
        ('food_groceries', 'Food & Groceries'),
        ('electronics', 'Electronics'),
        ('fashion', 'Fashion'),
        ('home_living', 'Home & Living'),
        ('health_beauty', 'Health & Beauty'),
    ]

    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2, help_text='Selling price (shown to users)')
    buying_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text='What we paid for this item — used for profit calculation'
    )
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    emoji = models.CharField(max_length=10, blank=True, help_text='Emoji for display')
    color = models.CharField(
        max_length=100, blank=True,
        help_text='Tailwind gradient classes, e.g. from-violet-500 to-purple-600'
    )
    image_url = models.URLField(blank=True, help_text='URL of the gift image')
    delivery_days = models.PositiveIntegerField(default=3, help_text='Estimated delivery days')
    notes = models.TextField(blank=True, help_text='Extra notes shown to buyer')
    rating = models.DecimalField(max_digits=2, decimal_places=1, default=4.5)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} - {self.get_category_display()}"


class GiftImage(models.Model):
    """Multiple images per gift item (front/back, different angles, sizes)."""
    gift = models.ForeignKey(Gift, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='gifts/')
    position = models.PositiveIntegerField(default=0, help_text='Display order (lower = first)')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['position', 'id']

    def __str__(self):
        return f"Image {self.position} for {self.gift.name}"


class BoostingService(models.Model):
    name = models.CharField(max_length=500)
    platform = models.CharField(max_length=100, blank=True)
    category = models.CharField(max_length=100, blank=True)
    price_per_k = models.DecimalField(
        max_digits=12, decimal_places=4,
        help_text='Price per 1000 units'
    )
    min_quantity = models.PositiveIntegerField(default=100)
    max_quantity = models.PositiveIntegerField(default=100000)
    # When set, this service was auto-created from a BoostingServiceSnapshot
    catalog_snapshot_id = models.IntegerField(null=True, blank=True, db_index=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['platform', 'category']

    def __str__(self):
        return f"{self.name} ({self.platform})"


class SocialMediaAccount(models.Model):
    """Social media accounts available for purchase."""
    PLATFORM_CHOICES = [
        ('Instagram', 'Instagram'),
        ('Facebook', 'Facebook'),
        ('Twitter', 'Twitter'),
        ('TikTok', 'TikTok'),
        ('Telegram', 'Telegram'),
        ('YouTube', 'YouTube'),
        ('Snapchat', 'Snapchat'),
        ('LinkedIn', 'LinkedIn'),
    ]

    platform = models.CharField(max_length=30, choices=PLATFORM_CHOICES)
    service_name = models.CharField(max_length=255, help_text='e.g. Aged Instagram Account, Verified Twitter')
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=12, decimal_places=2, help_text='Selling price (shown to users)')
    buying_price = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True,
        help_text='What we paid for this account — used for profit calculation'
    )
    notes = models.TextField(blank=True, help_text='Extra notes for buyer')
    required_fields = models.JSONField(
        default=list, blank=True,
        help_text='Field labels the buyer must fill in, e.g. ["Target Username", "Email"]'
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['platform', 'service_name']

    def __str__(self):
        return f"{self.service_name} ({self.platform})"


class WebDevPortfolio(models.Model):
    """Web development portfolio items / templates for sale."""
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    video_url = models.URLField(blank=True, help_text='URL to demo video')
    website_url = models.URLField(blank=True, help_text='URL to live demo')
    image_url = models.URLField(blank=True, help_text='Thumbnail/preview image URL')
    price = models.DecimalField(max_digits=12, decimal_places=2)
    category = models.CharField(max_length=50, blank=True, help_text='e.g. E-commerce, Portfolio, Blog')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class WebDevMedia(models.Model):
    """Videos and images for web development portfolio items."""
    MEDIA_TYPE_CHOICES = [
        ('image', 'Image'),
        ('video', 'Video'),
    ]
    portfolio = models.ForeignKey(WebDevPortfolio, on_delete=models.CASCADE, related_name='media_files')
    file = models.FileField(upload_to='webdev/')
    media_type = models.CharField(max_length=10, choices=MEDIA_TYPE_CHOICES)
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['position', 'id']

    def __str__(self):
        return f"{self.media_type} {self.position} for {self.portfolio.title}"


class SmmPanel(models.Model):
    """External SMM panel configuration for boosting fulfillment."""
    name = models.CharField(max_length=255)
    api_url = models.URLField()
    api_key = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name
