from lib.controller import Action
from google.appengine.api import users

class Category(Action):
    def get(self):
        return Action.Result.DEFAULT
