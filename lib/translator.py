import urllib
try: 
    import json
except ImportError:
    import simplejson as json
import settings

TRANSLATE_URL = 'https://www.googleapis.com/language/translate/v2?%s'

def translate(source, target, q):
    if source == target:
        return q
    response = urllib.urlopen(TRANSLATE_URL % urllib.urlencode({'q': q, 'source': source, 'target': target, 'key': settings.GOOGLE_SIMPLE_API_KEY}))
    result = json.loads(response.read())
    response.close()
    if result.has_key('error'):
        raise Exception(result['error'])
    return result['data']['translations'][0]['translatedText']
