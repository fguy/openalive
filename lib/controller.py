from google.appengine.api import users, xmpp, mail, app_identity
from django.conf import settings
from django.utils import translation
from django import template
from django.template import loader
from lib.json_encoder import encode
from lib import PyRSS2Gen
from models import User
import json
import datetime
import logging
import os
import re
import threading
import sys
import urllib
import urlparse
import webapp2

ACTION_PACKAGE = 'action'
TEMPLATE_DIRS = (os.path.abspath('%s/../templates' % os.path.dirname(os.path.realpath(__file__))),)
TEMPLATE_SUFFIX = '.html'
LANG_MAP = {'ko' : ['ko-kr'], 'en' : ['en_US', 'en_GB'], 'ja' : [], 'fr' : [], 'es' : [], 'it' : [], 'ru' : [], 'th' : [], 'zh' : [], 'zh-CN' : [], 'zh-TW'  : []}
LANG_COOKIE_NAME = 'django_language'
NON_AJAX_CONTEXT_KEYS = ['is_ajax', 'is_crawler', 'lang', 'request', 'response', 'app']

class Controller(webapp2.RequestHandler):
    url_mapping = []
    
    def __init__(self, request, response):
        self.__lang_map = {}
        for key, lang_list in LANG_MAP.iteritems():
            self.__lang_map[key] = key
            for lang in lang_list:
                self.__lang_map[lang] = key
        settings.SETTINGS_MODULE = 'conf'
        if not template.libraries.get('lib.template_library', None):
            template.add_to_builtins('lib.template_library')
        super(self.__class__, self).__init__(request, response)
    
    def initialize(self, request, response):
        super(self.__class__, self).initialize(request, response)

        action_module = None
        action_instance = None
            
        if Controller.url_mapping:
            for regex, action_location in Controller.url_mapping:
                m = re.match(regex, urllib.unquote_plus(request.path).decode('utf-8'))
                if m:
                    action_module, action_instance = action_location
                    self._current_request_args = m.groups()
                    break
                    
        if not action_module and not action_instance: 
            '''supports 2 depth path'''
            path = request.path[1:].split('/')
            action_module = path[0]
            
            if not action_module :
                action_module = 'index'
            
            path_len = len(path)
            if path_len > 1:
                action_instance = ''.join([x.title() for x in path[1].split('-')])
                self._current_request_args = [urllib.unquote_plus(item).decode('utf-8') for item in path[2:]]
            else:
                action_instance = 'Index'
                self._current_request_args = []
            del path
        
        logging.debug('Current action module : %s, class : %s' % (action_module, action_instance))         
        self._import_action(action_module, action_instance)

    def _execute(self, method_name, *args):
        if not self.response:
            logging.debug('response is None')
            return
            
        self._set_language(self.request)
                            
        if not self.__action:
            logging.debug('Action is missing')
            self.error(404)
            return
        
        method = None
        try:
            method = getattr(self.__action, method_name)
        except AttributeError:
            logging.warn('Requested method "%s" not found on this action.' % method_name)
        
        if not method:
            self.error(405)
            return
        
        try:
            getattr(self.__action, 'before')()
            result = method(*(self._current_request_args if hasattr(self, '_current_request_args') else args))
            getattr(self.__action, 'after')()
        except Exception as e:
            self.handle_exception(e, self.request.app.debug)
            
        status = self.response._get_status()
        if not status.startswith('200'):
            message = self.response._get_status_message()
            if message:
                self.response.write(status)
            return
                
        output = self.request.get('output')
        
        if output == Action.Result.JSON or (output != Action.Result.HTML and result == Action.Result.DEFAULT and self.__action.is_ajax) or result is Action.Result.JSON:
            context = self.__action._get_context()
            for key in NON_AJAX_CONTEXT_KEYS:
                if hasattr(self.__action, key):
                    del context[key]
            logging.debug('Context data for JSON Serialize : %s' % context)
            self.response.headers['Content-type'] = 'application/json'
            self.response.out.write(encode(context))
        elif result and output in [Action.Result.RSS, Action.Result.RSS_JSON, Action.Result.RSS_JSON_XML, Action.Result.RSS_XML]:              
            print_rss(output, result, self.__action)            
        elif output == Action.Result.HTML or result is not None:
            template_path = self._find_template(result)
            if template_path:
                context = self.__action._get_context()
                if not self.__action.is_ajax:
                    user = users.get_current_user()
                    if user:
                        context['user'] = User.get_current()
                        context['logout_url'] = users.create_logout_url(self.request.uri)
                    else:
                        context['login_url'] = users.create_login_url(self.request.uri)                
                context['base'] = '_base/default.html' if not self.__action.is_ajax else '_base/ajax.html'
                context['settings'] = settings
                self.response.out.write(loader.get_template(template_path).render(template.context.Context(context)))
            logging.debug('Current result : %s' % result)
        else:
            logging.debug('Has no result.')
            
    def handle_exception(self, e, debug):
        self.response.set_status(500, e)
        if debug:
            if not self.__action.is_ajax:
                raise
            else:
                sys.stderr.write(e)
    
    def _find_template(self, result_name):
        if not isinstance(result_name, str):
            return None
        if result_name.startswith('/'):
            return result_name[1:]
        result = [self.__action.__module__.replace('%s.' % ACTION_PACKAGE, '')]
        action_instance = self.__action.__class__.__name__
        if action_instance is not 'Index':
            result.append(action_instance.lower())
                
        if result_name is not '' and result_name != Action.Result.HTML:
            result.append(result_name) 

        return '%s%s' % (os.path.sep.join(result), TEMPLATE_SUFFIX)

    def _import_action(self, action_name, action_instance='Index'):
        module_name = '%s.%s' % (ACTION_PACKAGE, action_name)
        
        # Fast path: see if the module has already been imported.
        try:
            module = sys.modules[module_name]
        except KeyError:
            module = __import__(module_name, fromlist=[ACTION_PACKAGE])
            logging.debug('Newer import of %s' % module)

        try:
            cls = getattr(module, action_instance)
            self.__action = cls(self.request, self.response)
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
            
    def __init__(self, request, response, context=None):
        """Initializes this with the given Request and Response."""
        self.request = request
        self.response = response
        self.__context = context if context is not None else {}
        arguments = request.arguments()
        self.is_ajax = 'is_ajax' in arguments or (request.headers.has_key('X-Requested-With') and request.headers['X-Requested-With'] == 'XMLHttpRequest')
        self.is_crawler = 'is_crawler' in arguments or re.search(r'facebookexternalhit|googlebot|mediapartners|adsbot|alexa|msnbot', request.headers['User-Agent'].lower())
            
            
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
        self.__context['request'] = self.request
        self.__context['response'] = self.response
        self.__context['app'] = app_identity
        return self.__context
    
    def get_json_payload(self):
        unqouted = urllib.unquote_plus(self.request.body).decode('utf8')
        if unqouted[-1:] != '}':
            unqouted = unqouted[:-1]
        return json.loads(unqouted)    
            
    class Result(object):
        DEFAULT = ''
        SUCCESS = 'success'
        NONE = 'none'
        ERROR = 'error'
        HTML = 'html'
        INPUT = 'input'
        RSS = 'rss'
        RSS_JSON = 'rss_json'
        RSS_XML = 'rss_xml'
        RSS_JSON_XML = 'rss_json_xml'
        JSON = 'json'


