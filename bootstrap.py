from google.appengine.ext import webapp
from lib.controller import Controller
from lib import appengine_admin
from models import Category
import wsgiref.handlers
import admin

def main():
    Controller.url_mapping = (
                              (ur'^/(%s)$' % '|'.join(Category.get_all_categories()), ('service', 'Category')),
                              (r'^/([0-9]+)$', ('service', 'Article')),
                              (r'^/user/([0-9]+)$', ('user', 'Index')),
                            )    
    application = webapp.WSGIApplication([
                                          (r'^(/admin)(.*)$', appengine_admin.Admin),
                                          ('/.*', Controller)],
                                                                             debug=True)
    wsgiref.handlers.CGIHandler().run(application)
    webapp.template.register_template_library('lib.template_library')

if __name__ == '__main__':
    main()
