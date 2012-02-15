import os
import sys
import logging
import action
from pytz.gae import pytz

import django.utils.simplejson as simplejson

from google.appengine.ext import webapp
from google.appengine.ext.webapp import template

from django.conf import settings
from django.utils import translation

from pytz import country_timezones
from lib import get_geoipcode

ACTION_PACKAGE = 'action'
TEMPLATES_PATH = os.path.abspath('%s/../templates' % os.path.dirname(os.path.realpath(__file__)))
TEMPLATES_SUFFIX = '.html'
LANG_MAP = {'ko' : ['ko-kr'], 'en' : ['en_US', 'en_GB'], 'ja' : [], 'fr' : [], 'es' : [], 'it' : [], 'ru' : [], 'th' : [], 'zh' : [], 'zh-CN' : [], 'zh-TW'  : []}
LANG_COOKIE_NAME = 'django_language'
TIMEZONE_COOKIE_NAME = 'django_tz'

class Controller(webapp.RequestHandler):
        
        def __init__(self):
                self.__lang_map = {}
                for key, lang_list in LANG_MAP.iteritems():
                        self.__lang_map[key] = key
                        for lang in lang_list:
                                self.__lang_map[lang] = key
                settings.SETTINGS_MODULE = 'conf'
        
        def initialize(self, request, response):
                self.response = response
                self.request = request
                
                '''supports 2 depth path'''
                path = request.path[1:].split('/')
                action_module = path[0]
                
                if not action_module :
                        action_module = 'index'
                
                param = {}
                path_len = len(path)
                if path_len > 1:
                        action_class = path[1].capitalize()
                        i = 2
                        while i < path_len :
                                val = None
                                key = path[i]
                                if i + 1 < path_len:
                                        val = path[i + 1]
                                param[key] = val
                                i += 2
                else:
                        action_class = 'Index'
                del path
                                        
                logging.debug('Current action module : %s, class : %s' % (action_module, action_class))         
                self._import_action(request, response, action_module, action_class)
                
                if self.__action:
                        logging.debug('Action params : %s' % param)
                        self.__action._set_params(param)
        
        def _execute(self, method_name, *args):         
                if not self.response:
                        logging.debug('response is None')
                        return
                
                self._set_language(self.request)
                self._set_timezone(self.request)
                                
                if not self.__action:
                        logging.debug('Action is missing')
                        self.error(404)
                else:
                        method = None
                        try:
                                method = getattr(self.__action, method_name)
                        except AttributeError:
                                logging.warn('Requested method "%s" not found on this action.' % method_name)
                        
                        if method:
                                getattr(self.__action, 'before')()
                                result = method(*args)
                                getattr(self.__action, 'after')()
                                if not self.__action._has_error() :
                                        self.__action.lang = self.request.lang
                                        self.__action.timezone = self.request.timezone
                                        
                                        if result is Action.Result.JSON:
                                                context = self.__action._get_context()
                                                logging.debug('Context data for JSON Serialize : %s' % context)
                                                self.response.out.write(simplejson.dumps(context))
                                        elif result is not None:
                                                template_path = self._find_template(result)
                                                if template_path:
                                                        self.response.out.write(template.render(template_path, self.__action._get_context()))
                                                logging.debug('Current result : %s' % result)
                                        else:
                                                logging.debug('Has no result.')
                        else:
                                self.error(405)
        
        def _find_template(self, result_name):
                result = TEMPLATES_PATH + os.path.sep + self.__action.__module__.replace('%s.' % ACTION_PACKAGE, '')
                action_class = self.__action.__class__.__name__
                if action_class is not 'Index':
                        result += os.path.sep + action_class.lower()
                        
                if result_name is not '':
                        result += os.path.sep + result_name 
                        
                result += TEMPLATES_SUFFIX
                
                logging.debug('Template path : %s' % result)
                return result

        def _import_action(self, request, response, action_name, action_class='Index'):
                module_name = '%s.%s' % (ACTION_PACKAGE, action_name)
                
                # Fast path: see if the module has already been imported.
                try:
                        module = sys.modules[module_name]
                except KeyError:
                        module = __import__(module_name, fromlist=[ACTION_PACKAGE])
                        logging.debug('Newer import of %s' % module)
                                        
                try:
                        klass = getattr(module, action_class)
                        self.__action = klass(request, response)
                except Exception:
                        import traceback
                        traceback.print_exc(logging.DEBUG)
                        logging.debug('An error occurred while importing action')

        def _set_language(self, request):
                lang = str(request.cookies.get(LANG_COOKIE_NAME, ''))
                if not lang:
                        logging.debug('Language cookie not found')
                        lang = 'en'
                        for item in str(request.accept_language).split(', '):
                                key = item.split(';')[0]
                                if self.__lang_map.has_key(key):
                                        lang = self.__lang_map[key]
                                        break
                        self.response.headers.add_header('Set-Cookie', '%s=%s' % (LANG_COOKIE_NAME, lang))
                logging.debug('Chosen language : %s' % lang)
                self.response.headers.add_header('Content-Language', lang)
                translation.activate(lang)
                request.lang = lang
        
        def _set_timezone(self, request):
                tz = str(request.cookies.get(TIMEZONE_COOKIE_NAME, ''))
                if not tz:
                        logging.debug('Timezone cookie not found')
                        geoipcode = get_geoipcode(self.request.remote_addr)
                        logging.debug('Geo IP Code is %s' % geoipcode)
                        if geoipcode in country_timezones:
                                tz_list = country_timezones(geoipcode)
                                if len(tz_list) > 0:
                                        tz = tz_list[0]
                        if not tz:
                                tz = pytz.utc.zone
                        self.response.headers.add_header('Set-Cookie', '%s=%s' % (TIMEZONE_COOKIE_NAME, tz))
                logging.debug('Chosen timezones : %s' % tz)     
                request.timezone = tz
                
        def get(self, *args):
                """Handler method for GET requests."""
                self._execute('get', *args)

        def post(self, *args):
                """Handler method for POST requests."""
                self._execute('post', *args)

        def head(self, *args):
                """Handler method for HEAD requests."""
                self._execute('head', *args)

        def options(self, *args):
                """Handler method for OPTIONS requests."""
                self._execute('options', *args)

        def put(self, *args):
                """Handler method for PUT requests."""
                self._execute('put', *args)

        def delete(self, *args):
                """Handler method for DELETE requests."""
                self._execute('delete', *args)

        def trace(self, *args):
                """Handler method for TRACE requests."""
                self._execute('trace', *args)
                                
