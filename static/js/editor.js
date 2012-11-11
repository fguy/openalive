var ArticleEditor = (function() {
  var div = $("#post-article");
  var initialized = false;
  var init = function() {
    $("textarea", div)
        .redactor(
            {
              lang : $("html").attr("lang"),
              allowedTags : [ "code", "span", "div", "label", "a", "br", "p",
                  "b", "i", "del", "strike", "u", "img", "video", "audio",
                  "iframe", "object", "embed", "param", "blockquote", "mark",
                  "cite", "small", "ul", "ol", "li", "hr", "dl", "dt", "dd",
                  "sup", "sub", "big", "pre", "code", "figure", "figcaption",
                  "strong", "em" ],
              buttons : [ "html", "|", "formatting", "|", "bold", "italic",
                  "deleted", "|", "unorderedlist", "orderedlist", "outdent",
                  "indent", "|", "image", "video", "link", "|", "fontcolor",
                  "backcolor", "|", "alignment", "|", "horizontalrule" ],
              formattingTags : [ "p", "blockquote", "pre" ],
              plugins : [ "fullscreen" ],
              modal_video : String()
                  + '<div id="redactor_modal_content">'
                  + '<form id="redactorInsertVideoForm">'
                  + '<label>Enter Youtube URL</label>'
                  + '<textarea id="redactor_insert_video_area" style="width: 99%; height: 160px;"></textarea>'
                  + '</form>'
                  + '</div>'
                  + '<div id="redactor_modal_footer">'
                  + '<a href="javascript:void(null);" class="redactor_modal_btn redactor_btn_modal_close">'
                  + RLANG.cancel
                  + '</a>'
                  + '<input type="button" class="redactor_modal_btn" id="redactor_insert_video_btn" value="'
                  + RLANG.insert + '" />' + '</div>',
              modal_image: String() +
                  '<div id="redactor_modal_content">' +
                  '<div id="redactor_tabs">' +
                    '<a href="javascript:void(null);" class="redactor_tabs_act">' + RLANG.upload + '</a>' +
                    '<a href="javascript:void(null);">' + RLANG.choose + '</a>' +
                    '<a href="javascript:void(null);">' + RLANG.link + '</a>' +
                  '</div>' +
                  '<form id="redactorInsertImageForm" method="post" action="" enctype="multipart/form-data">' +
                    '<div id="redactor_tab1" class="redactor_tab">' +
                      '<input type="file" id="redactor_file" name="fileupload" />' +
                    '</div>' +
                    '<div id="redactor_tab2" class="redactor_tab" style="display: none;">' +
                      '<div id="redactor_image_box"></div>' +
                    '</div>' +
                  '</form>' +
                  '<div id="redactor_tab3" class="redactor_tab" style="display: none;">' +
                    '<label>' + RLANG.image_web_link + '</label>' +
                    '<input type="text" name="redactor_file_link" id="redactor_file_link" class="redactor_input"  />' +
                  '</div>' +
                  '</div>' +
                  '<div id="redactor_modal_footer">' +
                    '<a href="javascript:void(null);" class="redactor_modal_btn redactor_btn_modal_close">' + RLANG.cancel + '</a>' +
                    '<input type="button" name="upload" class="redactor_modal_btn" id="redactor_upload_btn" value="' + RLANG.insert + '" />' +
                  '</div>',
              iframe: true,
              css : "/static/css/content.css",
              imageUpload: "/upload",
              minHeight: 300
            });
    // Replace video input for youtube
    $("textarea", div).getObject().insertVideo = function() {
      var v = this.stripTags($('#redactor_insert_video_area').val());

      if(v.indexOf("http://www.youtube.com/") !== 0) {
        booxbox.alert("Not supported URL.");
        this.modalClose();
        return;
      }
      if (v.match(/watch\?v=(.*)/)) {
        v = 'http://www.youtube.com/embed/' + v.match(/v=(.*)/)[0].split('=')[1].split("&")[0];
      } else if(v.match(/v\/(.*)/)) {
        v = 'http://www.youtube.com/embed/' + v.match(/v\/(.*)/)[0].split('=')[1].split("&")[0];
      } else {
        booxbox.alert("Invalid URL.");
        this.modalClose();
        return;
      }
      
      this.restoreSelection();
      this.execCommand('inserthtml', '<iframe type="text/html" frameborder="0" src="' + v + '?wmode=opaque" width="640" height="390"></iframe>');
      this.modalClose();
    }

    // http://xoxco.com/projects/code/tagsinput/
    $("#post-article-tags_tagsinput").length == 0
        && $("#post-article-tags").tagsInput(
            {
              width : $(".input-xlarge", div).width(),
              height : "66px",
              defaultText : gettext("Add a tag"),
              interactive : true,
              removeWithBackspace : true,
              onChange : function(input, val) {
                if (input.val && input.val().split(",").length > 5) {
                  $().toastmessage("showWarningToast",
                      gettext("You can enter 5 tags or less."));
                  input.removeTag(val);
                }
              },
              maxChars : 50
            });
    // http://code.google.com/apis/recaptcha/docs/display.html
    Recaptcha.create(RECAPTCHA_PUBLIC_KEY, "article-captcha", {
      theme : "clean"
    });
    div.on("shown", function() {
      $("#post-article-title").focus();
      $("body").css("overflow", "hidden");
    }).on("hidden", function() {
      $("body").css("overflow", "auto");
      isEdit() && reset();
    });
    initialized = true;
  }
  var isEdit = function() {
    return $("#post-article-id").length > 0
        && !$("#post-article-id").attr("disabled");
  }
  var open = function() {
    initialized ? transferFieldValues() : init();
    var edit = isEdit();
    $("#post-article-captcha-control-group").toggle(!edit);
    if (!edit && !service.Category.getCurrent()) {
      $().toastmessage("showWarningToast", gettext("No category selected."));
      return false;
    }
    $("#post-article-current-path").text(
        edit ? gettext("Home") + " / "
            + service.Article.getCurrent().category.path.join(" / ")
            : service.Category.getCurrentPath());
    div.modal();
    return false;
  }
  var transferFieldValues = function() {
    $("#post-article-tags").importTags($("#post-article-tags").val());
    $("textarea", div).setCode($("#post-article-body").val());
  }
  var close = function() {
    div.modal("hide");
    $("#captcha-error").hide();
    $("#post-article-form")[0].reset();
    $("#post-article-tags").importTags("");
    Recaptcha.reload();
  }
  var reset = function() {
    $("#captcha-error").hide();
    $("#post-article-title").val("");
    $("#post-article-tags").val("").importTags("");
    $("#post-article-body").val("");
    $("textarea", div).setCode("");
  }
  this.close = close;
  this.open = open;
  this.init = init;
  return this;
})();

var CommentEditor = (function() {
  var self = {
    callback : null,
    registerCallback : function(callback) {
      self.callback = callback;
    }
  }
  var submit = function(event) {
    if (!event.shiftKey && event.keyCode == 13) {
      self.callback && self.callback();
      event.preventDefault();
      return false;
    }
    return true;
  }

  $("textarea#post-comment").autoResize({
    onResize : function() {
      $(this).css({
        opacity : 0.8
      });
    },
    animateCallback : function() {
      $(this).css({
        opacity : 1
      });
    },
    animateDuration : 0,
    extraSpace : 0
  }).bind("keydown", submit).bind("keypress", submit);

  return self;
})();