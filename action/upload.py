from google.appengine.api import urlfetch
from lib.controller import Action
from lib.multipart import MultipartParser
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
                 
        part = MultipartParser(stream=self.request.body_file, boundary=meta['boundary'], charset='utf-8' if not meta.has_key('charset') else meta['charset']).get('fileupload')
        if not part.content_type.lower().startswith('image/'):
            raise ValueError('This is not a image file.')
        datagen, headers = multipart_encode([('key', settings.IMAGE_SHACK_API_KEY), MultipartParam('fileupload', fileobj=part.file, filename=part.filename, filetype=part.content_type, filesize=part.size)])
        result = urlfetch.fetch(
            url='http://www.imageshack.us/upload_api.php',
            payload=''.join(datagen),
            method=urlfetch.POST,
            headers=headers)
        part.file.close()
        self.response.out.write(result.content)
