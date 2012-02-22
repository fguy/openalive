from google.appengine.ext import webapp
from lib.controller import Controller
from lib import appengine_admin
from models import Category
import wsgiref.handlers
import admin

Controller.url_mapping.append((ur'^/(%s)$' % '|'.join(Category.get_all_categories()), ('index', 'Index')))

def main():
    application = webapp.WSGIApplication([
                                          (r'^(/admin)(.*)$', appengine_admin.Admin),
                                          ('/.*', Controller)],
                                                                             debug=True)
    wsgiref.handlers.CGIHandler().run(application)
    webapp.template.register_template_library('lib.template_library')

if __name__ == '__main__':
    main()
