import wsgiref.handlers
from lib.controller import Controller

from google.appengine.ext import webapp

def main():
        application = webapp.WSGIApplication([('/.*', Controller)],
                                                                                 debug=True)
        wsgiref.handlers.CGIHandler().run(application)
        webapp.template.register_template_library('lib.template_library')

if __name__ == '__main__':
        main()
