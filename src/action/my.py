from lib.controller import Action
from lib.decorators import login_required

class Index(Action):
    @login_required
    def get(self):
        return Action.Result.DEFAULT