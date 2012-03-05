var ArticleEditor = (function() {
  var div = $("#post-article");
  var initialized = false;
  var init = function() {
	  $("textarea", div)
	      .tinymce(
	          {
	            // Location of TinyMCE script
	            script_url : '/static/tiny_mce/tiny_mce.js',
	
	            // General options
	            theme : "advanced",
	            plugins : "save,advhr,advlink,emotions,iespell,inlinepopups,preview,media,searchreplace,paste,directionality,fullscreen,visualchars,xhtmlxtras",
	
	            entity_encoding : "raw",
	            // Theme options
	            theme_advanced_buttons1 : "fontselect,fontsizeselect,bold,italic,underline,strikethrough,forecolor,backcolor,|,justifyleft,justifycenter,justifyright,justifyfull,|,bullist,numlist,|,outdent,indent,blockquote,|,removeformat,|,sub,sup,|,charmap,emotions,|,code,preview,fullscreen",
	            theme_advanced_buttons2 : "link,unlink,image,video,cleanup,help",
	            theme_advanced_buttons3 : "",
	            theme_advanced_toolbar_location : "top",
	            theme_advanced_toolbar_align : "left",
	            theme_advanced_statusbar_location : "bottom",
	            theme_advanced_resizing : true,
	            apply_source_formatting : true,
	            convert_urls : false,
	
	            // Example content CSS (should be your site CSS)
	            content_css : "/static/css/content.css"
	          });
	  // http://xoxco.com/projects/code/tagsinput/
	  $("#post-article-tags_tagsinput").length == 0 && $("#post-article-tags").tagsInput({
	    width : $(".input-xlarge", div).width(),
	    height : "66px",
	    defaultText : gettext("Add a tag"),
	    interactive : true,
	    removeWithBackspace : true,
	    maxChars : 255
	  });
	  // http://code.google.com/apis/recaptcha/docs/display.html
	  Recaptcha.create(RECAPTCHA_PUBLIC_KEY, "article-captcha", {
	    theme : "clean",
	    callback : Recaptcha.focus_response_field
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
  	return $("#post-article-id").length > 0 && !$("#post-article-id").attr("disabled");
  }
  var open = function() {
  	initialized ? transferFieldValues() :init();
  	
    if (!models.Category.getCurrent()) {
      $().toastmessage("showWarningToast", gettext("No category selected."));
      return false;
    }
    $("#post-article-current-path").text(isEdit() ? gettext("Home") + " / " + models.Article.getCurrent().category.path.join(" / ") : models.Category.getCurrentPath());
    div.modal();
    return false;
  }
  var transferFieldValues = function() {
  	$("#post-article-tags").importTags($("#post-article-tags").val());
  	tinyMCE.activeEditor.setContent($("#post-article-body").val());
  }
  var close = function() {
	  div.modal("hide");
	  $("#post-article-form")[0].reset();
	  $("#post-article-tags").importTags("");
	  Recaptcha.reload();
  }
  var reset = function() {
  	$("#post-article-title").val("");
  	$("#post-article-tags").val("").importTags("");
  	$("#post-article-body").val("");
  	tinyMCE.activeEditor.setContent("");
  }
  this.close = close;
  this.open = open;
  this.init = init;
  return this;
})();

var CommentEditor = (function() {
	var self = {
			callback: null,
			registerCallback : function(callback) {
				self.callback = callback;
			}
	}
	var submit = function(event) {
		if(!event.shiftKey && event.keyCode == 13) {
			self.callback && self.callback();
			event.preventDefault();
			return false;
		}
		return true;
	}
	
	$("textarea#post-comment").autoResize({
    onResize : function() {
        $(this).css({opacity:0.8});
    },
    animateCallback : function() {
        $(this).css({opacity:1});
    },
    animateDuration : 0,
    extraSpace : 0
	}).bind("keydown", submit).bind("keypress", submit);
	
	return self;
})();