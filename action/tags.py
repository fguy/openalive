from lib.controller import Action
from models import Tag

class Index(Action):
    def get(self):
        self.list = Tag.get_top_list()
        min = 0
        max = 0
        for item in self.list:
            if min == 0 or item.count < min:
                min = item.count
            if item.count > max:
                max = item.count
        self.min = min
        self.max = max 
        return Action.Result.DEFAULT

class All(Action):
    pass
