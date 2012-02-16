from google.appengine.ext import db

class Article(db.Model): # Can be used as comment
    writer = db.UserProperty(required=True, auto_current_user=True)
    subject = db.StringProperty()
    body = db.TextProperty(required=True)
    geo_pt = db.GeoPtProperty()
    created = db.DateTimeProperty(auto_now=True)
    last_updated = db.DateTimeProperty()
    children_count = db.IntegerProperty(default=0)
    like_count = db.IntegerProperty(default=0)
    hate_count = db.IntegerProperty(default=0) 
    parent_article = db.SelfReferenceProperty(required=False) # for comment purpose
    is_active = db.BooleanProperty(default=True)
    
    def delete(self):
        self.is_active = False
        self.put()
    
    def save_article(self, **kwargs):
        super(Article, self).put(**kwargs)
    
    def save_comment(self, **kwargs):
        super(Article, self).put(**kwargs)
    
    def get_comment_list(self):
        pass
    
    
class Reputation(db.Model):
    article = db.ReferenceProperty(reference_class=Article, required=True)
    user = db.UserProperty(required=True, auto_current_user=True)
    created = db.DateTimeProperty(auto_now=True)
    reputation = db.StringProperty(required=True, choices=['like','hate'])
    
    def exists(self, article_id, user):
        pass
    
class Category(db.Model):
    category = db.CategoryProperty(required=True)
    parent_category = db.SelfReferenceProperty(required=False)
    is_active = db.BooleanProperty(default=True)
    count = db.IntegerProperty(default=0)
    
    def get_article_list(self):
        pass
    
class FavoriteCategory(db.Model):
    category = db.ReferenceProperty(reference_class=Category, required=True)
    user = db.UserProperty(required=True, auto_current_user=True)
    created = db.DateTimeProperty(auto_now=True)
    
class ArticleCategory(db.Model):
    article = db.ReferenceProperty(reference_class=Article, required=True)
    category = db.ReferenceProperty(reference_class=Category, required=True)
    
class ArticleHistory(db.Model):
    article = db.ReferenceProperty(reference_class=Article, required=True)
    updater = db.UserProperty(required=True, auto_current_user=True)
    diff = db.TextProperty()
    updated = db.DateTimeProperty(auto_now=True)
    
class User(db.Model):
    user = db.UserProperty(required=True)
    joined = db.DateTimeProperty(auto_now=True)
    article_count = db.IntegerProperty(default=0)
    comment_count = db.IntegerProperty(default=0)
    locale = db.StringProperty()
    signature = db.TextProperty()

class Subscription(db.Model):
    user = db.UserProperty(required=True)
    article = db.ReferenceProperty(reference_class=Article, required=True)
