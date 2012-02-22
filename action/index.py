from lib.controller import Action
from google.appengine.api import users
import models

class Index(Action):
    def get(self, category=None):
        if not self.is_ajax:
            self.user = users.get_current_user()
            self.login_url = users.create_login_url(self.request.uri)
            self.logout_url = users.create_logout_url(self.request.uri)
        current_category = None
        if category:
            current_category = models.Category.get_by_name(category) 
        self.category_list = models.Category.get_list(current_category)
        self.current_category = current_category
        return Action.Result.DEFAULT
