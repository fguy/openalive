from lib.controller import Action
from models import Tag

class Index(Action):
    def get(self):
        self.list = Tag.get_top_list()
        return Action.Result.DEFAULT
