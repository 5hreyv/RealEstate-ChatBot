"""
WSGI config for realestate_chatbot project.
"""

import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "realestate_chatbot.settings")

application = get_wsgi_application()
