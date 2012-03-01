from copy import deepcopy
from google.appengine.api import users, datastore
from google.appengine.api.datastore_errors import BadValueError
from google.appengine.ext import db
from lib import bleach
from lib.base62 import base62_encode
import datetime
import difflib
import logging
import md5
import re

DEFAULT_FETCH_COUNT = 1000 
DIFFER = difflib.HtmlDiff()

xg_on = db.create_transaction_options(xg=True)

class User(db.Model):
    user = db.UserProperty(required=True)
    nickname = db.StringProperty()
    joined = db.DateTimeProperty(auto_now_add=True)
    article_count = db.IntegerProperty(default=0)
    comment_count = db.IntegerProperty(default=0)
    like_count = db.IntegerProperty(default=0)
    hate_count = db.IntegerProperty(default=0)    
    email_hash = db.StringProperty()
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
        if not user:
            return None
        result = User.gql('WHERE user = :1', user).get()
        if not result:
            result = User(user=user, nickname=user.nickname(), email_hash=md5.new(user.email().lower()).hexdigest())
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
                        
    @classmethod
    def get_article_list(cls, user=None, limit=20, offset=0, orderby='created'):                
        q = Article.all()
        q.filter('author = ', User.get_current() if user is None else user)
        q.order('-%s' % orderby)
        return [{'id': item.key().id(), 'category': item.category.name, 'title': item.title, 'excerpt': item.get_excerpt(), 'comment_count': item.comment_count, 'like_count': item.like_count, 'hate_count': item.hate_count, 'created': item.created, 'last_updated': item.last_updated} for item in q.fetch(limit, offset)]

    @classmethod
    def get_comment_list(cls, user=None, limit=20, offset=0, orderby='created'):
        q = Comment.all()
        q.filter('author = ', User.get_current() if user is None else user)
        q.order('-%s' % orderby)
        return [{'id': item.key().id(), 'article': {'id': item.article.key().id(), 'title': item.article.title, 'category': item.article.category.name}, 'body': item.body, 'like_count': item.like_count, 'hate_count': item.hate_count, 'created': item.created} for item in q.fetch(limit, offset)]
    
class UserNicknameHistory(db.Model):
    user = db.ReferenceProperty(reference_class=User, required=True)
    nickname = db.StringProperty()
    changed = db.DateTimeProperty(auto_now_add=True)
    
    @classmethod
    def get_list(cls, limit=20, offset=0):
        q = cls.all()
        q.filter('user = ', User.get_current())
        q.order('-changed')
        return [{'nickname': item.nickname, 'changed': item.changed} for item in q.fetch(limit, offset)]

TAG_NORMALIZE_PATTERN = re.compile(u'[\W]+', re.UNICODE)
class Tag(db.Model):
    content = db.StringListProperty()
    count = db.IntegerProperty(default=0)
    group = db.SelfReferenceProperty(required=False)
    
    @classmethod
    def normalize(cls, tag):
        normalized = TAG_NORMALIZE_PATTERN.sub(u'', tag)
        return [tag, normalized] if tag != normalized else [tag]
    
    @classmethod
    def decrease(cls, tags):
        for tag in cls.get(tags):
            tag.count -= 1
            db.run_in_transaction(tag.put)
        
    @classmethod
    def save_all(cls, tags):
        result = []
        for item in tags:
            if item:
                normalized = Tag.normalize(item)
                tag = Tag.gql('WHERE content IN :1', normalized).get()
                if tag:
                    tag.content = list(set(tag.content + normalized))
                else:
                    tag = Tag(content=normalized)
                tag.count += 1
                db.run_in_transaction(tag.put)
                result.append(tag.key())
        return result
    
class AbstractArticle(db.Model):
    author = db.ReferenceProperty(reference_class=User, required=True)
    body = db.TextProperty(required=True)
    geo_pt = db.GeoPtProperty()
    created = db.DateTimeProperty(auto_now_add=True)
    comment_count = db.IntegerProperty(default=0)
    like_count = db.IntegerProperty(default=0)
    hate_count = db.IntegerProperty(default=0)
    
    def increase_like_count(self):
        self.like_count += 1
        super(self.__class__, self).put()

    def decrease_like_count(self):
        if self.like_count == 0:
            raise db.Rollback()        
        self.like_count -= 1
        super(self.__class__, self).put()

    def increase_hate_count(self):
        self.hate_count += 1
        super(self.__class__, self).put()

    def decrease_hate_count(self):
        if self.hate_count == 0:
            raise db.Rollback()                
        self.hate_count -= 1
        super(self.__class__, self).put()            
    
