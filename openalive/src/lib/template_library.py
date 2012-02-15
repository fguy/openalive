import types
from google.appengine.ext import webapp
from django.template import Context, Template

def quote(value):
        if isinstance(value, types.BooleanType):
                return str(value).lower()
        elif isinstance(value, types.StringTypes):
                return '"%s"' % value
        else:
           return value
register = webapp.template.create_template_register()
register.filter(quote)
