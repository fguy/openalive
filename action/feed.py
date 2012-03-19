'''
@see https://developers.google.com/feed/v1/jsondevguide
'''
from gettext import gettext as _
from lib.controller import Action
import models

class Best(Action):
    def get(self, period):
        offset = int(self.request.get('offset', 0))
        limit = int(self.request.get('limit', 20))
        return {
            'feedUrl': self.request.uri,
            'title': _('%s Best Articles' % period),
            'link': '/best/%s' % period,
            'type': 'rss20',
            'description': '',
            'entries': [{
                      'title':item['title'], 
                      'link':'%s/#!/%s/%s?page=%s' % (self.request.host_url, item['category'], item['id'], 1),
                      'comments':'%s/#!/%s/%s?page=%s#comments' % (self.request.host_url, item['category'], item['id'], 1),
                      'contentSnippet': item['excerpt'],
                      'content': item['excerpt'],
                      'publishedDate':item['created'], 
                      'author': item['author']['nickname'], 
                      'categories': [item['category']],
                      'enclosure': {'url': item['video'] if item['video'] else item['image'], 'type': 'video' if item['video'] else 'image', 'length': 10000} if item['video'] or item['image'] else None,
                     } for item in models.Article.get_best_list(period, offset=offset, limit=limit)]
            }

class Category(Action):
    def get(self, category_name):
        page = int(self.request.get('page', 1))
        limit = int(self.request.get('limit', 20))
        offset = (page - 1) * limit
        category = models.Category.get_by_name(category_name)
        if not category:
            return None
        link = '%s/#!/%s' % (self.request.host_url, category_name)
        return {
            'feedUrl': self.request.uri,
            'title': category_name,
            'link': link,
            'type': 'rss20',
            'description': category.description,
            'entries': [{
                      'title':item['title'], 
                      'link':'%s/%s?page=%s' % (link, item['id'], page),
                      'comments':'%s/%s?page=%s#comments' % (link, item['id'], page),
                      'contentSnippet': item['excerpt'],
                      'content': item['excerpt'],
                      'publishedDate':item['created'], 
                      'author': item['author']['nickname'], 
                      'categories': [item['category']],
                      'enclosure': {'url': item['video'] if item['video'] else item['image'], 'type': 'video' if item['video'] else 'image', 'length': 10000} if item['video'] or item['image'] else None,
                     } for item in models.Article.get_list(category=category, offset=offset, limit=limit)]
            }

class Tag(Action):
    def get(self, name):
        tag = models.Tag.get_by_name(name)
        if not tag:
            return None
        link = '%s/tag/%s' % (self.request.host_url, name)
        return {
            'feedUrl': self.request.uri,
            'title': name,
            'link': link,
            'type': 'rss20',
            'description': ','.join(tag.content),
            'entries': [{
                      'title':item['title'], 
                      'link':'%s/%s' % (link, item['id']),
                      'comments':'%s/%s#comments' % (link, item['id']),
                      'contentSnippet': item['excerpt'],
                      'content': item['excerpt'],
                      'publishedDate':item['created'], 
                      'author': item['author']['nickname'], 
                      'categories': [item['category']],
                      'enclosure': {'url': item['video'] if item['video'] else item['image'], 'type': 'video' if item['video'] else 'image', 'length': 10000} if item['video'] or item['image'] else None,
                     } for item in models.Tag.get_article_list(tag=tag)]
            }