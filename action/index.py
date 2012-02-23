from lib.controller import Action
from google.appengine.api import users

class Index(Action):
    def get(self, category=None):
        self.user = users.get_current_user()
        self.login_url = users.create_login_url(self.request.uri)
        self.logout_url = users.create_logout_url(self.request.uri)
        return Action.Result.DEFAULT
