$.ajaxSetup({
	error:function(jqXHR, textStatus, errorThrown) {
		var errorMessage = jqXHR.responseText;
		$().toastmessage("showErrorToast", errorMessage ? errorMessage : gettext("An error occurred."));
		$("#loading").hide();
	}
});

var getRss = function(url) {
  new google.feeds.Feed("http://localhost:8080/service/article-list/%EC%A0%95%EC%B9%98?output=rss").load(function(data) {
    if (!data.error) {
    	console.log(data.feed);
    	$(data.feed.entries).each(function(i, item) {
    		console.log(item);
    	});
    }
  });		
}

var models;
var initializeModels = function() {
	models || (models = {
		Category : (function() {
		  var self = {
		    starred: [],
		    select: function(name, callback) {
		    	$("#loading").show();
		      if(self.getCurrent() == name) {
		        models.Article.loadList(name, callback);
		        return;
		      }
		      models.Article.hideList();
		      $.getJSON("/service/category/" + name, function(data) {
		        $("#container .breadcrumb li:gt(0)").remove();
		        $("#container .breadcrumb li:eq(0) .divider").toggle(data.current_category != null);
		        $("#sidebar .nav").html($(data.category_list).map(function(i, item) {
		          var result = self.decorateItem(item, data.current_category && item.name == data.current_category.name);
		          item.children && $(item.children).each(function(i, child) {
		            result += self.decorateItem(child, false, true);
		          });
		          return result;
		        }).get().join(""));
		        $(self.starred).each(function(i, item) {
		          self.markStarred(item);
		        });
		        if(data.current_category) { 
		          var lastPos = data.current_category.path.length - 1; 
		          $("#container .breadcrumb").append($(data.current_category.path).map(function(i, item) {
		            return formatString('<li{{ activeClass }}><a href="#!/{{ category }}">{{ category|gettext }}</a> {{ divider }}</li>', {
		            	activeClass: i == lastPos ? ' class="active"' : "",
		            	category: item,
		            	divider: i != lastPos ? '<span class="divider">/</span>' : ''
		            }); 
		          }).get().join(""));
		          data.current_category.description ? $("#article-list caption").html(data.current_category.description) : $("#article-list caption").hide();
		          models.Article.loadList(data.current_category.name, callback);
		        } else {
		        	$("#article-list caption").empty();
		        	$("#loading, #no-article, .btn-post-article").hide();
		        	models.Article.hide();
		        }
		      });
		    },
		    decorateItem: function(item, isActive, isChild) {
		      var me = models.User.getMe();
		    	return formatString('<li{{ activeClass }}>\
		    	          <a href="#!/{{ name }}" title="{{ name }}" class="category-link{{ childClass }}">\
		    							{{ childIcon }}\
		    			 				{{ star }}\
	  	    	          <span class="category-title">{{ name|gettext }}</span> \
	  	    	          <span class="article-count">({{ article_count }})</span>\
		    	          </a>\
	  	    	      </li>', $.extend(true, item, {
	  	    	      	activeClass: isActive ? ' class="active"' : "",
	  	    	      	childClass: isChild ? ' children' : "",
	  	    	      	childIcon: isChild ? '<i class="icon-chevron-right"></i> ' : "",
	  	    	      	star: me ? '<i class="icon-star icon-star-empty" title="' + gettext("Star") + '"></i>' : ""
	  	    	      }));
		    },
		    getCurrent: function() {
		      return $("#sidebar .nav .active > .category-link").attr("title");
		    },
		    getCurrentPath: function() {
		      return $.trim($("#container .breadcrumb").text().replace(/\//g, " / "))
		    },
		    loadStarred: function() {
		      $("#loading").show();
		      $.getJSON("/service/starred-category", function(data) {
		        self.renderStarred(data.starred_category_list);
		        $("#starred-wrapper").toggle(data.starred_category_list.length > 0);
		        $("#loading").hide();
		      });
		    },
		    renderStarred: function(data) {
		      self.starred = data;
		      $("#starred").html($(data).map(function(i, item) {
		        return self.decorateStarredItem(item);
		      }).get().join(""));
		    },
		    decorateStarredItem: function(name) {
		      return formatString('<span class="label label-success"><a href="#!/{{ name }}" title="{{ name }}" class="category-link"><i class="icon-star icon-white" title="' + gettext("Unstar") + '"></i> <span class="category-title">{{ name|gettext }}</span></a></span> ', {
		      	name: name
		      });
		    },
		    markStarred: function(name, empty) {
		      var place = $("#sidebar .category-link[title=" + name + "] .icon-star");
		      if(place.length > 0) {
		        empty ? place.addClass("icon-star-empty") : place.removeClass("icon-star-empty");
		      }
		    },
		    star: function(name) {
		      self.markStarred(name);
		      $.post("/service/starred-category/" + name, function() {
		        $("#starred").append(self.decorateStarredItem(name));
		        self.starred.push(name);
		        $("#starred-wrapper").toggle(self.starred.length > 0);
		      }, "json");
		    },
		    unstar: function(name) {
		      self.markStarred(name, true);
		      $.ajax({
		        type: "DELETE",
		        url: "/service/starred-category/" + name,
		        cache: false,
		        success: function() {
		          $("#starred span:has(.category-link[title=" + name + "])").remove();
		          var needle = $.inArray(name, self.starred);
		          needle != -1 && self.starred.splice(needle, 1);
		          $("#starred-wrapper").toggle(self.starred.length > 0);
		        },
		        dataType: "json"
		      });
		    }
		  }
		  self.loadStarred();
	
	    $("#sidebar .nav .icon-star, #starred .icon-star").live("click", function() {
	      $(this).hasClass("icon-star-empty") ? models.Category.star($(this).parent().attr("title")) : models.Category.unstar($(this).parent().attr("title"));
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
		  return self;
		})(),
		
		Article: (function() {
		  var self = {
		  		current: null,
		      loadList: function(categoryName, callback) {
		        $("#loading, #article-btns, .btn-post-article").show();
		      	var page = self.getCurrentPage();
		      	page || (page = 1);
		      	if($("#article-list").data("category") == categoryName && $("#article-list").data("page") == page) {
		      	  self.showList();
		      		callback && callback();
		      		$("#no-article, #loading").hide();
		      		return;
		      	}
		      	var currentCategory = models.Category.getCurrent();
		      	document.title = currentCategory;
		      	self.hide();
		      	callback && callback();
		      	$.getJSON("/service/article-list/" + categoryName, {page: page}, function(data) {
		      	  if(data.list.length == 0) { // no article in this category.
		      	    $("#no-article").show().find(".current-category-name").text(currentCategory);
		      	    $("#loading").hide();
		      	    self.hideList();
		      	    return;
		      	  }
		      	  $("#no-article").hide();
		      		$("#article-list tbody").html($(data.list).map(function(i, item) {
		      			return self.decorateRow(currentCategory, page, item);
		      		}).get().join(""));
		      		$("#article-list").data("category", categoryName).data("page", page);
		      		self.showList();
		      		$("#article-pagination").pagination(data.count, {
		            items_per_page : 20,
		            current_page : page - 1, // zero base
		            callback : function(pageSelected) {
		              if (pageSelected > -1) {
		              	$.history.load("!/" + categoryName + "?page=" + (pageSelected + 1));
		              }
		              return false;
		            }
		          });
		      		$("#loading").hide();
		      	});
		      },
		      getCurrent: function() {
		      	return self.current;
		      },
		      getCurrentPage: function() {
		        return HASH_PARAMS.page;
		      },
		      show: function(id) {
		      	$("#article-list tr.active").removeClass("active");
		      	$("#article-list tr:has(a[href*='/" + id + "?'])").addClass("active");
		      	$("#article-item-body").html('<div class="loading"><i class="icon-clock">' + gettext("Loading...") + "</div>");
		      	$("#loading").show();
		      	$.getJSON("/service/article/" + id, function(data) {
		      		if(!data.article) {
		      			return;
		      		}
		      		document.title = data.article.title + " - " + data.article.category.name;
		      		self.current = data.article;
		      		self.current.tags = data.tags;
		      		self.current["liked-users"] = data["liked-users"];
		      		self.current["hated-users"] = data["hated-users"];
		      		self.current["subscribed-users"] = data["subscribed-users"];
		      		self.render();
		      		$("#article-btns .btn-read").show();
		      		$("#article-btns .btn-reputation, #article-btns .btn-follow").hide();
		      		var me = models.User.getMe();
		      		if(!me || data.article.author.email_hash != me.email_hash) { // don't show for mine
			      		var reputationFound = false;
			      		$(models.Reputation.types).each(function(i, item) {
			      			if(data[item + "d"]) {
			      				reputationFound = true;
			      				$("#btn-un" + item + "-article").show();
			      				return;
			      			}
			      		});
			      		reputationFound || $("#btn-like-article, #btn-hate-article").show();
			      		$("#article-btns .btn-edit").hide();
			      		data.subscribed ? $("#btn-unfollow-article").show() :  $("#btn-follow-article").show();
		      		} else {
		      			$("#article-btns .btn-edit").show();
		      		}
		      		
		      		$("#article-item, #article-reputation").show();
		      		$.scrollTo($("#article-item").position().top - 57, 100);
		      		$("#loading, #article-list caption").hide();
		      		$("#comments li:not(:last):not(:first)").remove();
		      		models.Comment.resetLoadedCount();
		      		models.Comment.renderBest(data.best_comment_list);
		      		models.Comment.render(data.comment_list);
		      	});
		      },
		      render: function() {
		      	$("#article-item-title").text(self.current.title);
		      	$("#article-item-body").html(self.current.body);
		      	$("#article-item-author-avatar").html(formatString('<a href="/user/{{ authorId }}" class="user">{{ thumbnail }}</a>', {
		      		authorId: self.current.author.id,
		      		original: models.User.getAvatar(self.current.author.email_hash, null, true),
		      		thumbnail: models.User.getAvatar(self.current.author.email_hash, 100)
		      	}));
		      	$("#article-item-author-nickname").html(formatString('<a href="/user/{{ author.id }}" class="user"><span class="nickname">{{ author.nickname }}</span></a>', self.current));
		      	$("#article-item-author-joined").text(prettyDate(self.current.author.joined));
		      	$("#article-item-created time").attr("datetime", self.current.created).text(prettyDate(self.current.created));
		      	if(self.current.created != self.current.last_updated) {
		      		$("#article-item-last-updated").show().find("time").attr("datetime", self.current.last_updated).text(prettyDate(self.current.last_updated));
		      	} else {
		      		$("#article-item-last-updated").hide();
		      	}
	      		$("#article-item-tags").html($(self.current.tags).map(function(i, item) {
	      			return '<li><i class="icon-tag"></i> <a href="/tags/' + item.content[0] + '" class="tag-item">' + item.content[0] + '</a></li>';
	      		}).get().join(""));
	      		$(models.Reputation.types).each(function(i, item) {
	      		  models.Reputation.renderUsers(item);
	      		});
		      },
		      hideList: function() {
		        $("#article-list, #article-pagination, #article-list caption").hide();
		      },
		      showList: function() {
		        $("#no-article").hide();
		        $("#article-list, #article-pagination, #article-list caption:not(:empty)").show();
		        self.resizeRow();
		      },
		      hide: function() {
		      	self.current = null;
		      	$("#article-list tbody .active").removeClass("active");
		      	$("#article-item, #article-reputation, .btn-read").hide();
		      },
		      post: function(form) {
		        var currentCategory = models.Category.getCurrent();
		        $("#loading").show();
		        $.post("/service/article/" + currentCategory, form.serialize(), function(data) {
		          if(self.getCurrentPage() != 1) {
		            $.history.load("!/" + currentCategory + "/?page=1");
		          }
		          $(data.article.category.path).each(function(i, item) {
		            var countDiv = $("#sidebar .category-link[title=" + item + "] .article-count");
		            if(countDiv.length > 0) {
		              count = parseInt(countDiv.text().match(/[0-9]+/)[0]) + 1;
		              countDiv.text("(" + count + ")");
		              count == 1 && self.showList();
		            }
		          });
	            if($("#no-article").is(":visible")) {
	              $("#no-article").hide();
	              self.showList();
	            }
		          $(self.decorateRow(currentCategory, 1, $.extend(true, data.article, {
		            category: data.article.category.name,
		          }))).prependTo("#article-list tbody");
		          ArticleEditor.close();
		      	  $("#loading").hide();
		      	  $().toastmessage("showSuccessToast", gettext("Posted."));
		      	  self.hide();
		      	  self.resizeRow();
		        }, "json");
		      },
		      put: function(form, callback) {
		      	var json = {};
		      	$(form.serializeArray()).each(function(i, item) {
		      		json[item.name] = item.value;
		      	});
		      	$("#loading").show();
			      $.ajax({
			        type: "PUT",
			        url: "/service/article",
			        data: JSON.stringify(json),
			        cache: false,
			        success: function(data) {
			          self.current = data.article;
			          self.current.tags = data.tags;
			          self.render();
			          $("#article-list tbody .active").find(".article-excerpt").text(data.article.excerpt);
			      	  $("#loading").hide();
			      	  $().toastmessage("showSuccessToast", gettext("Updated."));
			      	  ArticleEditor.close();
			      	  self.resizeRow();
			        },
			        dataType: "json"
			      });	      	
		      },
		      delete: function() {
		      	$("#loading").show();
			      $.ajax({
			        type: "DELETE",
			        url: "/service/article/" + self.current.id,
			        cache: false,
			        success: function() {
			        	$().toastmessage("showSuccessToast", gettext("Deleted."));
			          $("#article-list tr.active").remove();
			          var currentCategory = models.Category.getCurrent();
			        	$.history.load("!/" + currentCategory);
			          $("#loading").hide();
		            $(self.current.category.path).each(function(i, item) {
		              var countDiv = $("#sidebar .category-link[title=" + item + "] .article-count");
		              if(countDiv.length > 0) {
		                count = parseInt(countDiv.text().match(/[0-9]+/)[0]) - 1;
		                countDiv.text("(" + count + ")");
		                count == 1 && self.showList();
		              }
		            });
			          self.current = null;
			        },
			        dataType: "json"
			      });
		      },
		      decorateRow: function(currentCategory, page, item) {
		        return formatString('<tr>\
		          <td class="article-category">{{ category }}</td>\
		          <td class="article-item">\
			          <div class="article-item-wrapper">\
			          	<a href="#!/{{ currentCategory }}/{{ id }}?page={{ page }}" class="article-title" title="{{ title }}">{{ title }}</a> {{ hasImage }}{{ hasVideo }}\
			          	<span class="comment-count">{{ commentCount }}</span>\
			          	<span class="article-excerpt">{{ excerpt }}</span>\
			          </div>\
		          </td>\
		          <td class="article-user"><a href="/user/{{ author.id }}" class="user">{{ avatar }}<span class="nickname">{{ author.nickname }}</span></a></td>\
		          <td class="article-likes"><span class="like-count count">{{ like_count }}</span></td>\
		          <td class="article-date"><time datetime="{{ created }}">{{ created|prettyDate }}</time></td>\
		        </tr>', $.extend(true, item, {
		        currentCategory: currentCategory,
		        page: page,
		        avatar: models.User.getAvatar(item.author.email_hash, 16),
		        hasVideo: item.video != null ? '<i class="icon-film"></i> ' : "",
		        hasImage: item.image != null ? '<i class="icon-picture"></i> ' : "",
		        commentCount: item.comment_count > 0 ? '(' + item.comment_count + ')' : ""
		        }));
		      },
		      resizeRow: function() {
				  	$("#article-list .article-item-wrapper").width(10).width($("#article-list .article-item").width());
				  }
		  }
		  $(window).bind("resize", self.resizeRow);
	    $("#btn-list-article").click(function() {
	      var loc = "!/" + models.Category.getCurrent();
	      var page = self.getCurrentPage();
	      page > 1 && (loc += '?page=' + page);
	      $.history.load(loc)
	    });
	
		  $(".btn-post-article").click(function() {
		  	if(!models.User.getMe()) {
		  		$("#nav .login-url").click();
		  		return;
		  	}
		  	$("#post-article-id").attr("disabled", "disabled");
		  	ArticleEditor.open();
		  })
	    $("#btn-edit-article").click(function() {
	    	var form = $("#post-article-form");
	    	$("#post-article-id").removeAttr("disabled").val(self.current.id);
	    	$("#post-article-title").val(self.current.title);
	    	$("#post-article-body").val(self.current.body);
	    	$("#post-article-tags").val($(self.current.tags).map(function(i, item) {
	    		return item.content[0];
	    	}).get().join(","));
	    	ArticleEditor.open();
	    });
	
		  $("#btn-like-article, #btn-hate-article, #btn-unlike-article, #btn-unhate-article").click(function() {
	      var action = $(this).attr("id").replace(/btn|-|article/g, '');
	      var type = action.replace("un", "");
	      var isUndo = action.match("un");
	      var callback = function() {
	        var countDiv = $("#article-list tr.active ." + type + "-count");
	        if(countDiv.length > 0) {
	          var count = parseInt(countDiv.text().match(/[0-9]+/)[0]) + (isUndo ? -1 : 1);
	          countDiv.text(count);
	          $("#article-item #article-item-" + type + "_count").text(count);
	        }
	        $("#article-btns .btn-reputation").hide();
	        var me = models.User.getMe();
	    		if(isUndo) {
	    		  var users = self.current[type + "d-users"];
	    		  var pos = -1;
	    		  $(users).each(function(i, item) {
	    		    if(item.id == me.id) {
	    		      pos = i;
	    		      return;
	    		    }
	    		  });
	    		  pos > -1 && (users = users.splice(pos, 1));
	    		  $("#btn-like-article, #btn-hate-article").show();
	    		} else {
	    		  self.current[type + "d-users"].unshift(me);
	    		  $("#btn-un" + action + "-article").show();
	    		}
	    		models.Reputation.renderUsers(type);
	        $().toastmessage("showSuccessToast", gettext(action + "d."));
	        
	        $("#loading").hide();
	      };
	      var id = models.Article.getCurrent().id;
	      $("#loading").show();
	      models.Reputation[action]('Article', id, callback);
	    });
	    $("#btn-post-article-submit").click(function() {
	    	$("#post-article-id").attr("disabled") ? self.post($("#post-article-form")) : self.put($("#post-article-form"));
	      return false;
	    });
	
	    $("#btn-delete-article").click(function() {
	      self.delete();
	      return false;
	    });
		  
		  $("#article-list tbody .article-title").live("click", function(event) {
		    $("#article-item #article-item-title").text($(this).attr("title"));
		    return true;
		  });
		  return self;
		})(),
		
		
		Comment: (function() {
			var self = {
					parentId: null,
					didClass: "btn-info",
					activeReplyClass: "btn-inverse",
					limit: 20,
					loadedCount: 0,
					defaultText: gettext("Please comment here..."),
					resetLoadedCount: function() {
						self.loadedCount = 0;
					},
					loadList: function() {
						$("#loading").show();
						var article = models.Article.getCurrent();
						$.getJSON("/service/comment/" + article.id, {offset: article.comment_count - self.limit - self.loadedCount}, function(data) {
							self.render(data.comment_list, -1);
							$("#loading").hide();
							$("#btn-comment-load").button("complete");
						});
					},
					render: function(data, position) {
						self.loadedCount += data.length;
						$("#comment-load-more").toggle(self.loadedCount < models.Article.getCurrent().comment_count);					
						var rendered = $($(data).map(function(i, item) {
							return self.decorateRow(item, false);
						}).get().join(""));
						switch(position) {
						case "last":
							rendered.hide().insertBefore("#comment-input").slideDown("slow");
							break;
						case "reply":
							rendered.insertAfter($("#comment-item-" + self.parentId).nextUntil(".comment-item-parent").last());
							break;
						default:
							rendered.hide().insertAfter("#comment-load-more").slideDown();
						}
					},
					renderBest: function(data) {
					  if(data.length == 0) {
					    $("#best-comments").empty().hide();
					    return;
					  }
					  $("#best-comments").html($(data).map(function(i, item) {
					    return self.decorateRow(item, true);
					  }).get().join("")).show();
					},
					decorateRow: function(item, isBest) {
						return formatString('<li id="comment-item-{{ id }}{{ bestSuffix }}" class="comment-item{{ bestClass }}{{ class }}">\
  							<span class="comment-avatar"><a href="/user/{{ author.id }}" class="user">{{ avatar }}</a></span>\
								<div class="comment-content">\
  								{{ buttons }}\
	  							<span><a href="/user/{{ author.id }}" class="user"><span class="nickname">{{ author.nickname }}</span></a></span>\
	  							<span>{{ body }}</span>\
	  							<div>\
	  								<time datetime="{{ created }}">{{ created|prettyDate }}</time>\
										{{ label }}\
	  							</div>\
	  						</div>\
							 </li>', $.extend(true, item, {
								 bestSuffix: isBest ? "-best" : "",
								 bestClass: isBest ? " comment-item-best" : "",
								 class: item.parent_id ? " comment-item-children" : " comment-item-parent",
								 avatar: models.User.getAvatar(item.author.email_hash, 32),
								 buttons: isBest ? "" : self._getButtons(item),
								 label: isBest ? ' <span class="label label-success">BEST</span>' : ""
							 }));
					},
					_getButtons: function(item) {
            var me = models.User.getMe();
            var isMine = me && me.email_hash == item.author.email_hash;  
					  return '<span class="comment-btns">' + 
                    (isMine ? '<button class="btn-comment-delete btn" data-comment-id="' + item.id + '" title="' + gettext('Delete') + '"><i class="icon-trash"></i></button>' : "")
                      + '\
                        <button class="btn-comment-like btn btn-reputation' + (item.liked ? " " + self.didClass : "") + '" data-comment-id="' + item.id + '" title="' + gettext('Like') + '"' + (!me || isMine || item.hated ? ' disabled="disabled"' : "") + '><i class="icon-heart"></i> <span class="like-count count">' + item.like_count + '</span></button>\
                        <button class="btn-comment-hate btn btn-reputation' + (item.hated ? " " + self.didClass : "") + '" data-comment-id="' + item.id + '" title="' + gettext('Hate') + '"' + (!me || isMine || item.liked ? ' disabled="disabled"' : "") + '><i class="icon-fire"></i> <span class="hate-count count">' + item.hate_count + '</span></button>\
                        ' + 
                    (item.parent_id || !me ? "" : ' <button class="btn-comment-reply btn" data-comment-id="' + item.id + '" title="' + gettext('Reply') + '"><i class="icon-comment"></i></button>') +
                  '</span>';
					},
					updateCount: function(amount) {
		        var countDiv = $("#article-list tr.active .comment-count");
		        if(countDiv.length > 0) {
		        	var m = countDiv.text().match(/[0-9]+/);
		          var count = (m ? parseInt(m[0]) : 0) + amount;
		          countDiv.text("(" + count + ")");
		          $("#article-item #article-item-comment_count").text(count);
		        }
					},
					post: function() {
						var val = $("#post-comment").val();
						if(!val) {
							return;
						}
						$("#loading").show();
						var url = "/service/comment/" + models.Article.getCurrent().id;
						self.parentId && (url += "/" + self.parentId);
						$.post(url, {body: val}, function(data) {
							self.render([data.comment], data.comment.parent_id ? "reply" : "last");
							self.updateCount(1);
							$().toastmessage("showSuccessToast", gettext("Posted."));
							self.restoreInput();
							$("#loading").hide();
						}, "json");
					},
					delete: function(id) {
		      	$("#loading").show();
			      $.ajax({
			        type: "DELETE",
			        url: "/service/comment/" + id,
			        cache: false,
			        success: function() {
			          $("#comment-item-" + id).remove();
			          self.updateCount(-1);
			          $("#loading").hide();
			          $().toastmessage("showSuccessToast", gettext("Deleted."));
			        },
			        dataType: "json"
			      });					
					},
					restoreInput: function() {
						$("#post-comment").val("");
						$("#comment-input").insertAfter($("#comments li:not([id=comment-input]):last"));
	      		$("#comments .btn-comment-reply." + self.activeReplyClass).removeClass(self.activeReplyClass).find("i").removeClass("icon-white");					
						self.parentId = null;
					}
			}
			CommentEditor.registerCallback(self.post);
			
			$("#btn-comment-load").click(function() {
				$(this).button("loading");
				self.loadList();
			});
			
			$("#comments .btn-comment-delete").live("click", function() {
				self.delete($(this).data("comment-id"));
			});
			
			$("#comments .btn-reputation").live("click", function() {
				var btn = $(this);
				if(btn.attr("disabled")) {
					return;
				}
	      var type = btn.attr("class").split(" ")[0].replace(/btn|-|comment/g, '');
	      var action = btn.hasClass(self.didClass) ? "un" + type : type; 
	      var callback = function() {
	      	var did = !btn.hasClass(self.didClass);
	      	if(did) {
	      		btn.addClass(self.didClass);
	      		btn.parent().find(".btn-reputation").attr("disabled", "disabled");
	      		btn.removeAttr("disabled");
	      	} else {
	      		btn.removeClass(self.didClass);
	      		btn.parent().find(".btn-reputation").removeAttr("disabled");
	      	}
	        $().toastmessage("showSuccessToast", gettext(action + "d."));
	        var countDiv = btn.find(".count");
	        countDiv.text(parseInt(countDiv.text()) + (did ? 1 : -1));
	        $("#loading").hide();
	      };
	      var id = btn.data("comment-id");
	      $("#loading").show();
	      models.Reputation[action]('Comment', id, callback);
			});
			
			$("#comments .btn-comment-reply").live("click", function() {
				if(!$(this).hasClass(self.activeReplyClass)) {
					self.parentId = $(this).data("comment-id");
					$("#comment-input").insertAfter("#comment-item-" + self.parentId);
					$("#post-comment").focus();
					$("#comments .btn-comment-reply." + self.activeReplyClass).removeClass(self.activeReplyClass).find("i").removeClass("icon-white");
					
					$(this).addClass(self.activeReplyClass).find("i").addClass("icon-white");
				} else {
					self.restoreInput();
					$(this).removeClass(self.activeReplyClass).find("i").removeClass("icon-white");
				}
			});
			return self;
		})(),
		
		User: (function() {
			var self = {
					me: null,
					_limit: 20,
					_loadedOffset: {article: 0, comment: 0, change: 0},
					loadMe: function() {
						$.getJSON("/service/user", function(data){
							if(data.user) {
								self.me = data.user;
							}
						});
					},
					getMe: function() {
						return self.me;
					},
			    getAvatar: function(hash, size, noTag) {
			    	
		    		var src = formatString("http://www.gravatar.com/avatar/{{ hash }}?d=mm{{ sizeParam }}",{
			      	sizeParam: size ? "&s=" + size : "",
					    hash: hash
					  });

			      return !noTag ? formatString('<img class="avatar" src="{{ src }}">', {src: src}) : src;
			    },
			    show: function(url) {
			      self.reset("article");
			      self.reset("comment");
			      self.reset("change");
			    	$.get(url, function(data) {
			    		$("#user-info-body").html(data);
			    		$("#user-info").modal();
			    		$("#user-profile").show();
			    		$("#loading").hide();
			    	}, "html");
			    },
			    reset: function(type) {
			      self._loadedOffset[type] = 0;
			      $("#user-" + type + "s li:not(.load-more)").remove();
			      $("#user-" + type + "s .load-more").show();
			    },
			    load: function(type, url, more) {
			      var params = null;
			      if(!more) {
			        if(self._loadedOffset[type] > 0 && self._loadedOffset[type] <= self._limit) {
			          return;
			        }
			        self.reset(type);
			      } else {
			        params = {offset: self._loadedOffset[type]};
			      }
			      $("#loading").show();
			    	$.getJSON(url, params, function(data) {
			    	  var list = data[type + "_list"];
			    	  var len = list.length;
			    	  len < self._limit && $("#user-" + type + "s .load-more").hide();
			    	  var html;
			    	  if(len == 0) {
			    	  	if(more) {
			    	  		$().toastmessage("showNoticeToast", gettext("No more."));
			    	  	} else {
			    	  		html = '<li class="no-record">' + gettext("No record.") + '</li>';
			    	  	}
			    	  } else {
			    	  	self._loadedOffset[type] += len;
			    	  	html = $(list).map(function(i, item) {
				    		  return self.renderRow(type, item);
				    		}).get().join("");
			    	  }
			    	  $(html).hide().insertBefore("#user-" + type + "s .load-more").slideDown();
			    	  $("#user-info .load-more button").button("complete");
			    		$("#loading").hide();
			    	});
			    },
			    renderRow: function(type, item) {
			      switch(type) {
			      case "article":
			        return formatString('<li>\
                <div>\
                  <h5><a href="/#!/{{ category }}/{{ id }}" class="title">{{ title }}</a></h5>\
                  <span class="comment-count">({{ comment_count }})</span>\
                  <span class="category">{{ category }}</span>\
                  <span class="posted"><time datetime="{{ created }}">{{ created|prettyDate }}</time></span>\
                </div>\
                <p class="excerpt"><a href="/#!/{{ category }}/{{ id }}" class="title">{{ excerpt }}</a></p>\
              </li>', item);
			      case "comment":
			        return formatString('<li>\
                <div>\
                  <h5><a href="/#!/{{ article.category }}/{{ article.id }}" class="title">{{ article.title }}</a></h5>\
                  <span class="category">{{ article.category }}</span>\
			        		{{ likeCount }}\
			        		{{ hateCount }}\
                  <span class="posted"><time datetime="{{ created }}">{{ created|prettyDate }}</time></span>\
                </div>\
                <p class="body">{{ body }}</p>\
              </li>', $.extend(true, item, {
              	likeCount: item.like_count > 0 ? '<span class="like-count"><i class="icon-heart"></i> ' + item.like_count + '</span>' : "",
              	hateCount: item.hate_count > 0 ? '<span class="hate-count"><i class="icon-fire"></i> ' + item.hate_count + '</span>' : ""
              }));
			      case "change":
			        return formatString('<li>\
			          <span class="nickname">{{ nickname }}</span>\
			          <span class="changed"><time datetime="{{ changed }}">{{ changed|prettyDate }}</time></span>\
			        </li>', item);
			      }
			    },
			    changed: function(user) {
			      $(".nickname:contains(" + self.me.nickname + ")").html(user.nickname);
			      self.me.nickname = user.nickname;
			      $("#change-user-nickname").val(user.nickname);			      
			    }
			};
			self.loadMe();
			$("#nav-user-info a").live("click", function() {
				$("#nav-user-info li").removeClass("active");
				$(this).parent().addClass("active");
				$("#user-info .user-info-tab").hide();
				$($(this).data("div")).show();
				var callback = $(this).data("callback");
				if(callback) {
				  self[callback]($(this).data("type"), $(this).attr("href"), false);
				}
				return false;
			});
			
			$("#user-info .load-more button").live("click", function() {
        var callback = $(this).data("callback");
        if(callback) {
          self[callback]($(this).data("type"), $(this).data("source"), true);
        }
        $(this).button("loading");
			});
			
			$("#user-articles .title, #user-comments .title").live("click", function() {
			  $("#user-info").modal("hide");
			  return true;
			});
			
			$("a.user").live("click", function() {
				self.show($(this).attr("href"));
				return false;
			});
			
			$("#change-user-dialog").live("shown", function() {
			  $("#change-user-nickname").focus();
			});
			$("#change-user-form").live("submit", function() {
        var json = {};
        $($(this).serializeArray()).each(function(i, item) {
          json[item.name] = item.value;
        });
        $("#loading").show();
        $.ajax({
          type: "PUT",
          url: "/user/me",
          data: JSON.stringify(json),
          cache: false,
          success: function(data) {
            self.changed(data.user);
            $("#loading").hide();
            $().toastmessage("showSuccessToast", gettext("Nickname has been changed."));
            $("#change-user-dialog").modal("hide");
          },
          dataType: "json"
        });
        return false;
			});
			$("#change-user-submit").live("click", function() {
			  $($(this).data("form")).submit();
			});
		  return self;
		})(),
		
		Subscription: {
		  subscribe: function(id) {
		    
		  },
		  unsubscribe: function(id) {
		    
		  }
		},
		
		Reputation: {
			types: ['like','hate'],
			like: function(objClass, id, callback) {
				$.post("/service/like/" + objClass + "/"+ id, callback);
			},
			hate: function(objClass, id, callback) {
				$.post("/service/hate/" + objClass + "/" + id, callback);
			},
			unlike: function(objClass, id, callback) {
	      $.ajax({
	        type: "DELETE",
	        url: "/service/like/" + objClass + "/" + id,
	        cache: false,
	        success: callback,
	        dataType: "json"
	      });	
			},
			unhate: function(objClass, id, callback) {
	      $.ajax({
	        type: "DELETE",
	        url: "/service/hate/" + objClass + "/" + id,
	        cache: false,
	        success: callback,
	        dataType: "json"
	      });	
			},
			renderUsers: function(type) {
			  var article = models.Article.getCurrent();
			  var users = article[type + "d-users"];
			  if(!users) {
			  	return;
			  }
			  var count = users.length;
			  var wrapperDiv = $("#" + type + "s-wrapper");
			  if(count == 0) {
			    wrapperDiv.hide();
			    return;
			  }
			  wrapperDiv.show();
	      var rendered = $(users).map(function(i, item) {
	        return '<a href="/user/' + item.id + '" class="user">' + models.User.getAvatar(item.email_hash, 16) + '<span class="nickname">' + item.nickname + "</span></a> ";
	      });
	      var output = rendered.get().join(", ");
	      
	      var totalCount = article[type + "_count"];
	      if(count < totalCount) {
	        var diff = totalCount - count;
	        var context = {
	        		link: formatString("/service/{{ type }}/{{ id }}", {type: type, id: article.id})
	        }
	        output += interpolate(ngettext(formatString(' and <a href="{{ link }}" class="more-users" rel="tooltip">%s more</a> ', context), formatString(' and <a href="{{ link }}" class="more-users" rel="tooltip">%s others</a> ', context), diff), [diff]);
	      }
	      output += ngettext(type + "s this.", type + " this.", count);
	      $("#" + type + "s").html(output);
	      $("#" + type + "s-wrapper a[rel=tooltip]").tooltip({
	      	title: function() {
	      		var url = $(this).attr("href");
	      		var data = $(this).data("others");
	      		if(!data) {
	      			data = JSON.parse($.ajax({
		      			type: "GET",
		      			url: url,
		      			data: {offset: 5},
		      			async: false,
		      			dataType: "json"
		      		}).responseText).list;
	      			$(this).data("others", data);
	      		}
	      		
	      		return $(data).map(function(i, item) {
	      			return item.nickname;
	      		}).get().join(", ");
	      	}
	      });
			}
		}
	});
}