"""
Input sanitization utilities.

Strips HTML tags, script content, null bytes, and control characters
from user-submitted text. Apply to all free-text input before storing.
"""

import re
import html
from rest_framework import serializers

# Matches HTML tags including script/style blocks with their content
_SCRIPT_STYLE_RE = re.compile(
    r'<\s*(script|style)[^>]*>.*?<\s*/\s*\1\s*>', re.IGNORECASE | re.DOTALL
)
_TAG_RE = re.compile(r'<[^>]+>')
_CONTROL_CHARS_RE = re.compile(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]')
_EXCESSIVE_WHITESPACE_RE = re.compile(r'[ \t]{20,}')

# Max length for common field types (enforced at API level)
MAX_NAME = 150
MAX_PHONE = 30
MAX_SHORT_TEXT = 255
MAX_MEDIUM_TEXT = 1000
MAX_LONG_TEXT = 5000
MAX_URL = 2048
MAX_HASH = 256


def sanitize_text(value: str, max_length: int = MAX_MEDIUM_TEXT) -> str:
    """Strip dangerous content from a user-supplied text string."""
    if not isinstance(value, str):
        return value

    # Remove null bytes
    value = value.replace('\x00', '')

    # Remove script/style blocks, then all HTML tags
    value = _SCRIPT_STYLE_RE.sub('', value)
    value = _TAG_RE.sub('', value)

    # Decode any HTML entities that might be used to bypass tag stripping
    value = html.unescape(value)
    # Re-strip tags after unescape (catches double-encoded payloads)
    value = _TAG_RE.sub('', value)

    # Remove control characters (keep \n, \r, \t)
    value = _CONTROL_CHARS_RE.sub('', value)

    # Collapse excessive whitespace runs (> 20 spaces)
    value = _EXCESSIVE_WHITESPACE_RE.sub(' ', value)

    # Enforce max length
    if max_length and len(value) > max_length:
        value = value[:max_length]

    return value.strip()


def sanitize_url(value: str, max_length: int = MAX_URL) -> str:
    """Validate and sanitize a URL — reject javascript: / data: schemes."""
    if not isinstance(value, str):
        return value

    value = sanitize_text(value, max_length=max_length)
    lower = value.lower().strip()

    # Block dangerous URL schemes
    dangerous_schemes = ('javascript:', 'data:', 'vbscript:', 'file:')
    for scheme in dangerous_schemes:
        if lower.startswith(scheme):
            return ''

    return value


def sanitize_dict(data: dict, max_length: int = MAX_MEDIUM_TEXT) -> dict:
    """Recursively sanitize all string values in a dictionary."""
    cleaned = {}
    for key, value in data.items():
        key = sanitize_text(str(key), max_length=MAX_SHORT_TEXT)
        if isinstance(value, str):
            cleaned[key] = sanitize_text(value, max_length=max_length)
        elif isinstance(value, dict):
            cleaned[key] = sanitize_dict(value, max_length=max_length)
        elif isinstance(value, list):
            cleaned[key] = [
                sanitize_text(v, max_length=max_length) if isinstance(v, str)
                else sanitize_dict(v, max_length=max_length) if isinstance(v, dict)
                else v
                for v in value
            ]
        else:
            cleaned[key] = value
    return cleaned


# ── DRF field that auto-sanitizes ─────────────────────────────────────────────

class SanitizedCharField(serializers.CharField):
    """CharField that strips HTML tags and dangerous content."""

    def __init__(self, *args, sanitize_max_length=None, **kwargs):
        self._sanitize_max_length = sanitize_max_length
        super().__init__(*args, **kwargs)

    def to_internal_value(self, data):
        value = super().to_internal_value(data)
        ml = self._sanitize_max_length or self.max_length or MAX_MEDIUM_TEXT
        return sanitize_text(value, max_length=ml)
