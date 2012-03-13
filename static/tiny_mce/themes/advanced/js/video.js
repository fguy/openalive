var VideoDialog = {
  preInit : function() {
    var url;

    tinyMCEPopup.requireLangPack();

    if (url = tinyMCEPopup.getParam("external_video_list_url"))
      document.write('<script language="javascript" type="text/javascript" src="' + tinyMCEPopup.editor.documentBaseURI.toAbsolute(url) + '"></script>');
  },

  init : function() {
    var f = document.forms[0], ed = tinyMCEPopup.editor;

    // Setup browse button
    document.getElementById('srcbrowsercontainer').innerHTML = getBrowserHTML('srcbrowser','src','video','theme_advanced_video');
    if (isVisible('srcbrowser'))
      document.getElementById('src').style.width = '180px';

    e = ed.selection.getNode();

    this.fillFileList('video_list', 'tinyMCEVideoList');

    if (e.nodeName == 'IFRAME') {
      var src = ed.dom.getAttrib(e, 'src');
      if(src.indexof("http://www.youtube.com/embed/") === 0) {
        f.src.value = src;
        f.insert.value = ed.getLang('update');
        selectByValue(f, 'video_list', f.src.value);        
      }
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
      if (ed.selection.getNode().nodeName == 'IFRAME') {
        ed.dom.remove(ed.selection.getNode());
        ed.execCommand('mceRepaint');
      }

      tinyMCEPopup.close();
      return;
    }

    el = ed.selection.getNode();
    
    if (el && el.nodeName == 'IFRAME') {
      ed.dom.setAttribs(el, args);
    } else {
      var src = this.parseV(f.src.value);
      if(src) {
        ed.execCommand('mceInsertContent', false, '<iframe type="text/html" frameborder="0" src="' + src + '?wmode=opaque" width="640" height="390"></iframe>', {skip_undo : 1});
  //      ed.dom.setAttribs('__mce_tmp', args);
        //ed.dom.setAttrib('__mce_tmp', 'id', '');
        ed.undoManager.add();
      }
    }

    tinyMCEPopup.close();
  },

  parseV : function(v) {
    if(v.indexOf("http://www.youtube.com/") !== 0) {
      tinyMCEPopup.alert(tinyMCEPopup.editor.getLang("advanced_dlg.video_not_support"));
      tinyMCEPopup.close();
      return;
    }
    // YouTube

    if (v.match(/watch\?v=(.*)/)) {
      return 'http://www.youtube.com/embed/' + v.match(/v=(.*)/)[0].split('=')[1].split("&")[0];
    } else if(v.match(/v\/(.*)/)) {
      return 'http://www.youtube.com/embed/' + v.match(/v\/(.*)/)[0].split('=')[1].split("&")[0];
    }
    return v;
  },
  
  getVideoData : function() {
  }
};

VideoDialog.preInit();
tinyMCEPopup.onInit.add(VideoDialog.init, VideoDialog);