class Notification(threading.Thread):
    SENDER = '%s@appspot.com' % app_identity.get_application_id()
    
    def __init__(self, email, subject, body):
        super(self.__class__, self).__init__()
        self.email = email
        self.subject = subject
        self.body = body
        
    def run(self):
        if not xmpp.send_message(self.email, self.body) == xmpp.NO_ERROR:
            mail.send_mail(sender=self.__class__.SENDER, to=self.email, subject=self.subject, body=self.body)
            
    @classmethod
    def send(cls, email, subject, body):
        Notification(email=email, subject=subject, body=body).start()

def print_rss(output, result, action_instance):
    json_result = {'responseData': {}, 'responseDetails': None, 'responseStatus': 200}
    if output in [Action.Result.RSS, Action.Result.RSS_JSON_XML, Action.Result.RSS_XML]:
        feed = PyRSS2Gen.RSS2(
                            title=result['title'],
                            link=urllib.quote(result['link'].encode('utf8'), '/:?=#'),
                            description=result['description'],
                            lastBuildDate=datetime.datetime.utcnow(),
                            items=[PyRSS2Gen.RSSItem(
                                                    title=item['title'],
                                                    link=urllib.quote(item['link'].encode('utf8'), '/:?=#'),
                                                    description=item['content'],
                                                    pubDate=item['publishedDate'],
                                                    author=item['author'],
                                                    categories=item['categories'],
                                                    enclosure=PyRSS2Gen.Enclosure(url=item['enclosure']['url'], length=item['enclosure']['length'], type=item['enclosure']['type']) if item.has_key('enclosure') and item['enclosure'] else None
                                                    ) for item in result['entries']],
        )
        if output == Action.Result.RSS:
            action_instance.response.headers['Content-type'] = 'text/xml'
            feed.write_xml(action_instance.response.out, 'UTF-8')
            return
        json_result['responseData']['xmlString'] = feed.to_xml(encoding='UTF-8')
    if output in [Action.Result.RSS_JSON, Action.Result.RSS_JSON_XML]:
        json_result['responseData']['feed'] = result
    action_instance.response.out.write(json.dumps(json_result, default=lambda obj: obj.strftime('%a, %d %b %Y %H:%M:%S %z') if isinstance(obj, datetime.datetime) else None))    
