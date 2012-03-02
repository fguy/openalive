from gettext import gettext as _
from google.appengine.ext.webapp import template
from datetime import datetime
import time
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
    
@register.filter
def date8601(value):
    return time.strftime("%Y-%m-%dT%H:%M:%S", value.utctimetuple())    
    
@register.tag
def js(value):
    return '<script type="text/javascript" src="%s"></script>' % value

@register.filter
def pretty_date(time):
    """
    Get a datetime object or a int() Epoch timestamp and return a
    pretty string like 'an hour ago', 'Yesterday', '3 months ago',
    'just now', etc
    """
    now = datetime.now()
    if type(time) is int:
        diff = now - datetime.fromtimestamp(time)
    elif isinstance(time,datetime):
        diff = now - time 
    elif not time:
        diff = now - now
    second_diff = diff.seconds
    day_diff = diff.days

    if day_diff < 0:
        return ''

    if day_diff == 0:
        if second_diff < 10:
            return _("just now")
        if second_diff < 60:
            return str(second_diff) + _(" seconds ago")
        if second_diff < 120:
            return  _("a minute ago")
        if second_diff < 3600:
            return str( second_diff / 60 ) + _(" minutes ago")
        if second_diff < 7200:
            return _("an hour ago")
        if second_diff < 86400:
            return str( second_diff / 3600 ) + _(" hours ago")
    if day_diff == 1:
        return _("Yesterday")
    if day_diff < 7:
        return str(day_diff) + _(" days ago")
    if day_diff < 31:
        return str(day_diff/7) + _(" weeks ago")
    if day_diff < 365:
        return str(day_diff/30) + _(" months ago")
    return str(day_diff/365) + _(" years ago")