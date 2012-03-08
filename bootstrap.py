import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'settings'

from lib.controller import Controller
from models import Category
import webapp2
import settings

categories = '|'.join(Category.get_all_categories())
Controller.url_mapping = [
                          (r'^/([0-9]+)$', ('service', 'Article')),
                          (r'^/user/([0-9]+)$', ('user', 'Index')),
                          (r'^/user/me$', ('user', 'Index')),
                        ]
if categories:
    Controller.url_mapping.append((ur'^/(%s)$' % categories, ('service', 'Category')))

app = webapp2.WSGIApplication([('/.*', Controller)], debug=settings.DEV)
