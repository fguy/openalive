from copy import deepcopy
from google.appengine.api import users
from google.appengine.api.datastore_errors import BadValueError
from google.appengine.ext import db
from lib import bleach
import datetime
import logging

class User(db.Model):
    user = db.UserProperty(required=True)
    nickname = db.StringProperty()
    joined = db.DateTimeProperty(auto_now=True)
    article_count = db.IntegerProperty(default=0)
    comment_count = db.IntegerProperty(default=0)
    locale = db.StringProperty()
    signature = db.TextProperty()
    
    @classmethod
    def nickname_exists(cls, nickname):
        return User.gql('WHERE nickname = :1', nickname).get() != None
    
    def change_nickname(self, nickname):
        UserNicknameHistory(user = self, nickname = self.nickname).put()
        self.nickname = nickname
        self.put()
    
class UserNicknameHistory(db.Model):
    user = db.ReferenceProperty(reference_class=User, required=True)
    nickname = db.StringProperty()
    changed = db.DateTimeProperty(auto_now=True)

class Tag(db.Model):
    content = db.StringListProperty()
    count = db.IntegerProperty(default=0)
    
    def normalize(self, tag):
        pass

class Article(db.Model): # Can be used as comment
    author = db.ReferenceProperty(reference_class=User, required=True)
    title = db.StringProperty()
    body = db.TextProperty(required=True)
    geo_pt = db.GeoPtProperty()
    created = db.DateTimeProperty(auto_now=True)
    last_updated = db.DateTimeProperty()
    children_count = db.IntegerProperty(default=0)
    like_count = db.IntegerProperty(default=0)
    hate_count = db.IntegerProperty(default=0)
    parent_article = db.SelfReferenceProperty(required=False) # for comment purpose
    tags = db.ListProperty(db.Key)
    sort_key = db.StringProperty(required=False) # to sort comments 
    is_active = db.BooleanProperty(default=True)
    
    def delete(self):
        self.last_updated = datetime.datetime.now()
        self.is_active = False
        if self.parent_article:
            self.parent_article.children_count -= 1
            self.parent_article.put()
        self.put()
    
    def save_article(self, categories=None):
        self.title = bleach.clean(self.title)
        self.body = bleach.clean(self.body, tags=['p', 'span', 'div', 'strong', 'b', 'em', 'i', 'blockquote', 'sub', 'sup', 'img', 'iframe'], attributes=['style', 'title', 'src', 'frameborder', 'width', 'height', 'alt'], styles=['width', 'height', 'font-size', 'font-family', 'text-decoration', 'color', 'background-color', 'text-align', 'padding-left'])
        is_insert = not self.is_saved()
        if not is_insert:
            self.last_updated = datetime.datetime.now()
        super(Article, self).put()
        if is_insert:
            self.writer.article_count += 1
        if categories:
            article_categories = [item.category for item in ArticleCategory.all().filter(article=self)]
            for category in article_categories:
                if category not in categories:
                    ArticleCategory.gql('WHERE article=:article AND category=:category', article=self, category=category).get().delete()
            for category in categories:
                if category not in article_categories:
                    ArticleCategory.get_or_insert(ArticleCategory.gql('WHERE article=:article AND category=:category', article=self, category=category).get().key(), article=self, category=category)

    def save_comment(self):
        self.body = bleach.linkify(bleach.clean(self.body), parse_email=True)
        is_insert = not self.is_saved()
        if not is_insert:
            self.last_updated = datetime.datetime.now()
        super(Article, self).put()
        if is_insert:
            self.sort_key = '%s%s' % (self.parent_article.sort_key, self.key().name()) if self.parent_article.sort_key else '%s' % self.key().name()
            super(Article, self).put()
            self.parent_article.children_count += 1
            self.parent_article.put()
    
    @classmethod
    def get_comment_list(cls, limit, offset, orderby='sort_key'):
        query = Article.all()
        query.filter('parent_article =', self)
        query.filter('is_active = ', True)
        query.order('-%s' % orderby)
        return query.fetch(limit, offset)
    
    @classmethod
    def get_list(cls, limit, offset, orderby='created'):
        query = Article.all()
        query.filter('is_active = ', True)
        query.order('-%s', orderby)
        return query.fetch(limit, offset)        
    
    
