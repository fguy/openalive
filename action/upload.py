from google.appengine.api import urlfetch
from lib.controller import Action
from lib.poster.encode import multipart_encode, MultipartParam
import settings

class Index(Action):
    def post(self):
        content_type = self.request.headers['Content-Type']
        if not content_type.lower().startswith('multipart/form-data'):
            raise Exception('Only accepts multipart form-data.')
        
        meta = {}
        for item in content_type.split(';'):
            if item.find('=') > -1:
                pair = item.split('=')
                meta[pair[0].strip()] = pair[1].replace('"', '').strip()
        file_vars = self.request.body_file.vars['fileupload']
        if not file_vars.type.lower().startswith('image'):
            raise ValueError('This is not a image file.')
        datagen, headers = multipart_encode([('key', settings.IMAGE_SHACK_API_KEY), MultipartParam(file_vars.name, fileobj=file_vars.file, filename=file_vars.filename, filetype=file_vars.type)])
        result = urlfetch.fetch(
            url='http://www.imageshack.us/upload_api.php',
            payload=''.join(datagen),
            method=urlfetch.POST,
            headers=headers)
        file_vars.file.close()
        self.response.out.write(result.content)