class Category(db.Model):
    name = db.CategoryProperty(required=True)
    parent_category = db.SelfReferenceProperty(required=False, default=None)
    description = db.TextProperty(default='')
    article_count = db.IntegerProperty(default=0)
    starred_count = db.IntegerProperty(default=0)
    path = db.StringListProperty()
    created = db.DateTimeProperty(auto_now_add=True)
    is_active = db.BooleanProperty(default=True)
    
    def put(self):
        self.name = bleach.clean(self.name)
        self.key_name = self.name
        
        if self.__class__.gql('WHERE __key__ != :1 AND name = :2 AND is_active = True', self.key(), self.name).get() if self.is_saved() else Category.gql('WHERE name = :1 AND is_active = True', self.name).get():
            raise BadValueError('Category name must be unique')
                
        previous = None
        
        try:
            previous = self.__class__.get(self.key())
            is_insert = False
        except db.NotSavedError:
            is_insert = True
            
        if (is_insert and self.parent_category) or (previous and previous.parent_category is not None):
            self.path = deepcopy(self.parent_category.path)
        elif self.parent_category:
            self.path.pop()
        else:
            self.path = []
        self.path.append(self.name)
        if self.parent_category and self.path == self.parent_category.path:
            raise BadValueError('Can not reference recursively.')        
        super(Category, self).put()
        
    def delete(self):
        children = self.__class__.all().filter('parent_category =', self).fetch(DEFAULT_FETCH_COUNT)
        if children or self.article_count > 0 or self.starred_count > 0:
            [db.run_in_transaction_options(xg_on, item.delete) for item in children]
            self.is_active = False
            db.run_in_transaction_options(xg_on, self.put)
        else:
            super(Category, self).delete()
            
    def get_path(self):
        return self.__class__.gql('WHERE name IN :1 AND is_active = True', self.path).fetch(DEFAULT_FETCH_COUNT)        
        
    @classmethod
    def get_by_name(cls, name):
        return cls.gql('WHERE name = :1 AND is_active = True', name).get()
    
    @classmethod
    def get_list(cls, category):
        parent = category.parent_category if category else None
        
        query_str = 'WHERE parent_category = :1 AND is_active = True ORDER BY name'
        result = cls.gql(query_str, parent).fetch(DEFAULT_FETCH_COUNT)
        for item in result:
            item.children = tuple(cls.gql(query_str, item).fetch(DEFAULT_FETCH_COUNT))
        return result
    
    @classmethod
    def get_all_categories(cls):
        return [item.name for item in cls.all().fetch(DEFAULT_FETCH_COUNT)]
    
    def increase_article_count(self):
        self.article_count += 1
        super(self.__class__, self).put()
        
    def decrease_article_count(self):
        if self.article_count == 0:
            raise db.Rollback()                
        self.article_count -= 1
        super(self.__class__, self).put()
        
    def increase_starred_count(self):
        self.starred_count += 1
        super(self.__class__, self).put()

    def decrease_starred_count(self):
        if self.starred_count == 0:
            raise db.Rollback()
        self.starred_count -= 1
        super(self.__class__, self).put()
    
    def __unicode__(self):
        return ' > '.join(self.path)
    
    def __json__(self):
        result = {'name':self.name, 'description': self.description, 'path': self.path, 'id': self.key().id(), 'article_count': self.article_count, 'starrd_count': self.starred_count, 'created': self.created}
        if hasattr(self, 'children'):
            result['children'] = self.children
        return result

