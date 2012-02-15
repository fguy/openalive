import logging

from google.appengine.api import users

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