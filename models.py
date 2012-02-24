from copy import deepcopy
from google.appengine.api import users
from google.appengine.api.datastore_errors import BadValueError
from google.appengine.ext import db
from lib import bleach
import re
import datetime
import logging
import difflib

DEFAULT_FETCH_COUNT = 1000 
DIFFER = difflib.HtmlDiff()

xg_on = db.create_transaction_options(xg=True)

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
        UserNicknameHistory(user=self, nickname=self.nickname).put()
        self.nickname = nickname
        self.put()
        
    @classmethod
    def get_current(cls):
        user = users.get_current_user()
        result = User.gql('WHERE user = :1', user).get()
        if not result:
            result = User(user=user, nickname=user.nickname())
            result.put()
        return result
    
    def increase_article_count(self):
        self.article_count += 1
        self.put()

    def decrease_article_count(self):
        if self.article_count == 0:
            raise db.Rollback()
        self.article_count -= 1
        self.put()
        
    def increase_comment_count(self):
        self.comment_count += 1
        self.put()

    def decrease_comment_count(self):
        if self.comment_count == 0:
            raise db.Rollback()
        self.comment_count -= 1
        self.put()            
    
class UserNicknameHistory(db.Model):
    user = db.ReferenceProperty(reference_class=User, required=True)
    nickname = db.StringProperty()
    changed = db.DateTimeProperty(auto_now=True)

TAG_NORMALIZE_PATTERN = re.compile(u'[\W]+', re.UNICODE)
class Tag(db.Model):
    content = db.StringListProperty()
    count = db.IntegerProperty(default=0)
    group = db.SelfReferenceProperty(required=False)
    
    @classmethod
    def normalize(cls, tag):
        return [tag, TAG_NORMALIZE_PATTERN.sub(u'', tag)]

        
    @classmethod
    def save_all(cls, tags):
        result = []
        for item in tags:
            if item:
                normalized = Tag.normalize(item)
                tag = Tag.gql('WHERE content IN :1', normalized).get()
                if tag:
                    tag.content = list(set(tag.content + normalized))
                    tag.put()
                else:
                    tag = Tag(content=normalized)
                    tag.put()
                result.append(tag.key())
        return result
    
class AbstractArticle(db.Model):
    author = db.ReferenceProperty(reference_class=User, required=True)
    body = db.TextProperty(required=True)
    geo_pt = db.GeoPtProperty()
    created = db.DateTimeProperty(auto_now=True)
    comment_count = db.IntegerProperty(default=0)
    like_count = db.IntegerProperty(default=0)
    hate_count = db.IntegerProperty(default=0)
    last_updated = db.DateTimeProperty()
    
    def increase_like_count(self):
        self.like_count += 1
        self.put()

    def decrease_like_count(self):
        if self.like_count == 0:
            raise db.Rollback()        
        self.like_count -= 1
        self.put()

    def increase_hate_count(self):
        self.hate_count += 1
        self.put()

    def decrease_hate_count(self):
        if self.hate_count == 0:
            raise db.Rollback()                
        self.hate_count -= 1
        self.put()            
    
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
        self.key_name = self.category
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
        children = Category.all().filter('parent_category =', self).fetch(DEFAULT_FETCH_COUNT)
        if children or self.article_count > 0 or self.starred_count > 0:
            [db.run_in_transaction_options(xg_on, item.delete) for item in children]
            self.is_active = False
            self.put()
        else:
            super(Category, self).delete()
            
    def get_path(self):
        return Category.gql('WHERE category IN :1', self.path).fetch(DEFAULT_FETCH_COUNT)        
        
    @classmethod
    def get_by_name(cls, category_string):
        return Category.gql('WHERE category = :1', category_string).get()
    
    @classmethod
    def get_list(cls, category):
        parent = category.parent_category if category else None
        
        query_str = 'WHERE parent_category = :1 AND is_active = True ORDER BY category'
        result = Category.gql(query_str, parent).fetch(DEFAULT_FETCH_COUNT)
        for item in result:
            item.children = tuple(Category.gql(query_str, item).fetch(DEFAULT_FETCH_COUNT))
        return result
    
    @classmethod
    def get_all_categories(cls):
        return [item.category for item in Category.all().fetch(DEFAULT_FETCH_COUNT)]
    
    def increase_article_count(self):
        self.article_count += 1
        self.put()

    def decrease_article_count(self):
        if self.article_count == 0:
            raise db.Rollback()                
        self.article_count -= 1
        self.put()
        
    def increase_starred_count(self):
        self.starred_count += 1
        self.put()

    def decrease_starred_count(self):
        if self.starred_count == 0:
            raise db.Rollback()
        self.starred_count -= 1
        self.put()        
    
    def __unicode__(self):
        return ' > '.join(self.path)
    
    def __json__(self):
        result = {'category':self.category, 'description': self.description, 'path': self.path, 'id': self.key().id(), 'article_count': self.article_count, 'starrd_count': self.starred_count, 'created': self.created}
        if hasattr(self, 'children'):
            result['children'] = self.children
        return result

