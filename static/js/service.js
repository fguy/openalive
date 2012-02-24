$().ajaxError(function() {
  alert(1);
})
var Category = (function() {
  var self = {
    starred: [],
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
          var result = '<li' + (data.current_category && item.category == data.current_category.category ? ' class="active"' : "") + '><a href="#!/' + item.category + '" title="' + item.category + '" class="category-link"><i class="icon-star icon-star-empty"></i> <span class="category-title">' + _(item.category) + '</span> <span class="article-count">(' + item.article_count + ')</span></a></li>';
          item.children && $(item.children).each(function(i, child) {
            result += '<li><a href="#!/' + child.category + '" class="children category-link" title="' + child.category + '"><i class="icon-chevron-right"></i> <i class="icon-star icon-star-empty"></i> <span class="category-title">' + _(child.category) + '</span> <span class="article-count">(' + child.article_count + ')</span></a></li>';
          });
          return result;
        }).get().join(""));
        $(self.starred).each(function(i, item) {
          self.markStarred(item);
        });
        if(data.current_category) {
          var lastPos = data.current_category.path.length - 1; 
          $("#container .breadcrumb").append($(data.current_category.path).map(function(i, item) {
            return '<li' + (i == lastPos ? ' class="active"' : "") + '><a href="#!/' + item + '">' + _(item) + '</a> ' + (i != lastPos ? '<span class="divider">/</span>' : '') + '</li>'; 
          }).get().join(""));
          $("#article-list caption").html(data.current_category.description);
          Article.loadList(data.current_category.category, callback);
        } else {
        	$("#article-list caption").empty();
        	$("#article-item, #loading").hide();
        }
      });
    },
    getCurrent: function() {
      return $("#sidebar .nav .active > .category-link").attr("title");
    },
    getCurrentPath: function() {
      return $.trim($("#container .breadcrumb").text().replace(/\s+/g, " "))
    },
    loadStarred: function() {
      $("#loading").show();
      $.getJSON("/service/starred-category", function(data) {
        self.renderStarred(data.starred_category_list);
        $("#loading").hide();
      });
    },
    renderStarred: function(data) {
      self.starred = data;
      $("#starred .nav").html($(data).map(function(i, item) {
        return self.decorateStarredItem(item);
      }).get().join(""));
    },
    decorateStarredItem: function(category) {
      return '<li><a href="#!/' + category + '" title="' + category + '" class="category-link"><i class="icon-star"></i> <span class="category-title">' + _(category) + '</span></a></li>';
    },
    markStarred: function(category, empty) {
      var place = $("#sidebar .category-link[title=" + category + "] .icon-star");
      if(place.length > 0) {
        empty ? place.addClass("icon-star-empty") : place.removeClass("icon-star-empty");
      }
    },
    star: function(category) {
      self.markStarred(category);
      $.post("/service/starred-category/" + category, function() {
        $("#starred .nav").append(self.decorateStarredItem(category));
        self.starred.push(category);
      }, "json");
    },
    unstar: function(category) {
      self.markStarred(category, true);
      $.ajax({
        type: "DELETE",
        url: "/service/starred-category/" + category,
        cache: false,
        success: function() {
          $("#starred .nav li:has(.category-link[title=" + category + "])").remove();
          var needle = $.inArray(category, self.starred);
          needle != -1 && self.starred.splice(needle, 1);
        },
        dataType: "json"
      });
    }
  }
  self.loadStarred();
  return self;
})();

var Article = (function() {
  var self = {
      loadList: function(category, callback) {
      	var page = self.getCurrentPage();
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
      			return self.decorateRow(currentCategory, page, item);
      		}).get().join(""));
      		$("#article-list").data("category", category).data("page", page);
      		$("#article-list, #article-pagination").show();
      		$("#article-pagination").pagination(data.count, {
            items_per_page : 20,
            current_page : page - 1, // zero base
            callback : function(pageSelected) {
              if (pageSelected > -1) {
              	$.history.load("!/" + category + "?page=" + (pageSelected + 1));
              }
              return false;
            }
          });
      		callback && callback(data);
      		$("#loading").hide();
      	});
      },
      getCurrentPage: function() {
        return HASH_PARAMS.page;
      },
      show: function(id) {
        $.scrollTo(0, 100);
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
        var currentCategory = Category.getCurrent();
        $.post("/service/article/" + currentCategory, form.serialize(), function(data) {
          if(self.getCurrentPage() != 1) {
            $.history.load("!/" + currentCategory + "/?page=1");
          }
          $(data.article.category.path).each(function(i, item) {
            var countDiv = $("#sidebar .category-link[title=" + item + "] .article-count");
            countDiv.length > 0 && countDiv.text("(" + (parseInt(countDiv.text().match(/[0-9]+/)[0]) + 1) + ")");
          });
          $(self.decorateRow(currentCategory, 1, $.extend(true, data.article, {
            category: data.article.category.category,
          }))).prependTo("#article-list tbody");
        	var div = $("#post-article")
      	  div.modal("hide");
      	  form[0].reset();
      	  $("#tags", div).importTags('');
      	  Recaptcha.reload();
      	  $("#article-item, #loading").hide();
        }, "json");
      },
      decorateRow: function(currentCategory, page, item) {
        return '<tr>\
          <td>' + item.category + '</td>\
          <td><a href="#!/' + currentCategory + '/' + item.id + '?page=' + page + '" class="article-item" title="' + item.title + '">' + item.title + '</a>' + (item.comment_count > 0 ? ' <span class="comment-count">(' + item.comment_count + ')</span>' : "") + '</td>\
          <td><a href="/user/' + item.author.id + '" class="user">' + item.author.nickname + '</td>\
          <td>' + item.like_count + '</td>\
          <td>' + prettyDate(item.created) + '</td>\
        </tr>';
      }
  }
  return self;
})();

$("#article-list tbody .article-item").live("click", function(event) {
	$("#article-item #article-item-title").text($(this).attr("title"));
	return true;
});

$("#sidebar .nav .icon-star, #starred .nav .icon-star").live("click", function() {
  $(this).hasClass("icon-star-empty") ? Category.star($(this).parent().attr("title")) : Category.unstar($(this).parent().attr("title"));
  return false;
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