from lib import PyRSS2Gen
from lib.controller import Action
import datetime
import models
import service

class Recent(Action):
    pass

class WeeklyBest(Action):
    pass

class MonthlyBest(Action):
    pass 

class RecentComment(Action):
    pass

class WeeklyBestComment(Action):
    pass

class MonthlyBestComment(Action):
    pass

class RecentImage(Action):
    pass

class ArticleList(Action):
    def get(self, category_name):
        page = int(self.request.get('page', 1))
        offset = (page - 1) * service.ArticleList.LIST_PER_PAGE
        category = models.Category.get_by_name(category_name)
        link = '%s/#!/%s' % (self.request.host_url, category_name)
        items = [PyRSS2Gen.RSSItem(title=item['title'], link='%s/%s?page=%s' % (link, item['id'], page), description=item['excerpt'], pubDate=item['created'], author=item['author']['nickname'], categories=category.path, enclosure=PyRSS2Gen.Enclosure(url=item['image'] if item['image'] else item['video'], length=10000, type='image' if item['image'] else 'video') if item['image'] or item['video'] else None) for item in models.Article.get_list(category=category, offset=offset)]
        return PyRSS2Gen.RSS2(
            title = category_name,
            link = link,
            description = category.description,
            lastBuildDate = datetime.datetime.utcnow(),
            items = items)