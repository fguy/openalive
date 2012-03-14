from lib.controller import Action

class Index(Action):
    def get(self):
        return Action.Result.DEFAULT
