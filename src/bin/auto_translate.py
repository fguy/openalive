from lib import polib
from lib.translator import translate
import os

DIR_PATH = os.path.join(os.path.abspath(os.path.dirname(os.path.realpath(__file__))), '../')
PO_FILES = ['django.po', 'djangojs.po']

if __name__ == '__main__':
    for lang in os.listdir(os.path.join(DIR_PATH, 'conf', 'locale')):
        if not lang.startswith('.'):
            print 'Starting translation from language "%s"' % lang
            for f in PO_FILES:
                po = polib.pofile(os.path.join(DIR_PATH, 'conf', 'locale', lang, 'LC_MESSAGES', f))
                po.metadata['Content-Type'] = 'text/plain; charset=utf-8'
                for entry in po.untranslated_entries():
                    entry.msgstr = translate('en', lang, entry.msgid)
                    print ('"%s" translated into %s' % (entry.msgid, entry.msgstr)).encode('utf8')
                po.save()
                print 'Language "%s" %d percent tlanslated in %s' % (lang, po.percent_translated(), f)
