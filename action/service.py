from action import feed
from gettext import gettext as _
from google.appengine.api import users, memcache
from lib.controller import Action
from lib.decorators import login_required, rss
from lib.recaptcha.client import captcha
import models
import settings
import urllib

try:
    import json
except ImportError:
    import simplejson as json
    
class Article(Action):
    def _captcha_validation(self, challenge, response):
        if settings.DEV:
            return True
        captcha_result = captcha.submit(challenge, response, settings.RECAPTCHA_PRIVATE_KEY, self.request.remote_addr)
        if not captcha_result.is_valid:
            self.response.set_status(412, _('Captcha code mismatch: %s') % captcha_result.error_code)
            return False
        return True

    @login_required
    def post(self, category_name):
        if self._captcha_validation(self.request.get('recaptcha_challenge_field'), self.request.get('recaptcha_response_field')):
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
        self._captcha_validation(params['recaptcha_challenge_field'], params['recaptcha_response_field'])
        article_id = int(params['id'])
        article = models.Article.get_by_id(article_id)
        if article.author.user != users.get_current_user():
            raise users.NotAllowedError(_('Only the author can edit this article.'))        
        article.title = params['title']
        article.body = params['body']
        tag_string = params['tags']
        if tag_string:
            article.tags = models.Tag.save_all(tag_string.split(','))
        article.save()
        self.article = article
        self.tags = models.Tag.get(article.tags)
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
            self.comment_list = models.Comment.get_list(self.article, limit=5)
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

        if not self.is_ajax and not self.request.headers.has_key('X-Robots-Tag') and self.request.headers['User-Agent'].find('facebookexternalhit') == -1:
            self.redirect('/#!/%s/%s' % (urllib.quote(self.article.category.name.encode('utf8')), self.article.key().id()))
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
    
class Category(Action):
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
        self.user_list = models.Reputation.get_list(obj_id=int(obj_id), reputation=self.reputation, offset=int(self.request.get('offset', 0)), limit=int(self.request.get('limit', 1000)))
        return '/users.html'
    
    
class Subscription(Action):
    @login_required
    def post(self, article_id):
        article = models.Article.get_by_id(int(article_id))
        models.Subscription(keys_name = article_id, article=article, user=models.User.get_current()).put()
        return Action.Result.DEFAULT
    
    @login_required
    def delete(self, article_id):
        article = models.Article.get_by_id(int(article_id))
        subscription = models.Subscription.get_one(article)
        if subscription.user.user != users.get_current_user():
            raise users.NotAllowedError(_('You did not give an reputation for this.'))
        subscription.delete()
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