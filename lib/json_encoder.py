from google.appengine.api import users
from google.appengine.ext import db
import datetime
try: 
    import json
except ImportError:
    import simplejson as json
import time

# Copyright 2008 Google Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# 
#     http://www.apache.org/licenses/LICENSE-2.0
# 
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Utility classes and methods for use with simplejson and appengine.

Provides both a specialized simplejson encoder, GqlEncoder, designed to simplify
encoding directly from GQL results to JSON. A helper function, encode, is also
provided to further simplify usage.

  GqlEncoder: Adds support for GQL results and properties to simplejson.
  encode(input): Direct method to encode GQL objects as JSON.
"""

class GqlEncoder(json.JSONEncoder):
    """Extends JSONEncoder to add support for GQL results and properties.
  
    Adds support to simplejson JSONEncoders for GQL results and properties by
    overriding JSONEncoder's default method.
    """
  
    def default(self, obj):
        """Tests the input object, obj, to encode as JSON."""
         
        if hasattr(obj, '__json__'):
            return getattr(obj, '__json__')()
        
        if hasattr(obj, '__call__'):
            del obj
            return
        
        if isinstance(obj, db.GqlQuery):
            return list(obj)

        elif isinstance(obj, db.Model):
            properties = obj.properties().items()
            output = {}
            for field, value in properties:
                output[field] = getattr(obj, field)
                output['id'] = obj.key().id()
            return output

        elif isinstance(obj, datetime.datetime):
            return time.strftime("%Y-%m-%dT%H:%M:%SZ", obj.utctimetuple())

        elif isinstance(obj, time.struct_time):
            return list(obj)

        elif isinstance(obj, users.User):
            output = {}
            methods = ['nickname']
            for method in methods:
                output[method] = getattr(obj, method)()
            return output
        
        elif isinstance(obj, db.Key):
            return obj.id()

        return json.JSONEncoder.default(self, obj)


def encode(value):
    """Encode an input GQL object as JSON

    Args:
      value: A GQL object or DB property.

    Returns:
      A JSON string based on the input object. 
      
    Raises:
      TypeError: Typically occurs when an input object contains an unsupported
        type.
    """
    return GqlEncoder().encode(value)  


