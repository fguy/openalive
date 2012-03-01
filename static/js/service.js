$.ajaxSetup({
	error:function(jqXHR, textStatus, errorThrown) {
		var errorMessage = $.trim($(jqXHR.responseText).text());
		$().toastmessage("showErrorToast", gettext(errorMessage.substring(errorMessage.lastIndexOf("\n"))));
		$("#loading").hide();
	}
});
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
		            return '<li' + (i == lastPos ? ' class="active"' : "") + '><a href="#!/' + item + '">' + gettext(item) + '</a> ' + (i != lastPos ? '<span class="divider">/</span>' : '') + '</li>'; 
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
		    	return '<li' + (isActive ? ' class="active"' : "") + '>\
		    	          <a href="#!/' + item.name + '" title="' + item.name + '" class="category-link' + (isChild ? ' children' : "") + '">'
	  	    	          + (isChild ? '<i class="icon-chevron-right"></i> ' : "") 
	  	    	          + (me ? '<i class="icon-star icon-star-empty" title="' + gettext("Star") + '"></i>' : "") + '\
	  	    	          <span class="category-title">' + gettext(item.name) + '</span> \
	  	    	          <span class="article-count">(' + item.article_count + ')</span>\
		    	          </a>\
	  	    	      </li>';
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
		      return '<span class="label label-success"><a href="#!/' + name + '" title="' + name + '" class="category-link"><i class="icon-star icon-white" title="' + gettext("Unstar") + '"></i> <span class="category-title">' + gettext(name) + '</span></a></span> ';
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
		      		callback && callback(data);
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
		      	$("#article-list tbody .active").removeClass("active");
		      	$("#article-list tbody tr:has(a[href*='/" + id + "'])").addClass("active");
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
		      		models.Comment.render(data.comment_list);
		      	});
		      },
		      render: function() {
	      		$.each(self.current, function(k, v) {
	      			$("#article-item-" + k).html(v);
	      		});
	      		$.each(models.Reputation.types, function(i, item) {
	      		  models.Reputation.renderUsers(item);
	      		});
		      },
		      hideList: function() {
		        $("#article-list, #article-pagination, #article-list caption").hide();
		      },
		      showList: function() {
		        $("#no-article").hide();
		        $("#article-list, #article-pagination, #article-list caption:not(:empty)").show();
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
			          self.render();
			      	  $("#loading").hide();
			      	  $().toastmessage("showSuccessToast", gettext("Updated."));
			      	  ArticleEditor.close();
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
		        return '<tr>\
		          <td>' + item.category + '</td>\
		          <td><a href="#!/' + currentCategory + '/' + item.id + '?page=' + page + '" class="article-item" title="' + item.title + '">' + item.title + '</a>' + (item.comment_count > 0 ? ' <span class="comment-count">(' + item.comment_count + ')</span>' : "") + '</td>\
		          <td><a href="/user/' + item.author.id + '" class="user">' + models.User.getAvatar(item.author.email_hash, 16) +  item.author.nickname + '</td>\
		          <td><span class="like-count count">' + item.like_count + '</span></td>\
		          <td><time datetime="">' + prettyDate(item.created) + '</time></td>\
		        </tr>';
		      }
		  }
	    $("#btn-list-article").click(function() {
	      var loc = "!/" + models.Category.getCurrent();
	      var page = self.getCurrentPage();
	      page > 1 && (loc += '?page=' + page);
	      $.history.load(loc)
	    });
	
		  $(".btn-post-article").click(function() {
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
		  
		  $("#article-list tbody .article-item").live("click", function(event) {
		    $("#article-item #article-item-title").text($(this).attr("title"));
		    return true;
		  });
		  return self;
		})(),
		
		
		Comment: (function() {
			var self = {
					parentId: null,
					didClass: "btn-info",
					activeReplyClass: "btn-danger",
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
						});
					},
					render: function(data, position) {
						self.loadedCount += data.length;
						$("#comment-load-more").toggle(self.loadedCount < models.Article.getCurrent().comment_count);					
						var rendered = $($(data).map(function(i, item) {
							return self.decorateRow(item);
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
					decorateRow: function(item) {
						var me = models.User.getMe();
						var isMine = me && me.email_hash == item.author.email_hash;
						return '<li id="comment-item-' + item.id + '" class="comment-item ' + (item.parent_id ? "comment-item-children" : "comment-item-parent") + '">\
							<span><a href="/user/' + item.author.id + '" class="user">' + models.User.getAvatar(item.author.email_hash, 32) + '</a></span>\
							<span><a href="/user/' + item.author.id + '" class="user">' + item.author.nickname + '</a></span>\
							<span>' + item.body + '</span>\
							<time datetime="">' + prettyDate(item.created) + '</time>\
							<span class="comment-btns">\
								' + 
								(isMine ? '<button class="btn-comment-delete btn" data-comment-id="' + item.id + '" title="' + gettext('Delete') + '"><i class="icon-trash"></i></button>' : "")
									+ '\
										<button class="btn-comment-like btn btn-reputation' + (item.liked ? " " + self.didClass : "") + '" data-comment-id="' + item.id + '" title="' + gettext('Like') + '"' + (!me || isMine || item.hated ? ' disabled="disabled"' : "") + '><i class="icon-heart"></i> <span class="like-count count">' + item.like_count + '</span></button>\
										<button class="btn-comment-hate btn btn-reputation' + (item.hated ? " " + self.didClass : "") + '" data-comment-id="' + item.id + '" title="' + gettext('Hate') + '"' + (!me || isMine || item.liked ? ' disabled="disabled"' : "") + '><i class="icon-fire"></i> <span class="hate-count count">' + item.hate_count + '</span></button>\
										' + 
								(item.parent_id || !me ? "" : ' <button class="btn-comment-reply btn" data-comment-id="' + item.id + '" title="' + gettext('Reply') + '"><i class="icon-plus"></i> ' + gettext('Reply') + '</button>') +
							'</span>\
							</li>';
					},
					updateCount: function(amount) {
		        var countDiv = $("#article-list tr.active .comment-count");
		        if(countDiv.length > 0) {
		          var count = parseInt(countDiv.text().match(/[0-9]+/)[0]) + amount;
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
				} else {
					self.restoreInput();
				}
				$(this).toggleClass(self.activeReplyClass);
				$(this).find("i").toggleClass("icon-white");
			});
			return self;
		})(),
		
		User: (function() {
			var self = {
					me: null,
					_limit: 20,
					_loadedOffset: {article: 0, comment: 0},
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
			    getAvatar: function(hash, size) {
			      return '<img class="avatar ' + (size ? "avatar-" + size : "") + '" src=http://www.gravatar.com/avatar/' + hash + '?d=mm' + (size ? "&s=" + size : "") + '>';
			    },
			    show: function(url) {
			      self.reset("article");
			      self.reset("comment");
			    	$.get(url, function(data) {
			    		$("#user-info-body").html(data);
			    		$("#user-info").modal();
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
			        if(self._loadedOffset[type] != 0 && self._loadedOffset[type] <= self._limit) {
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
			    	  len == 0 && more && $().toastmessage("showNoticeToast", gettext("No more."));
			    	  self._loadedOffset[type] += len;
			    		$($(list).map(function(i, item) {
			    		  return self.renderRow(type, item);
			    		}).get().join("")).hide().insertBefore("#user-" + type + "s .load-more").slideDown();
			    		$("#loading").hide();
			    	});
			    },
			    renderRow: function(type, item) {
			      switch(type) {
			      case "article":
			        return '<li>\
                <div>\
                  <h5><a href="/#!/' + item.category + '/' + item.id + '" class="title">'+ item.title + '</a></h5>\
                  <span class="comment-count">(' + item.comment_count + ')</span>\
                  <span class="category">' + item.category + '</span>\
                  <span class="posted"><time datetime="">' + prettyDate(item.created) + '</time></span>\
                </div>\
                <p class="excerpt"><a href="/#!/' + item.category + '/' + item.id + '" class="title">' + item.excerpt + '</a></p>\
              </li>';
			      case "comment":
			        return '<li>\
                <div>\
                  <h5><a href="/#!/' + item.article.category + '/' + item.article.id + '" class="title">'+ item.article.title + '</a></h5>\
                  <span class="category">' + item.article.category + '</span>' + 
                  (item.like_count > 0 ? '<span class="like-count"><i class="icon-heart"></i> ' + item.like_count + '</span>' : "") +
                  (item.hate_count > 0 ? '<span class="hate-count"><i class="icon-fire"></i> ' + item.hate_count + '</span>' : "") +
                  '<span class="posted"><time datetime="">' + prettyDate(item.created) + '</time></span>\
                </div>\
                <p class="body">' + item.body + '</p>\
              </li>';
			      }
			    }
			};
			self.loadMe();
			$("#nav-user-info a").live("click", function(event) {
				$("#nav-user-info li").removeClass("active");
				$(this).parent().addClass("active");
				$("#user-info .user-info-tab").hide();
				$($(this).data("div")).show();
				var callback = $(this).data("callback");
				if(callback) {
				  self[callback]($(this).data("type"), $(this).attr("href"));
				}
				return false;
			});
			
			$("#user-articles .load-more button, #user-comments .load-more button").live("click", function() {
        var callback = $(this).data("callback");
        if(callback) {
          self[callback]($(this).data("type"), $(this).data("source"), true);
        }
			});
			
			$("#user-articles .title, #user-comments .title").live("click", function() {
			  $("#user-info").modal("hide");
			  return true;
			});
			
			$(".user").live("click", function(event) {
				self.show($(this).attr("href"));
				return false;
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
			  var count = users.length;
			  var wrapperDiv = $("#" + type + "s-wrapper");
			  if(count == 0) {
			    wrapperDiv.hide();
			    return;
			  }
			  wrapperDiv.show();
	      var rendered = $(users).map(function(i, item) {
	        return '<a href="/user/' + item.id + '" class="user">' + models.User.getAvatar(item.email_hash, 16) + " <bdi>" + item.nickname + "</bdi></a> ";
	      });
	      var output = rendered.get().join(",");
	      
	      var totalCount = article[type + "_count"];
	      if(count < totalCount) {
	        var link = "/users/" + type + "d/" + article.id;
	        var diff = totalCount - count;
	        output += interpolate(ngettext(' and <a href="' + link + '" class="more-users">%s</a> more ', ' and <a href="' + link + '" class="more-users">%s</a> others ', diff), [diff]);
	      }
	      output += ngettext(type + "s this article.", type + " this article.", count);
	      $("#" + type + "s").html(output);
			}
		}
	});
}