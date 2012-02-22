from django.utils.text import javascript_quote
from django.utils.translation import check_for_language, activate, to_locale, \
    get_language
from django.views.i18n import LibHead, SimplePlural, LibFoot, InterPolate
from google.appengine.api import memcache
from lib.controller import Action, LANG_COOKIE_NAME
import gettext as gettext_module
import os

class Js(Action):
    def get(self):
        """
        Returns the selected language catalog as a javascript library.

        This method copied from django.views.i18n
        """
        language = str(self.request.cookies.get(LANG_COOKIE_NAME, ''))
        cache_key = 'i18n-js-%s' % language
        src = memcache.get(cache_key)
        if not src:
            domain = 'djangojs'
            
            if language:
                    if check_for_language(language):
                            activate(language)
            packages = ['conf']
            
            default_locale = to_locale('en')
            locale = to_locale(get_language())
            t = {}
            paths = []
            # first load all english languages files for defaults
            for package in packages:
                    p = __import__(package, {}, {}, [''])
                    path = os.path.join(os.path.dirname(p.__file__), 'locale')
                    paths.append(path)
                    catalog = gettext_module.translation(domain, path, ['en'])
                    t.update(catalog._catalog)
            # next load the settings.LANGUAGE_CODE translations if it isn't english
            if default_locale != 'en':
                    for path in paths:
                            try:
                                    catalog = gettext_module.translation(domain, path, [default_locale])
                            except IOError:
                                    catalog = None
                            if catalog is not None:
                                    t.update(catalog._catalog)
            # last load the currently selected language, if it isn't identical to the default.
            if locale != default_locale:
                    for path in paths:
                            try:
                                    catalog = gettext_module.translation(domain, path, [locale])
                            except IOError:
                                    catalog = None
                            if catalog is not None:
                                    t.update(catalog._catalog)
            src = [LibHead]
            plural = None
            if t.has_key(''):
                    for l in t[''].split('\n'):
                            if l.startswith('Plural-Forms:'):
                                    plural = l.split(':', 1)[1].strip()
            if plural is not None:
                    # this should actually be a compiled function of a typical plural-form:
                    # Plural-Forms: nplurals=3; plural=n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2;
                    plural = [el.strip() for el in plural.split(';') if el.strip().startswith('plural=')][0].split('=', 1)[1]
                    src.append('function pluralidx(n) {\n   return %s;\n}\n' % plural)
            else:
                    src.append(SimplePlural)
            csrc = []
            pdict = {}
            for k, v in t.items():
                    if k == '':
                            continue
                    if type(k) in (str, unicode):
                            csrc.append("catalog['%s'] = '%s';\n" % (javascript_quote(k), javascript_quote(v)))
                    elif type(k) == tuple:
                            if not pdict.has_key(k[0]):
                                    pdict[k[0]] = k[1]
                            else:
                                    pdict[k[0]] = max(k[1], pdict[k[0]])
                            csrc.append("catalog['%s'][%d] = '%s';\n" % (javascript_quote(k[0]), k[1], javascript_quote(v)))
                    else:
                            raise TypeError, k
            csrc.sort()
            for k, v in pdict.items():
                    src.append("catalog['%s'] = [%s];\n" % (javascript_quote(k), ','.join(["''"] * (v + 1))))
            src.extend(csrc)
            src.append(LibFoot)
            src.append(InterPolate)
            
            src.append("\n_ = gettext");
            
            src = ''.join(src)
            memcache.set(cache_key, src)
            
        self.response.headers['Content-Type'] = 'text/javascript' 
        self.response.out.write(src)

