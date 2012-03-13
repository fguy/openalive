from google.appengine.api import users
from lib.controller import Action
from models import User

class Index(Action):
    def get(self):
        user = users.get_current_user()
        if user:
            self.user = User.get_current()
            self.logout_url = users.create_logout_url(self.request.uri)
        else:
            self.login_url = users.create_login_url(self.request.uri)
        
        return Action.Result.DEFAULT
