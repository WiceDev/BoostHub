"""
PendingSubmission model — holds service_admin submissions awaiting super_admin approval.
"""
from django.db import models
from django.conf import settings


class PendingSubmission(models.Model):
    SUBMISSION_TYPES = [
        ('boosting_service', 'Boosting Service'),
        ('sms_service', 'SMS/Number Service'),
        ('social_account', 'Social Media Account'),
        ('gift', 'Gift Item'),
        ('webdev_portfolio', 'Web Dev Portfolio'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    submission_type = models.CharField(max_length=30, choices=SUBMISSION_TYPES)
    data = models.JSONField(help_text='Serialized service data submitted by the admin')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')

    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
        related_name='pending_submissions',
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='reviewed_submissions',
    )
    review_note = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Submission #{self.id} ({self.submission_type}) by {self.submitted_by.email} — {self.status}'
