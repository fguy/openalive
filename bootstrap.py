from google.appengine.ext import webapp
from lib.controller import Controller
from lib import appengine_admin
from models import Category
import wsgiref.handlers
import admin

def main():
    categories = '|'.join(Category.get_all_categories())
    Controller.url_mapping = [
                              (r'^/([0-9]+)$', ('service', 'Article')),
                              (r'^/user/([0-9]+)$', ('user', 'Index')),
                            ]
    if categories:
        Controller.url_mapping.append((ur'^/(%s)$' % categories, ('service', 'Category')))
                 
    application = webapp.WSGIApplication([
                                          (r'^(/admin)(.*)$', appengine_admin.Admin),
                                          ('/.*', Controller)],
                                                                             debug=True)
    wsgiref.handlers.CGIHandler().run(application)
    webapp.template.register_template_library('lib.template_library')

if __name__ == '__main__':
    main()
