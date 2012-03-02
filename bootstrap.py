import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'settings'

from lib import appengine_admin
from lib.controller import Controller
from models import Category
import admin
import webapp2

categories = '|'.join(Category.get_all_categories())
Controller.url_mapping = [
                          (r'^/([0-9]+)$', ('service', 'Article')),
                          (r'^/user/([0-9]+)$', ('user', 'Index')),
                          (r'^/user/me$', ('user', 'Index')),
                        ]
if categories:
    Controller.url_mapping.append((ur'^/(%s)$' % categories, ('service', 'Category')))

app = webapp2.WSGIApplication([
                                      (r'^(/admin)(.*)$', appengine_admin.Admin),
                                      ('/.*', Controller)],
                                                                             debug=True)