class Article(AbstractArticle):
    category = db.ReferenceProperty(reference_class=Category, required=True)
    title = db.StringProperty()
    tags = db.ListProperty(db.Key)
    
    def delete(self):
        super(Article, self).delete()
        db.run_in_transaction_options(xg_on, self.author.decrease_article_count)
        for item in self.category.get_path():
            db.run_in_transaction_options(xg_on, item.decrease_artcile_count)            
        return self
    
    def save(self):
        self.title = bleach.clean(self.title)
        self.body = bleach.clean(self.body, tags=['p', 'span', 'div', 'strong', 'b', 'em', 'i', 'blockquote', 'sub', 'sup', 'img', 'iframe'], attributes=['style', 'title', 'src', 'frameborder', 'width', 'height', 'alt'], styles=['width', 'height', 'font-size', 'font-family', 'text-decoration', 'color', 'background-color', 'text-align', 'padding-left'])
        self.last_updated = datetime.datetime.now()
        is_insert = not self.is_saved()
        if not is_insert:
            previous_body = Article.get_by_id(self.key().id()).body
            if previous_body != self.body:
                diff = DIFFER.make_table(previous_body, self.body)
        super(Article, self).put()
        if is_insert:
            db.run_in_transaction_options(xg_on, self.author.increase_article_count)
            for item in self.category.get_path():
                db.run_in_transaction_options(xg_on, item.increase_article_count)
        else:
            db.run_in_transaction_options(xg_on, ArticleHistory(article=self, updater=User.get_current(), diff=diff).put)
        return self
    
    @classmethod
    def get_list(cls, category, limit=20, offset=0, orderby='created'):
        q = Category.all()
        for item in category.path:
            q.filter('path = ', item)
        categories = q.fetch(DEFAULT_FETCH_COUNT)
        q = Article.all()
        q.filter('category IN ', categories)
        q.order('-%s' % orderby)
        return [{'id': item.key().id(), 'category': item.category.category, 'title': item.title, 'author': {'nickname': item.author.nickname, 'id': item.author.key().id()}, 'comment_count': item.comment_count, 'like_count': item.like_count, 'hate_count': item.hate_count, 'created': item.created, 'last_updated': item.last_updated}for item in q.fetch(limit, offset)]

    def increase_comment_count(self):
        self.comment_count += 1
        self.put()

    def decrease_comment_count(self):
        if self.comment_count == 0:
            raise db.Rollback()
        self.comment_count -= 1
        self.put()    
            
class Comment(AbstractArticle):
    article = db.ReferenceProperty(reference_class=Article, required=True)
    parent_comment = db.SelfReferenceProperty()
    sort_key = db.StringProperty(required=False) # to sort comments
    
    def delete(self):
        super(Comment, self).delete()
        db.run_in_transaction_options(xg_on, self.article.decrease_comment_count);
    
    def save(self):
        self.body = bleach.linkify(bleach.clean(self.body), parse_email=True)
        is_insert = not self.is_saved()
        if not is_insert:
            self.last_updated = datetime.datetime.now()
        super(Comment, self).put()
        if is_insert:
            self.sort_key = '%s%s' % (self.parent_comment.sort_key, self.key().name()) if self.parent_comment else '%s' % self.key().name()
            super(Comment, self).put()
            db.run_in_transaction_options(xg_on, self.article.increase_comment_count);
    
    @classmethod
    def get_list(cls, article, limit=20, offset=0, orderby='sort_key'):
        query = Comment.all()
        query.filter('article =', article)
        query.order('-%s' % orderby)
        return query.fetch(limit, offset)         
    
class Reputation(db.Model):
    article = db.ReferenceProperty(reference_class=Article, required=True)
    user = db.ReferenceProperty(reference_class=User, required=True)
    created = db.DateTimeProperty(auto_now=True)
    reputation = db.StringProperty(required=True, choices=['like', 'hate'])
    
    def put(self):
        self.article.save()
        db.run_in_transaction_options(xg_on, getattr(self.article, 'increase_' + self.reputation + '_count'))
        
    def delete(self):
        self.article.save()
        db.run_in_transaction_options(xg_on, getattr(self.article, 'decrease_' + self.reputation + '_count'))
    
    @classmethod
    def exists(cls, article_id):
        return Reputation.all().gql('WHERE article=:article AND user=:user', article=Article.get_by_id(article_id), user=users.get_current_user()).get() is not None
    
class StarredCategory(db.Model):
    category = db.ReferenceProperty(reference_class=Category, required=True)
    user = db.ReferenceProperty(reference_class=User, required=True)
    created = db.DateTimeProperty(auto_now=True)
    
    def put(self, **kwargs):
        is_insert = not self.is_saved()
        super(StarredCategory, self).put(**kwargs)
        if is_insert:
            db.run_in_transaction_options(xg_on, self.category.increase_starred_count)

    def delete(self, **kwargs):
        super(StarredCategory, self).delete(**kwargs)
        db.run_in_transaction_options(xg_on, self.category.decrease_starred_count)
                      
    @classmethod
    def get_list(cls):
        return [item.category.category for item in StarredCategory.gql('WHERE user = :1', User.get_current()).fetch(DEFAULT_FETCH_COUNT)]
    
    @classmethod
    def star(cls, category):
        user = User.get_current()
        cls(key_name = '%s-%s' % (user.user.email, category.category), user=user, category=category).put()
    
    @classmethod
    def unstar(cls, category):
        cls.gql('WHERE user = :1 AND category = :2', User.get_current(), category).get().delete()

class ArticleHistory(db.Model):
    article = db.ReferenceProperty(reference_class=Article, required=True)
    updater = db.UserProperty(required=True, auto_current_user=True)
    diff = db.TextProperty()
    updated = db.DateTimeProperty(auto_now=True)
    
class Subscription(db.Model):
    user = db.ReferenceProperty(reference_class=User, required=True)
    article = db.ReferenceProperty(reference_class=Article, required=True)
