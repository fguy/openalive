from google.appengine.api.users import User
from lib.test import TestCase
import models
import logging

class ModelsTest(TestCase):    
    def setUp(self):
        super(ModelsTest, self).setUp()
        self.user_model = models.User(user = User(email="test@example.com"))
        self.user_model.put()
        
    def test_add_an_article(self):
        logging.debug(models.Article(author=self.user_model, subject="test", body="test"))
    
    def test_add_an_comment(self):
        article = models.Article(author=self.user_model, subject="test", body="test")
        article.put()
        models.Article(parent_article=article, author=self.user_model, subject="test", body="test")
        
    def test_get_category(self):
        logging.getLogger().info("BB")
        logging.debug(models.Category.get_list(None))
        
    def tearDown(self):
        self.user_model = None
        super(ModelsTest, self).tearDown()