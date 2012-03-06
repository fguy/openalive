from lib.controller import Action
from models import Tag

class Index(Action):
    def get(self, tag_name=None):
        self.list = Tag.get_top_list()
        max_count = 0
        for item in self.list:
            if item.count > max_count:
                max_count = item.count
        self.max = max_count
        return Action.Result.DEFAULT

class All(Action):
    pass
