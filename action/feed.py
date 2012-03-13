'''
@see https://developers.google.com/feed/v1/jsondevguide
'''
from lib.controller import Action
import models

class CategoryArticleList(Action):
    def get(self, category_name):
        def get_entry(item):
            media_group_contents = []
            if item['image']:
                media_group_contents.append({'url': item['image'], 'medium': 'image', 'type': '', 'height':'', 'width': ''})
            if item['video']:
                media_group_contents.append({'url': item['video'], 'medium': 'video', 'type': '', 'height':'', 'width': ''})
                
            entry = {
                      'title':item['title'], 
                      'link':'%s/%s?page=%s' % (link, item['id'], page), 
                      'contentSnippet': item['excerpt'], 
                      'content': item['excerpt'],
                      'publishedDate':item['created'], 
                      'author': item['author']['nickname'], 
                      'categories': category.path,
                      'mediaGroups': [{'contents': media_group_contents}],
                     }
            
            return entry        

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
            'entries': [get_entry(item) for item in models.Article.get_list(category=category, offset=offset, limit=limit)]
            }
                
class ArticleCommentList(Action):
    def get(self, category_name):
        pass