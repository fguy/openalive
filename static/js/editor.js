$(function() {
  var button = $(".btn-post-article");
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
	
	            // Example content CSS (should be your site CSS)
	            content_css : "/static/css/content.css"
	          });
	  // http://xoxco.com/projects/code/tagsinput/
	  $("#tags_tagsinput", div).length == 0 && $("#tags", div).tagsInput({
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
	    $("#title", div).focus();
	    $("body").css("overflow", "hidden");
	  });
	  div.on("hidden", function() {
	    $("body").css("overflow", "auto");
	  });
	  initialized = true;
  }
  button.click(function() {
  	initialized || init();
    if (!models.Category.getCurrent()) {
      $().toastmessage("showWarningToast", gettext("No category selected."));
      return false;
    }
    $("#current-path", div).text(models.Category.getCurrentPath());
    div.modal();
    return false;
  });
});