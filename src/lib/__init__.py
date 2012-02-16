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