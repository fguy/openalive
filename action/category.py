from action import feed
from google.appengine.api import memcache
from lib.controller import Action
from lib.decorators import rss
import models
import urllib
from math import floor

class Index(Action):
    CACHE_KEY = 'category-list'
    
    def get(self, category_name=None):
        cached_categories = memcache.get(self.CACHE_KEY)
        if not cached_categories:
            cached_categories = {}
        if not cached_categories.has_key(category_name):
            current_category = None
            if category_name:
                current_category = models.Category.get_by_name(category_name) 
            self.category_list = models.Category.get_list(current_category)
            self.current_category = current_category
            cached_categories[category_name] = {'category_list': self.category_list, 'current_category': current_category}
            memcache.set(self.CACHE_KEY, cached_categories)
        else:
            self.category_list = cached_categories[category_name]['category_list']
            self.current_category = cached_categories[category_name]['current_category']
            
        if self.is_crawler:
            if self.current_category:
                self.page_range = range(1, int(floor(self.current_category.article_count / ArticleList.LIST_PER_PAGE)) + 2)
        elif not self.is_ajax:
            self.redirect(('/#!/%s' % urllib.quote(self.current_category.name.encode('utf8')) if self.current_category else '/'))
            
        return Action.Result.DEFAULT

class ArticleList(Action):
    LIST_PER_PAGE = 20

    @rss(feed.Category)
    def get(self, category_name):
        page = int(self.request.get('page', 1))
        offset = (page - 1) * self.LIST_PER_PAGE
        category = models.Category.get_by_name(category_name)
        self.list = models.Article.get_list(category, self.LIST_PER_PAGE, offset) if category else None
        self.count = category.article_count if category else 0
        if self.is_crawler:
            self.category = category
        elif not self.is_ajax:
            self.redirect('/#!/%s?page=%d' % (urllib.quote(category.name.encode('utf8')), page))
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