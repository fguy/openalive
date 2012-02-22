from google.appengine.ext import testbed
import unittest
import os
import logging

logger = logging.getLogger()
logger.level = logging.DEBUG

os.environ.setdefault('AUTH_DOMAIN', 'example.com')
class TestCase(unittest.TestCase):
    def setUp(self):
        self.testbed = testbed.Testbed()
        self.testbed.activate()
        self.testbed.init_datastore_v3_stub()
        self.testbed.init_memcache_stub()
        
    def tearDown(self):
        self.testbed.deactivate()