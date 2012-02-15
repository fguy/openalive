from django.utils.translation import gettext_lazy as _
from django.conf import global_settings

def get_languages():
        result = [('',_('Do not specify.'))]
        lang_list = list(global_settings.LANGUAGES)
        lang_list.append(('ko',_('Korean')))
        lang_list.sort(lambda x, y: cmp(x[1], y[1]))
        result.extend(lang_list)
        return tuple(result)

LANGUAGES = get_languages()