class Action(object):
    
        def before(self, *args):
                """Trigger method before execute request"""
                pass
        
        def after(self, *args):
                """Trigger method after execute request"""
                pass    
                
        def __init__(self, request, response):
                """Initializes this with the given Request and Response."""
                self.request = request
                self.response = response
                
                self.__params = {}
                self.__context = {}
                self.__has_error = False
                
        def __setattr__(self, attr, value, DEFAULT=[]):
                if self._is_context_key(attr) :
                        self.__context[attr] = value
                else:
                        object.__setattr__(self, attr, value)
                
        def __getattr__(self, attr):
                if self._is_context_key(attr) :                 
                        try:
                                return self.__context[attr]
                        except KeyError:
                                raise AttributeError(attr)              
                else:
                        return object.__getattribute__(self, attr)
        
        def __delattr__(self, attr):
                if self._is_context_key(attr) :
                        try:
                                del self.__context[attr]
                        except KeyError:
                                raise AttributeError(attr)
                else:
                        return  object.__delattr__(self, attr)
                
        def _is_context_key(self, attr):
                return attr not in ['request','response'] and not attr.startswith('_')
                        
        def get_param(self, key):
                if self.has_param(key):
                        return self.__params[key]
                return None
        
        def has_param(self, key):
                return self.__params.has_key(key)

        def _set_params(self, params={}):
                self.__params = params
                self.__context.update(params)
                
        def set_context(self, context):
                self.__context = context                
                        
        def empty_context(self):
                self.__context = {}
                                
        def _get_context(self):
                return self.__context           
        
        def error(self, code):
                """Clears the response output stream and sets the given HTTP error code.

                Args:
                        code: the HTTP status error code (e.g., 501)
                """
                self.response.set_status(code)
                self.response.clear()
                self.__has_error = True
                
        def _has_error(self):
                return self.__has_error
                
        class Result(object):
                DEFAULT = ''
                SUCCESS = 'success'
                NONE = 'none'
                ERROR = 'error'
                INPUT = 'input'
                JSON = '__json__'