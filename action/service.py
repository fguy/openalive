from google.appengine.api import users
from lib.controller import Action
from lib.decorators import login_required
import models
import simplejson as json
from gettext import gettext as _

class Article(Action):
    @login_required
    def post(self, category_name):
        self.article = models.Article(
                       author=models.User.get_current(),
                       title=self.request.get('title'),
                       body=self.request.get('body'),
                       category=models.Category.get_by_name(category_name),
                       tags=models.Tag.save_all(self.request.get('tags').split(','))
                       ).save()
        return Action.Result.DEFAULT
    
    @login_required
    def put(self):
        params = json.loads(self.request.body)
        article_id = int(params['id'])
        article = models.Article.get_by_id(article_id)
        if article.author.user != users.get_current_user():
            raise users.NotAllowedError(_('Only the author can edit this article.'))        
        article.title = params['title']
        article.body = params['body']
        tag_string = params['tags']
        if tag_string:
            tags = models.Tag.save_all(tag_string.split(','))
            if article.tags:
                models.Tag.decrease(list(set(article.tags)-set([item for item in tags])))
            article.tags = tags
        article.save()
        self.article = article
        return Action.Result.DEFAULT

    @login_required
    def delete(self, article_id):
        article = models.Article.get_by_id(int(article_id))
        if article.author.user != users.get_current_user():
            raise users.NotAllowedError(_('Only the author can delete this article.'))
        article.delete()
        return Action.Result.DEFAULT
    
    def get(self, article_id):
        article_id = int(article_id)
        self.article = models.Article.get_by_id(article_id)
        if self.article:
            self.tags = models.Tag.get(self.article.tags)
            self.comment_list = models.Comment.get_list(self.article)
            self.best_comment_list = models.Comment.get_best(self.article)
        user = users.get_current_user()
        for item in models.Reputation.types:
            if user:
                setattr(self, '%sd' % item, models.Reputation.exists(article_id, item))
            setattr(self, '%sd-users' % item, [])
        for item in models.Reputation.get_list(obj_id=article_id, limit=5):
            getattr(self, '%sd-users' % item['type']).append(item)
        if user:
            self.subscribed = models.Subscription.is_subscribed(self.article)
        return Action.Result.DEFAULT
    
class Comment(Action):
    def get(self, article_id):
        offset = int(self.request.get('offset'))
        self.comment_list = models.Comment.get_list(article=models.Article.get_by_id(int(article_id)), offset=offset)
        return Action.Result.DEFAULT
    
    @login_required
    def post(self, article_id, comment_id=None):
        comment = models.Comment(
                                      article=models.Article.get_by_id(int(article_id)),
                                      author=models.User.get_current(),
                                      body=self.request.get('body'),
                                      )
        if comment_id is not None:
            comment.parent_comment = models.Comment.get_by_id(int(comment_id))
        self.comment = comment.save().to_dict()
        return Action.Result.DEFAULT
    
    @login_required
    def delete(self, comment_id):
        comment = models.Comment.get_by_id(int(comment_id))
        if comment.author.user != users.get_current_user():
            raise users.NotAllowedError(_('Only the author can delete this comment.'))
        comment.delete()
        return Action.Result.DEFAULT    

class User(Action):
    def get(self, user_id = None):
        self.user = models.User.get_by_id(user_id) if user_id else models.User.get_current()
        return Action.Result.DEFAULT
    
    @login_required
    def put(self):
        user = models.User.get_current()
        user.put()
        return Action.Result.DEFAULT
    
class UserArticleList():
    LIST_PER_PAGE = 20
    
    def get(self, user_id, page):
        page = int(self.request.get('page', 1))
        offset = (page - 1) * self.LIST_PER_PAGE        
        self.article_list = models.User.get_article_list(self.LIST_PER_PAGE, offset, self.request.get('sort', 'created'))
        return Action.Result.DEFAULT
            
class ArticleList(Action):
    LIST_PER_PAGE = 20
    def get(self, category_name):
        page = int(self.request.get('page', 1))
        offset = (page - 1) * self.LIST_PER_PAGE
        category = models.Category.get_by_name(category_name)
        self.list = models.Article.get_list(category, self.LIST_PER_PAGE, offset) if category else None
        self.count = category.article_count if category else 0
        return Action.Result.DEFAULT  
    
class Category(Action):
    def get(self, category_name=None):
        current_category = None
        if category_name:
            current_category = models.Category.get_by_name(category_name) 
        self.category_list = models.Category.get_list(current_category)
        self.current_category = current_category     
        return Action.Result.DEFAULT
    
class Reputation(Action):
    reputation = None
    @login_required
    def post(self, obj_class, obj_id):
        models.Reputation(keys_name = '%s-%s' % (obj_class, obj_id), obj_class=obj_class, obj_id=int(obj_id), user=models.User.get_current(), reputation=self.reputation).put()
        return Action.Result.DEFAULT
    
    @login_required
    def delete(self, obj_class, obj_id):
        reputation = models.Reputation.get_one(obj_id=int(obj_id), reputation=self.reputation)
        if reputation.user.user != users.get_current_user():
            raise users.NotAllowedError(_('You did not give an reputation for this.'))
        reputation.delete()
        return Action.Result.DEFAULT    
    
    def get(self, obj_id):
        self.count = models.Reputation.get_list(int(obj_id), self.reputation)
        return Action.Result.DEFAULT
    
class Like(Reputation):
    reputation = 'like'

class Hate(Reputation):
    reputation = 'hate'
    
class StarredCategory(Action):
    def get(self):
        self.starred_category_list = models.StarredCategory.get_list()
        return Action.Result.DEFAULT
    
    @login_required
    def post(self, category_name):
        models.StarredCategory.star(models.Category.get_by_name(category_name))
        return Action.Result.DEFAULT
    
    def delete(self, category_name):
        models.StarredCategory.unstar(models.Category.get_by_name(category_name))
        return Action.Result.DEFAULT