class Article(AbstractArticle):
    category = db.ReferenceProperty(reference_class=Category, required=True)
    title = db.StringProperty()
    tags = db.ListProperty(db.Key)
    last_updated = db.DateTimeProperty()
    
    def get_excerpt(self):
        body = bleach.clean(self.body, strip=True)
        return '%s...' % body[:253] if len(body) > 253 else body
        
    def delete(self):
        db.run_in_transaction_options(xg_on, super(self.__class__, self).delete)
        [db.run_in_transaction_options(xg_on, item.delete) for item in ArticleHistory.gql('WHERE article = :1', self).fetch(DEFAULT_FETCH_COUNT)]
        db.run_in_transaction_options(xg_on, self.author.decrease_article_count)
        for item in self.category.get_path():
            db.run_in_transaction_options(xg_on, item.decrease_article_count)            
        return self
    
    def save(self):
        self.title = bleach.clean(self.title)
        self.body = bleach.clean(self.body, tags=['p', 'span', 'div', 'strong', 'b', 'em', 'i', 'blockquote', 'sub', 'sup', 'img', 'iframe', 'br'], attributes=['style', 'title', 'src', 'frameborder', 'width', 'height', 'alt'], styles=['width', 'height', 'font-size', 'font-family', 'text-decoration', 'color', 'background-color', 'text-align', 'padding-left'])
        self.last_updated = datetime.datetime.now()
        is_insert = not self.is_saved()
        diff = None
        if not is_insert:
            previous_body = self.__class__.get_by_id(self.key().id()).body
            if previous_body != self.body:
                diff = DIFFER.make_table(previous_body, self.body)
        db.run_in_transaction_options(xg_on, super(Article, self).put)
        if is_insert:
            db.run_in_transaction_options(xg_on, self.author.increase_article_count)
            for item in self.category.get_path():
                db.run_in_transaction_options(xg_on, item.increase_article_count)
        elif diff:
            db.run_in_transaction_options(xg_on, ArticleHistory(article=self, diff=diff).put)
        return self
        
    @classmethod
    def get_list(cls, category, limit=20, offset=0, orderby='created'):
        q = Category.all()
        for item in category.path:
            q.filter('path = ', item)
        categories = q.fetch(DEFAULT_FETCH_COUNT)
        q = cls.all()
        q.filter('category IN ', categories)
        q.order('-%s' % orderby)
        return [{'id': item.key().id(), 'category': item.category.name, 'title': item.title, 'author': {'email_hash': item.author.email_hash, 'nickname': item.author.nickname, 'id': item.author.key().id()}, 'comment_count': item.comment_count, 'like_count': item.like_count, 'hate_count': item.hate_count, 'created': item.created, 'last_updated': item.last_updated} for item in q.fetch(limit, offset)]

    def increase_comment_count(self):
        self.comment_count += 1
        super(self.__class__, self).put()

    def decrease_comment_count(self):
        if self.comment_count == 0:
            raise db.Rollback()
        self.comment_count -= 1
        super(self.__class__, self).put()
            
class Comment(AbstractArticle):
    article = db.ReferenceProperty(reference_class=Article, required=True)
    parent_comment = db.SelfReferenceProperty()
    sort_key = db.StringProperty(required=False) # to sort comments
    
    def delete(self):
        db.run_in_transaction_options(xg_on, super(self.__class__, self).delete)
        db.run_in_transaction_options(xg_on, self.article.decrease_comment_count)
        db.run_in_transaction_options(xg_on, self.author.decrease_comment_count)
    
    def save(self):
        self.body = bleach.linkify(bleach.clean(self.body).replace('\n','<br>\n'), parse_email=True, target='_blank')
        is_insert = not self.is_saved()
        db.run_in_transaction_options(xg_on, super(self.__class__, self).put)
        if is_insert:
            self.sort_key = '%s%s' % (self.parent_comment.sort_key, base62_encode(self.key().id())) if self.parent_comment else '%s' % base62_encode(self.key().id())
            db.run_in_transaction_options(xg_on, super(self.__class__, self).put)
            db.run_in_transaction_options(xg_on, self.article.increase_comment_count)
            db.run_in_transaction_options(xg_on, self.author.increase_comment_count)
        return self
    
    @classmethod
    def get_list(cls, article, limit=20, offset=None, orderby='sort_key'):
        if offset is None:
            offset = article.comment_count - limit if limit < article.comment_count else 0
        elif offset < 0:
            limit = limit + offset
            offset = 0
        query = cls.all()
        query.filter('article =', article)
        query.order(orderby)
        result = []
        ids = []
        for item in query.fetch(limit, offset):
            item_dict = item.to_dict()
            ids.append(item_dict['id'])
            result.append(item.to_dict())

        user_reputation_list = Reputation.gql('WHERE user = :1 AND obj_class = :2 AND obj_id IN :3', User.get_current(), 'Comment', ids).fetch(DEFAULT_FETCH_COUNT)
        for item in user_reputation_list:
            result[ids.index(item.obj_id)]['%sd' % item.reputation] = True
        return result
    
    def to_dict(self):
        return {'id': self.key().id(), 'parent_id': self.parent_comment.key().id() if self.parent_comment else None, 'body': self.body, 'author': {'email_hash': self.author.email_hash, 'nickname': self.author.nickname, 'id': self.author.key().id()}, 'like_count': self.like_count, 'hate_count': self.hate_count, 'created': self.created, 'like': False, 'hate': False}

