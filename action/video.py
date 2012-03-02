from lib.controller import Action
from models import Article

class Index(Action):
    LIMIT = 20
    def get(self):
        self.limit = 20
        self.list = Article.get_video_list(limit=20, offset=int(self.request.get('offset', 0)))
        return Action.Result.DEFAULT
