from google.appengine.api import users
from lib import PyRSS2Gen
from lib.controller import Action
import json
import datetime
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
		def get_enclosure(item):
			if not item.has_key('mediaGroups') or len(item['mediaGroups']) == 0 or not item['mediaGroups'][0].has_key('contents') or len(item['mediaGroups'][0]['contents']) == 0:
				return None
			enclosure = item['mediaGroups'][0]['contents'][0]
			return PyRSS2Gen.Enclosure(url = enclosure['url'], length = 10000, type = enclosure['medium'])
			
		def wrapped_f(*args):
			action_class = args[0]
			output = action_class.request.get('output')
			if output == Action.Result.RSS or output == Action.Result.RSSJSON:
				result = getattr(rss_action_class(action_class.request, action_class.response, action_class._get_context()), 'get')(*args[1:])
				if result:
					if output == Action.Result.RSS:
						feed = PyRSS2Gen.RSS2(
						            			title = result['title'],
						               			link = result['link'],
						            	     	description = result['description'],
						            	      	lastBuildDate = datetime.datetime.utcnow(),
						            			items = [PyRSS2Gen.RSSItem(
																		title=item['title'], 
																		link=item['link'], 
																		description=item['contentSnippet'], 
																		pubDate=item['publishedDate'], 
																		author=item['author'], 
																		categories=item['categories'], 
																		enclosure=get_enclosure(item)
																		) for item in result['entries']],
						)
						action_class.response.headers['Content-type'] = 'text/xml'		
						feed.write_xml(action_class.response.out, 'utf-8')
					elif output == Action.Result.RSSJSON:
						action_class.response.out.write(json.dumps(result, default=lambda obj: obj.strftime('%a, %d %b %Y %H:%M:%S 0000') if isinstance(obj, datetime.datetime) else None))
				else:
					action_class.response.set_status(404)
			else:
				return action_method(*args)
		return wrapped_f
	return wrap