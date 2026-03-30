from django.apps import AppConfig


class ApiIntegrationsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api_integrations'

    def ready(self):
        from celery.signals import worker_ready

        @worker_ready.connect
        def warm_caches_on_startup(sender, **kwargs):
            from .tasks import warm_rss_cache, warm_smspool_cache
            warm_rss_cache.delay()
            warm_smspool_cache.delay()
