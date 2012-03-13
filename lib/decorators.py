from google.appengine.api import users
from lib.controller import Action, print_rss
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
			action_instance = args[0]
			action_instance.response.set_status(302)
			action_instance.response.headers['Location'] = str(users.create_login_url(action_instance.request.uri))
			action_instance.response.clear()
		else:
			logging.debug('Current user found')
			return method(*args)
	return new

def rss(rss_action_class):
	def wrap(action_method):			
		def wrapped_f(*args):
			action_instance = args[0]
			output = action_instance.request.get('output')
			if output in [Action.Result.RSS, Action.Result.RSS_JSON, Action.Result.RSS_XML, Action.Result.RSS_JSON_XML]:
				result = getattr(rss_action_class(action_instance.request, action_instance.response, action_instance._get_context()), 'get')(*args[1:])
				if result:
					print_rss(output, result, action_instance)						
				else:
					action_instance.response.set_status(404)
			else:
				return action_method(*args)
		return wrapped_f
	return wrap
