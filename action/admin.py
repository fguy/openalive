from django import forms
from lib import bleach
from lib.controller import Action
import models

class Category(Action):
    class NewForm(forms.Form):
        name = forms.CharField(max_length=100, required=True)
        description = forms.CharField(widget=forms.widgets.Textarea, min_length=3, required=False)
    
    class EditForm(NewForm):
        is_active = forms.BooleanField()
        
        
    def get(self, name=None):
        if not hasattr(self, 'new_form'):
            self.new_form = self.NewForm()
        self.category = models.Category.get_by_key_name(name) if name else None
        if self.category:
            self.edit_form = self.EditForm({'name': name, 'is_active': self.category.is_active})
        self.list = models.Category.gql('WHERE parent_category = :1', self.category).fetch(models.DEFAULT_FETCH_COUNT)
        self.parent_name = name
        return Action.Result.DEFAULT

    def post(self, parent_name=None):
        self.new_form = self.NewForm(self.request)
        if self.new_form.is_valid():
            name = bleach.clean(self.new_form.cleaned_data['name'])
            models.Category(key_name=name, name=name, parent_category=models.Category.get_by_key_name(parent_name) if parent_name else None, description=self.new_form.cleaned_data['description']).put()
            return self.get(parent_name)
        else:
            return Action.Result.DEFAULT
