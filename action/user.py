from google.appengine.api import users
from lib.controller import Action
from lib.decorators import login_required
from models import User, UserNicknameHistory
try: 
    import json
except ImportError:
    import simplejson as json

class Index(Action):
    def get(self, user_id=None):
        if user_id is None and users.get_current_user() is None:
            self.redirect(users.create_login_url(self.request.uri))
            return
        self.user = User.get_by_id(int(user_id)) if user_id is not None else User.get_current()
        self.id = user_id if user_id is not None else self.user.key().id()
        self.is_me = user_id is None
        return Action.Result.HTML
    
    @login_required
    def put(self):
        params = json.loads(self.request.body)
        me = User.get_current()
        self.user = me
        if me.nickname == params['nickname']:
            return Action.Result.JSON
        if me.nickname_exists(params['nickname']):
            raise users.NotAllowedError(_('Already taken'))
        me.change_nickname(params['nickname'])
        return Action.Result.JSON

class Changes(Action):
    def get(self, user_id, offset=0):
        user = User.get_by_id(int(user_id))
        self.change_list = UserNicknameHistory.get_list(user=user, offset=int(offset))
        return Action.Result.DEFAULT
    
class Articles(Action):
    def get(self, user_id):
        user = User.get_by_id(int(user_id)) 
        self.article_list = User.get_article_list(user=user, offset=int(self.request.get('offset', 0)))
        return Action.Result.JSON
    
class Comments(Action):
    def get(self, user_id, offset=0):
        user = User.get_by_id(int(user_id))
        self.comment_list = User.get_comment_list(user=user, offset=int(self.request.get('offset', 0)))
        return Action.Result.JSON    