from lib.controller import Action
from models import Tag

class ArticleList(Action):
    LIST_PER_PAGE = 20
    def get(self, tag_name):
        page = int(self.request.get('page', 1))
        offset = (page - 1) * self.LIST_PER_PAGE
        tag = Tag.get_by_name(tag_name)
        self.list = Tag.get_article_list(tag=tag, limit=self.LIST_PER_PAGE, offset=offset) if tag else None
        self.count = tag.count if tag else 0
            
        return Action.Result.DEFAULT