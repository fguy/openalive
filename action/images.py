from lib.controller import Action
from models import ImageArticle

class Index(Action):
    LIMIT = 20
    def get(self):
        self.limit = self.LIMIT
        self.list = ImageArticle.get_list(limit=self.limit, offset=int(self.request.get('offset', 0)))
        return Action.Result.DEFAULT