class Reputation(db.Model):
    types = ['like', 'hate']
    obj_class = db.StringProperty(required=True)
    obj_id = db.IntegerProperty(required=True)
    user = db.ReferenceProperty(reference_class=User, required=True)
    created = db.DateTimeProperty(auto_now_add=True)
    reputation = db.StringProperty(required=True, choices=types)
    
    def put(self):
        obj = db.get(datastore.Key.from_path(self.obj_class, self.obj_id))
        if not obj:
            return
        if self.user.user == obj.author.user:
            raise ValueError(_('Can not give a reputation to your\'s.'))
        if self.__class__.gql('WHERE obj_id = :1 AND user = :2 AND reputation = :3', self.obj_id, self.user, self.reputation).get():
            raise ValueError(_('You already gave a %s.' % self.reputation))
        db.run_in_transaction_options(xg_on, super(self.__class__, self).put)
        db.run_in_transaction_options(xg_on, getattr(obj, 'increase_' + self.reputation + '_count'))
        db.run_in_transaction_options(xg_on, getattr(obj.author, 'increase_' + self.reputation + '_count'))
        
    def delete(self):
        obj = db.get(datastore.Key.from_path(self.obj_class, self.obj_id))
        if not obj:
            return
        db.run_in_transaction_options(xg_on, super(self.__class__, self).delete)
        db.run_in_transaction_options(xg_on, getattr(obj, 'decrease_' + self.reputation + '_count'))
        db.run_in_transaction_options(xg_on, getattr(obj.author, 'increase_' + self.reputation + '_count'))
    
    @classmethod
    def get_list(cls, obj_id, limit=None, reputation=None):
        q = cls.gql('WHERE obj_id = :1 AND reputation = :2 ORDER BY created DESC', obj_id, reputation) if reputation is not None else cls.gql('WHERE obj_id = :1 ORDER BY created DESC', obj_id)
        return [{'id': item.user.key().id(), 'nickname': item.user.nickname, 'email_hash': item.user.email_hash, 'type': item.reputation} for item in q.fetch(DEFAULT_FETCH_COUNT if limit is None else limit)]
    
    @classmethod
    def get_one(cls, obj_id, reputation):
        user = User.get_current()
        if not user:
            return None 
        return cls.gql('WHERE obj_id=:1 AND user=:2 AND reputation = :3', obj_id, user, reputation).get()
    
    @classmethod
    def exists(cls, obj_id, reputation):
        return cls.get_one(obj_id, reputation) is not None
    
class StarredCategory(db.Model):
    category = db.ReferenceProperty(reference_class=Category, required=True)
    user = db.ReferenceProperty(reference_class=User, required=True)
    created = db.DateTimeProperty(auto_now_add=True)
    
    def put(self):
        is_insert = not self.is_saved()
        db.run_in_transaction_options(xg_on, super(self.__class__, self).put)
        if is_insert:
            db.run_in_transaction_options(xg_on, self.category.increase_starred_count)

    def delete(self):
        db.run_in_transaction_options(xg_on, super(self.__class__, self).delete)
        db.run_in_transaction_options(xg_on, self.category.decrease_starred_count)
                      
    @classmethod
    def get_list(cls):
        return [item.category.name for item in cls.gql('WHERE user = :1', User.get_current()).fetch(DEFAULT_FETCH_COUNT)]
    
    @classmethod
    def star(cls, category):
        user = User.get_current()
        cls(key_name='%s-%s' % (user.user.email, category.name), user=user, category=category).put()
    
    @classmethod
    def unstar(cls, category):
        cls.gql('WHERE user = :1 AND category = :2', User.get_current(), category).get().delete()

class ArticleHistory(db.Model):
    article = db.ReferenceProperty(reference_class=Article, required=True)
    updater = db.UserProperty(required=True, auto_current_user=True)
    diff = db.TextProperty()
    updated = db.DateTimeProperty(auto_now_add=True)
    
class Subscription(db.Model):
    user = db.ReferenceProperty(reference_class=User, required=True)
    article = db.ReferenceProperty(reference_class=Article, required=True)

    @classmethod
    def is_subscribed(cls, article):
        return cls.gql('WHERE user = :1 AND article = :2', User.get_current(), article).get() is not None