from django.conf import settings
from django.utils import translation
from google.appengine.ext import webapp
from google.appengine.ext.webapp import template
from lib.json import encode
import action
import logging
import os
import re
import sys
import urllib
import urlparse

ACTION_PACKAGE = 'action'
TEMPLATES_PATH = os.path.abspath('%s/../templates' % os.path.dirname(os.path.realpath(__file__)))
TEMPLATES_SUFFIX = '.html'
LANG_MAP = {'ko' : ['ko-kr'], 'en' : ['en_US', 'en_GB'], 'ja' : [], 'fr' : [], 'es' : [], 'it' : [], 'ru' : [], 'th' : [], 'zh' : [], 'zh-CN' : [], 'zh-TW'  : []}
LANG_COOKIE_NAME = 'django_language'

class Controller(webapp.RequestHandler):
    url_mapping = []
    
    def __init__(self):
        self.__lang_map = {}
        for key, lang_list in LANG_MAP.iteritems():
            self.__lang_map[key] = key
            for lang in lang_list:
                self.__lang_map[lang] = key
        self.__base_template = template.load('%s/base.html' % TEMPLATES_PATH)
        settings.SETTINGS_MODULE = 'conf'
    
    def initialize(self, request, response):
        self.response = response
        self.request = request
            
        action_module = None
        action_class = None
            
        if Controller.url_mapping:
            for regex, action_location in Controller.url_mapping:
                m = re.match(regex, urllib.unquote_plus(request.path).decode('utf-8'))
                if m:
                    action_module, action_class = action_location
                    self._current_request_args = m.groups()
                    break
                    
        if not action_module and not action_class: 
            '''supports 2 depth path'''
            path = request.path[1:].split('/')
            action_module = path[0]
            
            if not action_module :
                action_module = 'index'
            
            self._current_request_args = {}
            path_len = len(path)
            if path_len > 1:
                action_class = ''.join([x.title() for x in path[1].split('-')])
                self._current_request_args = [urllib.unquote_plus(item).decode('utf-8') for item in path[2:]]
            else:
                action_class = 'Index'
            del path
        
        logging.debug('Current action module : %s, class : %s' % (action_module, action_class))         
        self._import_action(action_module, action_class)

    def _execute(self, method_name, *args):
        if not self.response:
            logging.debug('response is None')
            return
            
        self._set_language(self.request)
                            
        if not self.__action:
            logging.debug('Action is missing')
            self.error(404)
        else:
            self.__action.is_ajax = self.request.headers.has_key('X-Requested-With') and self.request.headers['X-Requested-With'] == 'XMLHttpRequest'
            method = None
            try:
                method = getattr(self.__action, method_name)
            except AttributeError:
                logging.warn('Requested method "%s" not found on this action.' % method_name)
            
            if method:
                getattr(self.__action, 'before')()
                result = method(*(self._current_request_args if hasattr(self, '_current_request_args') else args))
                getattr(self.__action, 'after')()

                self.__action.lang = self.request.lang
                
                if (result is Action.Result.DEFAULT and self.__action.is_ajax) or result is Action.Result.JSON:
                    del self.__action.is_ajax
                    del self.__action.lang                                          
                    context = self.__action._get_context()
                    logging.debug('Context data for JSON Serialize : %s' % context)
                    self.response.out.write(encode(context))
                elif result is not None:
                    template_path = self._find_template(result)
                    if template_path:
                        context = self.__action._get_context()
                        context['base'] = '%s%s' % (TEMPLATES_PATH, '/_base/default.html' if not self.__action.is_ajax else '/_base/ajax.html')
                        self.response.out.write(template.render(template_path, context))
                    logging.debug('Current result : %s' % result)
                else:
                    logging.debug('Has no result.')
            else:
                self.error(405)
    
    def _find_template(self, result_name):
        if result_name.startswith('/'):
            return '%s%s' % (TEMPLATES_PATH, result_name)
        result = [TEMPLATES_PATH, self.__action.__module__.replace('%s.' % ACTION_PACKAGE, '')]
        action_class = self.__action.__class__.__name__
        if action_class is not 'Index':
            result.append(action_class.lower())
                
        if result_name is not '' and result_name != Action.Result.HTML:
            result.append(result_name) 

        return '%s%s' % (os.path.sep.join(result), TEMPLATES_SUFFIX)

    def _import_action(self, action_name, action_class='Index'):
        module_name = '%s.%s' % (ACTION_PACKAGE, action_name)
        
        # Fast path: see if the module has already been imported.
        try:
            module = sys.modules[module_name]
        except KeyError:
            module = __import__(module_name, fromlist=[ACTION_PACKAGE])
            logging.debug('Newer import of %s' % module)

        try:
            klass = getattr(module, action_class)
            self.__action = klass(self.request, self.response)
        except Exception:
            import traceback
            traceback.print_exc(logging.ERROR)
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
    
    def redirect(self, uri, permanent=False):
        """Issues an HTTP redirect to the given relative URL.
    
        Args:
          uri: a relative or absolute URI (e.g., '../flowers.html')
          permanent: if true, we use a 301 redirect instead of a 302 redirect
        """
        if permanent:
            self.response.set_status(301)
        else:
            self.response.set_status(302)
        absolute_url = urlparse.urljoin(self.request.uri, uri)
        self.response.headers['Location'] = str(absolute_url)
        self.response.clear()  
          
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
        self.__context = {}        
            
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
        return attr not in ['request', 'response'] and not attr.startswith('_')
            
    def set_context(self, context):
        self.__context = context                
                    
    def empty_context(self):
        self.__context = {}
                            
    def _get_context(self):
        return self.__context 
            
    class Result(object):
        DEFAULT = ''
        SUCCESS = 'success'
        NONE = 'none'
        ERROR = 'error'
        HTML = 'html'
        INPUT = 'input'
        JSON = '__json__'
