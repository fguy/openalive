from lib.controller import Action
from lib.decorators import login_required
import models

class Article(Action):
    LIST_PER_PAGE = 20
    @login_required
    def post(self, category):
        self.article = models.Article(
                       author=models.User.get_current(),
                       title=self.request.get('title'),
                       body=self.request.get('body'),
                       category=models.Category.get_by_name(category),
                       tags=models.Tag.save_all(self.request.get('tags').split(','))
                       ).save()
        return Action.Result.DEFAULT
    
    def get(self, article_id):
        self.article = models.Article.get_by_id(int(article_id))
        self.tags = models.Tag.get(self.article.tags)
        return Action.Result.DEFAULT
            
class ArticleList(Action):
    def get(self, category):
        page = int(self.request.get('page', 1))
        offset = (page - 1) * Article.LIST_PER_PAGE
        category_obj = models.Category.get_by_name(category)
        self.list = models.Article.get_list(category_obj, Article.LIST_PER_PAGE, offset)
        self.count = category_obj.article_count
        return Action.Result.DEFAULT  
    
class Category(Action):
    def get(self, category=None):
        current_category = None
        if category:
            current_category = models.Category.get_by_name(category) 
        self.category_list = models.Category.get_list(current_category)
        self.current_category = current_category     
        return Action.Result.DEFAULT   