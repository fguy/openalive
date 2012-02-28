from google.appengine.ext.webapp import template
import types

register = template.create_template_register()

@register.filter
def quote(value):
    if isinstance(value, types.BooleanType):
        return str(value).lower()
    elif isinstance(value, types.StringTypes):
        return '"%s"' % value
    else:
        return value
    
@register.tag
def js(value):
    return '<script type="text/javascript" src="%s"></script>' % value
