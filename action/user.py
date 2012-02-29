from google.appengine.api import users
from lib.controller import Action
from lib.decorators import login_required
from models import User, UserNicknameHistory
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
        if User.nickname_exists(params['nickname']):
            raise users.NotAllowedError(_('Already taken'))
        User.change_nickname(params['nickname'])
        return Action.Result.HTML

class NicknameHistory(Action):
    def get(self, offset=0):
        self.history = UserNicknameHistory.get_list(offset=int(offset))
        return Action.Result.DEFAULT
    
class Articles(Action):
    def get(self, user_id, offset=0):
        user = User.get_by_id(int(user_id))
        self.article_list = User.get_article_list(user=user, offset=offset)
        return Action.Result.DEFAULT
    
class Comments(Action):
    def get(self, user_id, offset=0):
        user = User.get_by_id(int(user_id))
        self.comment_list = User.get_comment_list(user=user, offset=offset)
        return Action.Result.DEFAULT    