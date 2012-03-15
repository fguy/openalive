from copy import deepcopy
from django.utils.html import strip_tags, strip_entities
from gettext import gettext as _
from google.appengine.api import users, datastore, memcache
from google.appengine.api.datastore_errors import BadValueError
from google.appengine.ext import db
from lib import bleach
from lib.BeautifulSoup import BeautifulSoup
from lib.base62 import base62_encode
import action
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
    
    def nickname_exists(self, nickname):
        return User.gql('WHERE user != :1 AND nickname = :2', self, nickname).get() != None
    
    def change_nickname(self, nickname):
        db.run_in_transaction_options(xg_on, UserNicknameHistory(user=self, nickname=bleach.clean(self.nickname)).put)
        self.nickname = bleach.clean(nickname)
        db.run_in_transaction_options(xg_on, self.put)
        
    @classmethod
    def get_current(cls, user=None):
        if not user:
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
        return [{'id': item.key().id(), 'category': item.category.name, 'title': item.title, 'excerpt': item.excerpt, 'comment_count': item.comment_count, 'like_count': item.like_count, 'hate_count': item.hate_count, 'created': item.created, 'last_updated': item.last_updated, 'image': item.image, 'video': item.video} for item in q.fetch(limit, offset)]

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
    def get_list(cls, user, limit=20, offset=0):
        q = cls.all()
        q.filter('user = ', user)
        q.order('-changed')
        return [{'nickname': item.nickname, 'changed': item.changed} for item in q.fetch(limit, offset)]

