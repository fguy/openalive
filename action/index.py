from lib.controller import Action

class Index(Action):
    def get(self):
        if self.is_crawler:
            self.redirect('/category/index')
        return Action.Result.DEFAULT
    
    def head(self):
        pass
