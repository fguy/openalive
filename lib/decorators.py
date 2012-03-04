from action import rss as rss_module
from google.appengine.api import users
from lib.controller import Action
import logging


def login_required(method):
	"""A decorator to require that a user be logged in to access a handler.

	To use it, decorate your get() method like this:

	@login_required
	def get(self):
		user = users.get_current_user(self)
		self.response.out.write('Hello, ' + user.nickname())

	We will redirect to a login page if the user is not logged in. We always
	redirect to the request URI, and Google Accounts only redirects back as a GET
	request, so this should not be used for POSTs.
	"""	
	def new(*args):
		if not users.get_current_user():
			logging.debug('Current user not found')
			action = args[0]
			action.response.set_status(302)
			action.response.headers['Location'] = str(users.create_login_url(action.request.uri))
			action.response.clear()
		else:
			logging.debug('Current user found')
			return method(*args)
	return new

def rss(rss_action_class):
	def wrap(action_method):
		def wrapped_f(*args):
			action_class = args[0]
			if action_class.request.get('output') == Action.Result.RSS:
				result = getattr(rss_action_class(action_class.request, action_class.response, action_class._get_context()), 'get')(*args[1:])
				if hasattr(result, 'write_xml'):
					action_class.response.headers['Content-type'] = 'text/xml'
					result.write_xml(action_class.response.out, 'utf-8')
				else:
					action_class.response.set_status(404)
			else:
				return action_method(*args)
		return wrapped_f
	return wrap