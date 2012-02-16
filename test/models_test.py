from google.appengine.api.users import User
from lib.test import TestCase
import models

class ModelsTest(TestCase):    
    def test_add_an_article(self):
        print models.Article(writer=User(email="test@example.com"), subject="test", body="test")
    
    def test_add_an_comment(self):
        article = models.Article(writer=User(email="test@example.com"), subject="test", body="test")
        article.put()
        models.Article(parent_article=article, writer=User(email="test@example.com"), subject="test", body="test")