class Reputation(db.Model):
    article = db.ReferenceProperty(reference_class=Article, required=True)
    user = db.ReferenceProperty(reference_class=User, required=True)
    created = db.DateTimeProperty(auto_now=True)
    reputation = db.StringProperty(required=True, choices=['like', 'hate'])
    
    def put(self):
        cnt = getattr(self.article, self.reputation + '_count')
        cnt += 1
        self.article.save()
        
    def delete(self):
        cnt = getattr(self.article, self.reputation + '_count')
        cnt -= 1
        self.article.save()
    
    @classmethod
    def exists(cls, article_id):
        return Reputation.all().gql('WHERE article=:article AND user=:user', article=Article.get_by_id(article_id), user=users.get_current_user()).get() is not None
    
class Category(db.Model):
    category = db.CategoryProperty(required=True)
    parent_category = db.SelfReferenceProperty(required=False, default=None)
    description = db.TextProperty(default='')
    article_count = db.IntegerProperty(default=0)
    starred_count = db.IntegerProperty(default=0)
    path = db.StringListProperty()
    created = db.DateTimeProperty(auto_now=True)
    is_active = db.BooleanProperty(default=True)
    
    def put(self):
        self.category = bleach.clean(self.category)
        if not self.is_saved() and self.parent_category:
            self.path = deepcopy(self.parent_category.path)
        elif self.parent_category:
            self.path.pop()
        else:
            self.path = []
        self.path.append(self.category)
        if self.parent_category and self.path == self.parent_category.path:
            raise BadValueError('Can not reference recursively.')        
        super(Category, self).put()
        
    def delete(self):
        children = Category.all().filter('parent_category =', self).fetch(1000)
        if children or self.article_count > 0 or self.starred_count > 0:
            [item.delete() for item in children]
            self.is_active = False
            self.put()
        else:
            super(Category, self).delete()
    
    @classmethod        
    def get_article_list(cls, path):
        pass
    
    @classmethod
    def get_by_name(cls, category_string):
        return Category.gql('WHERE category = :1', category_string).get()
    
    @classmethod
    def get_list(cls, category):
        parent = category.parent_category if category else None
        
        query_str = 'WHERE parent_category = :1 AND is_active = True'
        result = Category.gql(query_str, parent).fetch(1000)
        for item in result:
            item.children = tuple(Category.gql(query_str, item).fetch(1000))
        return result
    
    @classmethod
    def get_all_categories(cls):
        return [item.category for item in Category.all().fetch(1000)]
    
    def __unicode__(self):
        return ' > '.join(self.path)
    
    def __json__(self):
        result = {'category':self.category, 'description': self.description, 'path': self.path, 'id': self.key().id(), 'article_count': self.article_count, 'starrd_count': self.starred_count, 'created': self.created}
        if hasattr(self, 'children'):
            result['children'] = self.children
        return result
    
class StarredCategory(db.Model):
    category = db.ReferenceProperty(reference_class=Category, required=True)
    user = db.ReferenceProperty(reference_class=User, required=True)
    created = db.DateTimeProperty(auto_now=True)
    
    def put(self, **kwargs):
        is_insert = not self.is_saved()
        super(StarredCategory, self).put(**kwargs)
        if is_insert:
            self.category.starred_count += 1
            self.category.put()
            
    def delete(self, **kwargs):
        super(StarredCategory, self).delete(**kwargs)
        self.category.starred_count -= 1
        self.category.put()    
    
class ArticleCategory(db.Model):
    article = db.ReferenceProperty(reference_class=Article, required=True)
    category = db.ReferenceProperty(reference_class=Category, required=True)
    
    def put(self, **kwargs):
        is_insert = not self.is_saved()
        super(ArticleCategory, self).put(**kwargs)
        if is_insert:
            self.category.article_count += 1
            self.category.put()
            
    def delete(self, **kwargs):
        super(ArticleCategory, self).delete(**kwargs)
        self.category.article_count -= 1
        self.category.put()
    
class ArticleHistory(db.Model):
    article = db.ReferenceProperty(reference_class=Article, required=True)
    updater = db.UserProperty(required=True, auto_current_user=True)
    diff = db.TextProperty()
    updated = db.DateTimeProperty(auto_now=True)
    
class Subscription(db.Model):
    user = db.ReferenceProperty(reference_class=User, required=True)
    article = db.ReferenceProperty(reference_class=Article, required=True)
