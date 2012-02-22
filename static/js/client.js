var Category = (function() {
  var self = {
    select: function(category) {
      if(this.getCurrent() == category) {
        Category.loadArticleList(category);
        return;
      }
      $.getJSON("/" + category, function(data) {
        $("#container .breadcrumb li:gt(0)").remove();
        $("#container .breadcrumb li:eq(0) .divider").toggle(data.current_category != null);
        $("#sidebar .nav").html($(data.category_list).map(function(i, item) {
          var result = '<li' + (data.current_category && item.category == data.current_category.category ? ' class="active"' : "") + '><a href="#!/' + item.category + '">' + _(item.category) + '</a></li>';
          item.children && $(item.children).each(function(i, child) {
            result += '<li><a href="#!/' + child.category + '" class="children"><i class="icon-chevron-right"></i> ' + _(child.category) + '</a></li>';
          });
          return result;
        }).get().join(""));
        if(data.current_category) {
          var lastPos = data.current_category.path.length - 1; 
          $("#container .breadcrumb").append($(data.current_category.path).map(function(i, item) {
            return '<li' + (i == lastPos ? ' class="active"' : "") + '><a href="#!/' + item + '">' + _(item) + '</a> ' + (i != lastPos ? '<span class="divider">/</span>' : '') + '</li>'; 
          }).get().join(""));
          
          Category.loadArticleList(data.current_category.category);
        }        
      });
    },
    getCurrent: function() {
      return $("#sidebar .nav .active").text();
    },
    getCurrentPath: function() {
      return $.trim($("#container .breadcrumb").text().replace(/\s+/g, " "))
    },
    loadArticleList: function(category) {
      console.log("loadArticleList", category)
    }
  }
  return self;
})();

$("#sidebar .nav > li > a").live("click", function() {
  if(!$(this).hasClass("children")) {
    $("#container .breadcrumb .active").text($.trim($(this).text()));
    $("#sidebar .nav .active").removeClass("active");
    $(this).parent().addClass("active");    
  }
  return true;
});