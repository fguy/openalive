from action import feed
from google.appengine.api import memcache
from lib.controller import Action
from lib.decorators import rss
import models

class ArticleList(Action):
    LIST_PER_PAGE = 20

    @rss(feed.Category)
    def get(self, category_name):
        page = int(self.request.get('page', 1))
        offset = (page - 1) * self.LIST_PER_PAGE
        category = models.Category.get_by_name(category_name)
        self.list = models.Article.get_list(category, self.LIST_PER_PAGE, offset) if category else None
        self.count = category.article_count if category else 0
        return Action.Result.DEFAULT  

class Top(Action):
    CACHE_KEY = 'category-top'
    def get(self):
        result = memcache.get(self.CACHE_KEY)
        if not result:
            result = models.Category.get_top_level()
            memcache.set(self.CACHE_KEY, result)
        self.list = result
        return Action.Result.JSON