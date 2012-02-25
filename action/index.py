from lib.controller import Action
from google.appengine.api import users
import md5

class Index(Action):
    def get(self, category=None):
        user = users.get_current_user()
        if user:
            self.user = {'nickname': user.nickname(), 'email_hash': md5.new(user.email()).hexdigest()}  
        self.login_url = users.create_login_url(self.request.uri)
        self.logout_url = users.create_logout_url(self.request.uri)
        return Action.Result.DEFAULT
