from lib.controller import Action
from lib.decorators import rss
import action
import models

class ArticleList(Action):
    LIST_PER_PAGE = 20
    
    @rss(action.rss.CategoryArticleList)
    def get(self, category_name):
        page = int(self.request.get('page', 1))
        offset = (page - 1) * self.LIST_PER_PAGE
        category = models.Category.get_by_name(category_name)
        self.list = models.Article.get_list(category, self.LIST_PER_PAGE, offset) if category else None
        self.count = category.article_count if category else 0
        return Action.Result.DEFAULT  