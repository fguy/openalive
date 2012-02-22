import re
def get_geoipcode(ipaddr):
        ''' This function from http://code.google.com/p/geo-ip-location '''
        from google.appengine.api import memcache
        memcache_key = "gip_%s" % ipaddr
        data = memcache.get(memcache_key)
        if data is not None:
                return data

        geoipcode = ''
        from google.appengine.api import urlfetch
        try:
                fetch_response = urlfetch.fetch('http://geoip.wtanaka.com/cc/%s' % ipaddr)
                if fetch_response.status_code == 200:
                        geoipcode = fetch_response.content
        except urlfetch.Error, e:
                pass

        if geoipcode:
                memcache.set(memcache_key, geoipcode)
        return geoipcode
    
_slugify_strip_re = re.compile(r'[^\w\s-]')
_slugify_hyphenate_re = re.compile(r'[-\s]+')
def slugify(value):
    """
    Normalizes string, converts to lowercase, removes non-alpha characters,
    and converts spaces to hyphens.
    
    From Django's "django/template/defaultfilters.py".
    """
    import unicodedata
    if not isinstance(value, unicode):
        value = unicode(value)
    value = unicodedata.normalize('NFKD', value).encode('ascii', 'ignore')
    value = unicode(_slugify_strip_re.sub('', value).strip().lower())
    return _slugify_hyphenate_re.sub('-', value)