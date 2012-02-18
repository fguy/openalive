var ImageDialog = {
  preInit : function() {
    var url;

    tinyMCEPopup.requireLangPack();

    if (url = tinyMCEPopup.getParam("external_image_list_url"))
      document.write('<script language="javascript" type="text/javascript" src="' + tinyMCEPopup.editor.documentBaseURI.toAbsolute(url) + '"></script>');
  },

  init : function() {
    var f = document.forms[0], ed = tinyMCEPopup.editor;

    // Setup browse button
    document.getElementById('srcbrowsercontainer').innerHTML = getBrowserHTML('srcbrowser','src','image','theme_advanced_image');
    if (isVisible('srcbrowser'))
      document.getElementById('src').style.width = '180px';

    e = ed.selection.getNode();

    this.fillFileList('image_list', 'tinyMCEImageList');

    if (e.nodeName == 'IMG') {
      f.src.value = ed.dom.getAttrib(e, 'src');
      f.insert.value = ed.getLang('update');
      selectByValue(f, 'image_list', f.src.value);
    }
  },

  fillFileList : function(id, l) {
    var dom = tinyMCEPopup.dom, lst = dom.get(id), v, cl;

    l = window[l];

    if (l && l.length > 0) {
      lst.options[lst.options.length] = new Option('', '');

      tinymce.each(l, function(o) {
        lst.options[lst.options.length] = new Option(o[0], o[1]);
      });
    } else
      dom.remove(dom.getParent(id, 'tr'));
  },

  update : function() {
    var f = document.forms[0], nl = f.elements, ed = tinyMCEPopup.editor, args = {}, el;

    tinyMCEPopup.restoreSelection();

    if (f.src.value === '') {
      if (ed.selection.getNode().nodeName == 'IMG') {
        ed.dom.remove(ed.selection.getNode());
        ed.execCommand('mceRepaint');
      }

      tinyMCEPopup.close();
      return;
    }

    tinymce.extend(args, {
      src : f.src.value,
    });

    el = ed.selection.getNode();

    if (el && el.nodeName == 'IMG') {
      ed.dom.setAttribs(el, args);
    } else {
      ed.execCommand('mceInsertContent', false, '<img id="__mce_tmp" />', {skip_undo : 1});
      ed.dom.setAttribs('__mce_tmp', args);
      ed.dom.setAttrib('__mce_tmp', 'id', '');
      ed.undoManager.add();
    }

    tinyMCEPopup.close();
  },

  getImageData : function() {
    var f = document.forms[0];

    this.preloadImg = new Image();
    this.preloadImg.src = tinyMCEPopup.editor.documentBaseURI.toAbsolute(f.src.value);
  }
};

var ImageUpload = { 
  uri : 'http://files.nicedit.com/',
  requestInterval : false,
  id : 0,
  
  init: function() {
    ImageUpload.requestInterval = 1000;
    ImageUpload.id = Math.round(Math.random()*Math.pow(10,15));
  },

  startUpload : function() {
    var myDoc = document.getElementById("uploadFrame").contentWindow.document;
    myDoc.uploadForm.action = ImageUpload.uri + '?id=' + ImageUpload.id;
    myDoc.uploadForm.APC_UPLOAD_PROGRESS.value = ImageUpload.id;
    myDoc.uploadForm.style.display = 'none';
    myDoc.getElementById("status").innerHTML = '<img src="http://files.nicedit.com/ajax-loader.gif" style="float: right; margin-right: 40px;" /><strong>Uploading...</strong><br />Please wait';
    myDoc.uploadForm.submit();
    setTimeout(ImageUpload.makeRequest,ImageUpload.requestInterval);
  },
  
  makeRequest : function() {
    var s = document.createElement("SCRIPT");
    s.type = 'text/javascript';
    s.src = ImageUpload.uri + '?check=' + ImageUpload.id + '&rand=' + +Math.round(Math.random()*Math.pow(10,15)); 
    s.onload = function() {
      s.parentNode.removeChild(s);
    }
    document.getElementsByTagName('head')[0].appendChild(s);
    if(ImageUpload.requestInterval) {
      setTimeout(ImageUpload.makeRequest, ImageUpload.requestInterval);
    }
  }
};

var nicUploadButton = {
  statusCb : function(o) {
    if(o.url) {
      ImageUpload.requestInterval = false;
      document.forms[0].src.value = o.url;
      ImageDialog.update();
    } else if(o.error) {
      alert("There was an error uploading your image ("+o.error+").");
      tinyMCEPopup.close();
    } else if(o.noprogress) {
      if(ImageUpload.uri.indexOf('http:') == -1 || ImageUpload.uri.indexOf(window.location.host) != -1) {
        ImageUpload.requestInterval = false;
      }
    } 
  }
};
//
//nicUploadButton.statusCb = function(o) {
//  nicUploadButton.lastPlugin.update(o);
//}

ImageDialog.preInit();
tinyMCEPopup.onInit.add(ImageDialog.init, ImageDialog);
tinyMCEPopup.onInit.add(ImageUpload.init, ImageUpload);