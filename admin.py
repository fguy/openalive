from models import Category
from lib import appengine_admin
class CategoryAdmin(appengine_admin.ModelAdmin):
    model = Category
    listFields = ('name', 'path', 'description', 'article_count','starred_count', 'is_active', 'created')
    editFields = ('parent_category', 'name', 'description', 'is_active')
    readonlyFields = ('article_count', 'starred_count', 'created')

appengine_admin.register(CategoryAdmin)