TAG_NORMALIZE_PATTERN = re.compile(u'[\W]+', re.UNICODE)
class Tag(db.Model):
    content = db.StringListProperty()
    count = db.IntegerProperty(default=0)
    group = db.SelfReferenceProperty(required=False)
    
    @classmethod
    def normalize(cls, tag):
        tag = strip_entities(bleach.clean(tag))
        normalized = TAG_NORMALIZE_PATTERN.sub(u'', tag).lower()
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
    
    @classmethod
    def get_top_list(cls):
        q = cls.all()
        q.order('content')
        return q.fetch(DEFAULT_FETCH_COUNT)
    
    @classmethod
    def get_by_name(cls, tag_name):
        return cls.gql('WHERE content = :1', tag_name).get()
    
    @classmethod
    def get_article_list(cls, tag, limit=20, offset=0):
        return [item.to_dict() for item in Article.gql('WHERE tags = :1', tag.key()).fetch(limit, offset)]
    
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
    
    _meta = None
    
    def put(self):
        if self.__class__.gql('WHERE __key__ != :1 AND name = :2 AND is_active = True', self.key(), self.name).get() if self.is_saved() else Category.gql('WHERE name = :1 AND is_active = True', self.name).get():
            raise BadValueError(_('Category name must be unique'))
                
        previous = self.__class__.get(self.key())
        is_insert = not self.is_saved()
        
        if (is_insert and self.parent_category) or (previous and previous.parent_category is not None):
            self.path = deepcopy(self.parent_category.path)
        elif self.parent_category:
            self.path.pop()
        else:
            self.path = []
        self.path.append(self.name)
        if self.parent_category and self.path == self.parent_category.path:
            raise BadValueError(_('Can not reference recursively.'))        
        super(Category, self).put()
        memcache.delete(action.service.Category.CACHE_KEY)
        
        
    def delete(self):
        children = self.__class__.all().filter('parent_category =', self).fetch(DEFAULT_FETCH_COUNT)
        if children or self.article_count > 0 or self.starred_count > 0:
            [db.run_in_transaction_options(xg_on, item.delete) for item in children]
            self.is_active = False
            db.run_in_transaction_options(xg_on, self.put)
        else:
            super(Category, self).delete()
        memcache.delete(action.service.Category.CACHE_KEY)
            
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
    def get_all(cls):
        q = cls.all()
        q.filter('is_active =', True)
        return [item.name for item in q.fetch(DEFAULT_FETCH_COUNT)]
    
    @classmethod
    def get_top_level(cls):
        q = cls.all()
        q.filter('is_active = ', True)
        q.filter('parent_category = ', None)
        return [item.name for item in q.fetch(DEFAULT_FETCH_COUNT)]
    
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
    image = db.URLProperty()
    video = db.URLProperty()
    excerpt = db.StringProperty(default='', multiline=True)
    
    def delete(self):
        db.run_in_transaction_options(xg_on, super(self.__class__, self).delete)
        [db.run_in_transaction_options(xg_on, item.delete) for item in ArticleHistory.gql('WHERE article = :1', self).fetch(DEFAULT_FETCH_COUNT)]
        db.run_in_transaction_options(xg_on, self.author.decrease_article_count)
        for item in self.category.get_path():
            db.run_in_transaction_options(xg_on, item.decrease_article_count)   
        Tag.decrease(self.tags)        
        return self
    
    def save(self):
        self.title = bleach.clean(self.title)
        self.body = bleach.clean(self.body, tags=['p', 'span', 'div', 'strong', 'b', 'em', 'i', 'blockquote', 'sub', 'sup', 'img', 'iframe', 'br'], attributes=['style', 'title', 'src', 'frameborder', 'width', 'height', 'alt'], styles=['width', 'height', 'font-size', 'font-family', 'text-decoration', 'color', 'background-color', 'text-align', 'padding-left'])
        self.last_updated = datetime.datetime.now()

        has_image = False
        has_video = False
        self.image = None
        self.video = None
        
        soup = BeautifulSoup(self.body)
        img = soup.find('img')
        
        if img and hasattr(img, 'src') and re.search('tiny_mce/plugins/emoticons', img['src'].lower()) is None:
            self.image = img['src']
            has_image = True
        
        iframes = soup.findAll('iframe')
        for item in iframes:
            if re.match('^http(s)?://(.+\.)?(youtube.com|youtu.be)/', item['src'].lower()) is not None:
                if self.video is None:
                    self.video = item['src']
                    has_video = True
            else:
                item.decompose()
        
        is_insert = not self.is_saved()
        
        excerpt = strip_tags(self.body).strip()
        self.excerpt = '%s...' % excerpt[:253] if len(excerpt) > 253 else excerpt        
        
        diff = None
        if not is_insert:
            previous = self.__class__.get(self.key())
            Tag.decrease(previous.tags)
            if previous.body != self.body:
                diff = DIFFER.make_table(previous.body, self.body)
        db.run_in_transaction_options(xg_on, super(Article, self).put)
        if is_insert:
            db.run_in_transaction_options(xg_on, self.author.increase_article_count)
            for item in self.category.get_path():
                db.run_in_transaction_options(xg_on, item.increase_article_count)
        elif diff:
            db.run_in_transaction_options(xg_on, ArticleHistory(article=self, diff=diff).put)
            
        key_name = str(self.key().id())
        if has_image:
            ImageArticle.get_or_insert(key_name, article=self)
        else:
            found = ImageArticle.gql('WHERE article = :1', self).get()
            if found != None:
                found.delete()
        if has_video:
            VideoArticle.get_or_insert(key_name, article=self)
        else:
            found = VideoArticle.gql('WHERE article = :1', self).get()
            if found != None:
                found.delete()

        return self
    
    @classmethod
    def get_best_list(cls, period, limit=20, offset=0):
        q = cls.all()
        delta = None
        if period == 'weekly':
            delta = datetime.timedelta(weeks = 1)
        elif period == 'monthly':
            delta = datetime.timedelta(days = 30)
        elif period == 'quaterly':
            delta = datetime.timedelta(days = 90)
        else:
            delta = datetime.timedelta(days = 1)
        q.filter('created > ', datetime.datetime.now() - delta)
        q.order('-like_count')
        return [item.to_dict() for item in q.fetch(limit, offset)]
    
    @classmethod
    def get_list(cls, category, limit=20, offset=0, orderby='created'):
        q = Category.all()
        for item in category.path:
            q.filter('path = ', item)
        categories = q.fetch(DEFAULT_FETCH_COUNT)
        q = cls.all()
        q.filter('category IN ', categories)
        q.order('-%s' % orderby)
        return [item.to_dict() for item in q.fetch(limit, offset)]
    
    @classmethod
    def get_image_list(cls, limit=20, offset=0):
        q = cls.all()
        q.filter('image != ', None)
        q.order('-last_updated')
        return [item.to_dict() for item in q.fetch(limit, offset)]
    
    @classmethod
    def get_video_list(cls, limit=20, offset=0):
        q = cls.all()
        q.filter('video IS NOT ', None)
        q.order('-last_updated')
        return [item.to_dict() for item in q.fetch(limit, offset)]

    def increase_comment_count(self):
        self.comment_count += 1
        super(self.__class__, self).put()

    def decrease_comment_count(self):
        if self.comment_count == 0:
            raise db.Rollback()
        self.comment_count -= 1
        super(self.__class__, self).put()
        
    def to_dict(self):
        return {'id': self.key().id(), 'category': self.category.name, 'title': self.title, 'excerpt': self.excerpt, 'author': {'email_hash': self.author.email_hash, 'nickname': self.author.nickname, 'id': self.author.key().id()}, 'comment_count': self.comment_count, 'like_count': self.like_count, 'hate_count': self.hate_count, 'created': self.created, 'last_updated': self.last_updated, 'image': self.image, 'video': self.video}

