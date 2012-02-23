var Category = (function() {
  var self = {
    select: function(category, callback) {
    	$("#loading").show();
      if(self.getCurrent() == category) {
        Article.loadList(category, callback);
        return;
      }
      $("#article-list, #article-pagination").hide();
      $.getJSON("/service/category/" + category, function(data) {
        $("#container .breadcrumb li:gt(0)").remove();
        $("#container .breadcrumb li:eq(0) .divider").toggle(data.current_category != null);
        $("#sidebar .nav").html($(data.category_list).map(function(i, item) {
          var result = '<li' + (data.current_category && item.category == data.current_category.category ? ' class="active"' : "") + '><a href="#!/' + item.category + '" title="' + item.category + '">' + _(item.category) + ' <span class="article-count">(' + item.article_count + ')</span></a></li>';
          item.children && $(item.children).each(function(i, child) {
            result += '<li><a href="#!/' + child.category + '" class="children" title="' + child.category + '"><i class="icon-chevron-right"></i> ' + _(child.category) + ' <span class="article-count">(' + child.article_count + ')</span></a></li>';
          });
          return result;
        }).get().join(""));
        if(data.current_category) {
          var lastPos = data.current_category.path.length - 1; 
          $("#container .breadcrumb").append($(data.current_category.path).map(function(i, item) {
            return '<li' + (i == lastPos ? ' class="active"' : "") + '><a href="#!/' + item + '">' + _(item) + '</a> ' + (i != lastPos ? '<span class="divider">/</span>' : '') + '</li>'; 
          }).get().join(""));
          $("#article-list caption").html(data.current_category.description);
          Article.loadList(data.current_category.category, callback);
        } else {
        	$("#article-list caption").empty();
        	$("#loading").hide();
        }
      });
    },
    getCurrent: function() {
      return $("#sidebar .nav .active > a").attr("title");
    },
    getCurrentPath: function() {
      return $.trim($("#container .breadcrumb").text().replace(/\s+/g, " "))
    }
  }
  return self;
})();

var Article = (function() {
  var self = {
      loadList: function(category, callback) {
      	var page = HASH_PARAMS.page;
      	page || (page = 1);      	
      	if($("#article-list").data("category") == category && $("#article-list").data("page") == page) {
      		callback && callback();
      		return;
      	}
      	$("#loading").show();
      	$("#article-item").hide();
      	$.getJSON("/service/article-list/" + category, {page: page}, function(data) {
      		var currentCategory = Category.getCurrent();
      		$("#article-list tbody").html($(data.list).map(function(i, item) {
      			return '<tr>\
      								<td>' + item.category + '</td>\
      								<td><a href="#!/' + currentCategory + '/' + item.id + '?page=' + page + '" class="article-item" title="' + item.title + '">' + item.title + '</a>' + (item.comment_count > 0 ? ' <span class="comment-count">(' + item.comment_count + ')</span>' : "") + '</td>\
      								<td><a href="/user/' + item.author.id + '" class="user">' + item.author.nickname + '</td>\
      								<td>' + item.like_count + '</td>\
      								<td>' + prettyDate(item.created) + '</td>\
      							</tr>';
      		}).get().join(""));
      		$("#article-list").data("category", category).data("page", page);
      		$("#article-list, #article-pagination").show();
      		$("#article-pagination").pagination(data.count, {
            items_per_page : 20,
            current_page : page - 1, // zero base
            callback : function(pageSelected) {
              if (pageSelected > -1) {
              	HASH_PARAMS.page = pageSelected + 1;
              	$.history.load("!/" + category + "?page=" + HASH_PARAMS.page);
              }
              return false;
            }
          });
      		callback && callback(data);
      		$("#loading").hide();
      	});
      },
      show: function(id) {
      	$("#loading").show();
      	$("#article-list tbody .active").removeClass("active");
      	$("#article-list tbody tr:has(a[href*='/" + id + "'])").addClass("active");
      	
      	$.getJSON("/service/article/" + id, function(data) {
      		$.each(data.article, function(k, v) {
      			$("#article-item #article-item-" + k).html(v);
      		});
      		$("#article-item").show();
      		$("#loading").hide();
      	});
      },
      post: function(form, callback) {
        $.post("/service/article/" + Category.getCurrent(), form.serialize(), function(data) {
        	var div = $("#post-article")
      	  div.modal("hide");
      	  console.log(data);
      	  form[0].reset();
      	  $("#tags", div).importTags('');
      	  Recaptcha.reload();
        }, "json");
      }
  }
  return self;
})();

$("#article-list tbody .article-item").live("click", function(event) {
	$("#article-item #article-item-title").text($(this).attr("title"));
	return true;
});

$("#btn-post-article-submit").click(function() {
  Article.post($("#post-article-form"));
  return false;
});

$("#sidebar .nav > li > a").live("click", function() {
  if(!$(this).hasClass("children")) {
    $("#container .breadcrumb .active").text($(this).attr("title"));
    $("#sidebar .nav .active").removeClass("active");
    $(this).parent().addClass("active");    
  }
  return true;
});