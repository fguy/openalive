from lib.controller import Action
from models import Tag

class Index(Action):      
    def get(self):
        self.list = Tag.get_top_list()
        max_count = 0
        for item in self.list:
            if item.count > max_count:
                max_count = item.count
        self.max = max_count
        return Action.Result.DEFAULT
    
class Article(Action):
    def get(self, tag_name):
        self.article_list = Tag.get_article_list(tag=tag_name, limit=int(self.request.get('limit', 20)), offset=int(self.request.get('offset', 0)))
        return Action.Result.DEFAULT