class ImageArticle(db.Model):
    article = db.ReferenceProperty(reference_class=Article, required=True)
    created = db.DateTimeProperty(auto_now_add=True)
    
    @classmethod
    def get_list(cls, limit=20, offset=0):
        q = cls.all()
        q.order('-created')
        return [item.article.to_dict() for item in q.fetch(limit, offset)]
    
class VideoArticle(ImageArticle):
    pass

class Comment(AbstractArticle):
    article = db.ReferenceProperty(reference_class=Article, required=True)
    parent_comment = db.SelfReferenceProperty()
    sort_key = db.StringProperty(required=False) # to sort comments
    
    def delete(self):
        if self.__class__.gql('WHERE parent_comment = :1', self).count(2) > 0:
            raise Exception(_('Can not delete if the comment has replies.'))
        db.run_in_transaction_options(xg_on, super(self.__class__, self).delete)
        db.run_in_transaction_options(xg_on, self.article.decrease_comment_count)
        db.run_in_transaction_options(xg_on, self.author.decrease_comment_count)
    
    def save(self):
        self.body = bleach.linkify(bleach.clean(self.body).replace('\n','<br>\n'), parse_email=True, target='_blank')
        
        is_insert = not self.is_saved()
                     
        db.run_in_transaction_options(xg_on, super(self.__class__, self).put)
        if is_insert:
            self.sort_key = ('%s%32s' % (self.parent_comment.sort_key, base62_encode(self.key().id()))).replace(' ','0') if self.parent_comment else '%s' % base62_encode(self.key().id())
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
    
    @classmethod
    def get_best(cls, article, limit=3, offset=0):
        q = cls.all()
        q.filter('article = ', article)
        q.filter('like_count > ', 1)
        q.order('-like_count')
        return [item.to_dict() for item in q.fetch(limit, offset)]
    
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
    def get_list(cls, obj_id, limit=None, offset=0, reputation=None):
        q = cls.gql('WHERE obj_id = :1 AND reputation = :2 ORDER BY created DESC', obj_id, reputation) if reputation is not None else cls.gql('WHERE obj_id = :1 ORDER BY created DESC', obj_id)
        return [{'id': item.user.key().id(), 'nickname': item.user.nickname, 'email_hash': item.user.email_hash, 'type': item.reputation} for item in q.fetch(DEFAULT_FETCH_COUNT if limit is None else limit, offset)]
    
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
    
    @classmethod
    def get_one(cls, article):
        user = User.get_current()
        if not user:
            return None
        return cls.gql('WHERE article=:1 AND user=:2', article, user).get()
    