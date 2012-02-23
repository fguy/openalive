from lib.controller import Action
from lib.decorators import login_required

class Index(Action):
    def get(self, user_id):
        return Action.Result.DEFAULT
    
class Me(Action):
    @login_required
    def get(self):
        return Action.Result.DEFAULT