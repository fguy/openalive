$.ajaxSetup({
	error:function(jqXHR, textStatus, errorThrown) {
		var errorMessage = jqXHR.responseText;
		var m = errorMessage.match(/^(\d{3}) (.*)/);
		if(m) {
			var code = parseInt(m[1]);
			var message = m[2];
			switch(code) {
			case 412: //catcha failed
				$("#captcha-error").show();
				Recaptcha.reload();
			default:
				$().toastmessage("showErrorToast", message);
			}
 		} else {
 			$().toastmessage("showErrorToast", errorMessage ? errorMessage : gettext("An error occurred."));
 		}

		$("#loading").hide();
	}
});

var service;
var initializeModels = function() {
  var RSS_BURNER_MAP = {
      "http://openalive.appspot.com/feed/category/%ED%86%A0%EB%A1%A0?limit=5&output=rss": "http://feeds.feedburner.com/appspot/wKwe",
      "http://openalive.appspot.com/feed/category/%EC%A0%95%EB%B3%B4?limit=5&output=rss": "http://feeds.feedburner.com/appspot/TQcZ",
      "http://openalive.appspot.com/feed/category/%EC%9D%B4%EC%95%BC%EA%B8%B0?limit=5&output=rss": "http://feeds.feedburner.com/appspot/iVmL",
      "http://op.enalive.com/feed/category/%ED%86%A0%EB%A1%A0?limit=5&output=rss": "http://feeds.feedburner.com/appspot/wKwe",
      "http://op.enalive.com/feed/category/%EC%A0%95%EB%B3%B4?limit=5&output=rss": "http://feeds.feedburner.com/appspot/TQcZ",
      "http://op.enalive.com/feed/category/%EC%9D%B4%EC%95%BC%EA%B8%B0?limit=5&output=rss": "http://feeds.feedburner.com/appspot/iVmL"              
  }
	var getRss = function(uri, callback) {
	  $("#loading").show();
		if(location.host.indexOf('localhost') > -1 || location.host.indexOf("dev.") > -1) {
			$.ajax({
				url: uri,
				data: {output: "rss_json_xml", limit: 5},
				dataType: "json",
				success: function(data) {
					callback(data);
					$("#loading").hide();
				}
			});		
		} else {
		  var url = location.protocol + "//" + location.host + uri + "?limit=5&output=rss";
		  RSS_BURNER_MAP[url] && (url = RSS_BURNER_MAP[url]);
			$.ajax({
				url: 'https://ajax.googleapis.com/ajax/services/feed/load?v=1.0&output=json_xml&callback=?&q=' + encodeURIComponent(url),
				crossDomain: true,
				dataType: "jsonp",
				success: function(data) {
					callback(data);
					$("#loading").hide();
				}
			});
		}
	}
	
	service || (service = {
		name: gettext("Open Alive"),
		Category: (function() {
		  var self = {
		    current: null,
		    starred: [],
		    select: function(name, callback) {
		    	$("#nav li.active").removeClass("active");
		    	$("#nav li:has(a.home-link)").addClass("active");
		    	$("#content, #category-explorer-wrapper, #loading, .btn-post-article").show();
		    	name && $("#home-content").hide();
		      if(self.getCurrent() == name) {
		        service.Article.loadList('category', name, callback);
		        return;
		      }
		      self.current = name;
		      service.Article.hideList();
		      $.getJSON("/service/category/" + encodeURI(name), function(data) {
		        $("#container .breadcrumb li:gt(0)").remove();
		        $("#container .breadcrumb li:eq(0) .divider").toggle(data.current_category != null);
		        $("#category-explorer .nav").html($(data.category_list).map(function(i, item) {
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
		          data.current_category.description ? $("#article-list caption").html(data.current_category.description).show() : $("#article-list caption").empty().hide();
		          $(".btn-post-article").show();
		          service.Article.loadList("category", data.current_category.name, callback);
		        } else {
		        	document.title = service.name;
		        	$("#article-list caption").empty();
		        	$("#loading, #no-article, .btn-post-article").hide();
		        	service.Article.hide();
		        }
		      });
		    },
		    decorateItem: function(item, isActive, isChild) {
		      var me = service.User.getMe();
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
		      return self.current;
		    },
		    getCurrentPath: function() {
		      return $.trim($("#container .breadcrumb").text().replace(/\//g, " / "))
		    },
		    loadStarred: function() {
		      $("#loading").show();
		      $.getJSON("/service/starred-category", function(data) {
		        self.renderStarred(data.starred_category_list);
		        $("#starred-wrapper").toggle($("#category-explorer-wrapper").is(":visible") && data.starred_category_list.length > 0);
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
		      var place = $("#category-explorer .category-link[title='" + name + "'] .icon-star");
		      if(place.length > 0) {
		        empty ? place.addClass("icon-star-empty") : place.removeClass("icon-star-empty");
		      }
		    },
		    star: function(name) {
		      self.markStarred(name);
		      $("#loading").show();
		      $.post("/service/starred-category/" + encodeURI(name), function() {
		        $("#starred").append(self.decorateStarredItem(name));
		        self.starred.push(name);
		        $("#starred-wrapper").toggle(self.starred.length > 0);
		        $("#loading").hide();
		      }, "json");
		    },
		    unstar: function(name) {
		      self.markStarred(name, true);
		      $("#loading").show();
		      $.ajax({
		        type: "DELETE",
		        url: "/service/starred-category/" + encodeURI(name),
		        cache: false,
		        success: function() {
		          $("#starred span:has(.category-link[title='" + name + "'])").remove();
		          var needle = $.inArray(name, self.starred);
		          needle != -1 && self.starred.splice(needle, 1);
		          $("#starred-wrapper").toggle(self.starred.length > 0);
		          $("#loading").hide();
		        },
		        dataType: "json"
		      });
		    },
		    showTopFeeds: function() {
		    	$("#content").hide();
		      var div = $("#recent").empty().show();
		      var template = '\
		        <div class="recent-item span3">\
		          <h3><a href="{{ link }}">{{ title }}</a></h3>\
		          <ul class="unstyled"></ul>\
		        </div>\
		        ';
		      var rowTemplate = '<li>\
  		        <a href="/#!/{{ categories.0 }}"><span class="label label-info">{{ categories.0 }}</span></a> \
  		        <a href="{{ link }}"><h4>{{ title }}</h4></a>\
		          <time datetime="{{ pubDate }}">{{ pubDate|prettyDate }}</time>\
		          <p><a href="{{ link }}">{{ thumbnail }}{{ contentSnippet }}</a></p>\
		        </li>';
		      
		      $("#loading").show();
		    	$.getJSON("/category/top", function(data) {
		    	  var categoryList = data.list.concat(self.starred);
		    		var remaining = categoryList.length;
		    		remaining === 0 && $("#loading").hide();
		    		$(categoryList).each(function(i, item) {
		    			getRss("/feed/category/" + encodeURI(item), function(data) {
		    				remaining--;
		    				remaining === 0 && $("#loading").hide();
		    				if(data.responseStatus != 200) {
		    					return;
		    				}
		    				var feed = data.responseData.feed;
		    				if(feed.entries.length > 0) {
  		    				var xml = $.parseXML(data.responseData.xmlString);
  		    				var panel = $(formatString(template, feed));
  		    				$("ul", panel).html($(feed.entries).map(function(i, item) {
  		    				  var enclosure = $(formatString("item:has(link:contains({{ link }})) enclosure", item), xml); // enclosure doesn't supported by google feed api.
  		    				  var thumbnail;
  		    				  if(enclosure.length > 0) {
    		    				  var typeString = enclosure.attr("type").toLowerCase();
    		              if(typeString.indexOf("image") == 0) {
    		                thumbnail = getImageShackThumbnail(enclosure.attr("url"));
    		              } else if(typeString.indexOf("video") == 0) {
    		                thumbnail = formatString("http://img.youtube.com/vi/{{ videoId }}/1.jpg", {videoId: getYoutubeVideoId(enclosure.attr("url"))});
    		              }
  		    				  }
  		    				  return formatString(rowTemplate, $.extend(item, {
  		    				  	title: item.title.length > 20 ? (item.title.substring(0, 20) + "...") : item.title,
  		    				    thumbnail: thumbnail ? formatString('<img src="{{ thumbnail }}" onerror="this.style.display=\'none\'">', {thumbnail: thumbnail}) : "",
  		    				    pubDate: ISODateString(new Date(Date.parse(item.publishedDate)))
  		    				  }));
  		    				}).get().join(""));
  		    				div.append(panel);
		    				}
		    			});
		    		});
		    	});
		    }
		  }
		  self.loadStarred();
	    $("#category-explorer .nav .icon-star, #starred .icon-star").live("click", function() {
	      $(this).hasClass("icon-star-empty") ? service.Category.star($(this).parent().attr("title")) : service.Category.unstar($(this).parent().attr("title"));
	      return false;
	    });
	
		  $("#category-explorer .nav > li > a").live("click", function() {
		    if(!$(this).hasClass("children")) {
		      $("#container .breadcrumb .active").text($(this).attr("title"));
		      $("#category-explorer .nav .active").removeClass("active");
		      $(this).parent().addClass("active");    
		    }
		    return true;
		  });	  
		  return self;
		})(),
		
		Article: (function() {
		  var Meta = {
		      types: [{
		          fields: ["title", "description"],
		          selector: "head meta[name='{{ field }}']",
		          contentField: "content",
		          template: '<meta name="{{ field }}" content="{{ content }}">'
		        },{
		          fields: ["title", "type", "url", "image", "video", "site_name", "description"],
		          selector: "head meta[property='og:{{ field }}']",
		          contentField: "content",
		          template: '<meta property="og:{{ field }}" content="{{ content }}">'
		        },{
		          fields: ["image", "video"],
		          selector: "head link[rel='{{ field }}_src']",
		          contentField: "href",
		          template: '<link rel="{{ field }}_src" href="{{ content }}">'
		        }
		      ],
		      add: function(data) {
		        Meta.clear();
		        $('<meta property="og:type" content="openalive:article">').appendTo("head");
		        $.each(data, function(key, val) {
		          var html = [];
		          $(Meta.types).each(function(i, type) {
		            if($.inArray(key, type.fields) > -1) {
		              var needle = $(formatString(type.selector, {field: key}));
		              if(needle.length > 0) {
		                needle.attr(type.contentField, val);
		              } else {
		                html.push(formatString(type.template, {field: key, content: val}));
		              }
		              if(key == "video" && $("head meta[name='video_type']").length == 0) {
		                $('<meta name="video_type" content="application/x-shockwave-flash">').appendTo("head");
		              }
		            }
		          });
		          html.length > 0 && $(html.join("")).appendTo("head");
		        });
		      },
		      clear: function() {
		        var selector = ["head meta[property='og:type']", "head meta[name='video_type']"];
		        $(Meta.types).each(function(i, type) {
		          $(type.fields).each(function(j, field) {
		           selector.push(formatString(type.selector, {field: field}));
		          });
		        });
		        selector.length > 0 && $(selector.join(",")).remove();
		      }
		  }
		  
		  var self = {
		  		current: null,
		  		currentType: {name:"", model:null, sign:""},
		      loadList: function(type, name, callback) {	      	
		        $("#loading, #article-btns").show();
		      	var page = self.getCurrentPage();
		      	page || (page = 1);
		      	if(self.currentType.name == type && $("#article-list").data(type) == name && $("#article-list").data("page") == page) {
		      	  self.showList();
		      		callback && callback();
		      		$("#no-article, #loading").hide();
		      		return;
		      	}
		      	
	          $("head link[rel=alternate][type='application/rss+xml']").remove();
	          $(formatString('<link rel="alternate" type="application/rss+xml" title="{{ name }} RSS" href="/feed/{{ type }}/{{ name|encodeURI }}?output=rss">', {
	          	type: type,
	          	name: name
	          })).appendTo("head");
		      	
	          self.currentType.name = type;
	          self.currentType.model = service[type.charAt(0).toUpperCase() + type.slice(1)];
	          self.currentType.sign = type == "category" ? "!" : type; 
	           
		      	var currentTypeValue = self.currentType.model.getCurrent();
		      	document.title = currentTypeValue;
		      	self.hide();
		      	callback && callback();
		      	$.getJSON(formatString("/{{ type }}/article-list/{{ name|encodeURI }}", {type: type, name: name}), {page: page}, function(data) {
		      	  if(!data.list || data.list.length == 0) { // no article in this category.
		      	    $("#no-article").show().find(".current-name").text(currentTypeValue);
		      	    $("#loading").hide();
		      	    self.hideList();
		      	    return;
		      	  }
		      	  $("#no-article").hide();
		      		$("#article-list tbody").html($(data.list).map(function(i, item) {
		      			return self.decorateRow(currentTypeValue, page, item);
		      		}).get().join(""));
		      		$("#article-list").data(type, name).data("page", page);
		      		self.showList();
		      		self.highlightActiveRow();
		      		$("#article-pagination").pagination(data.count, {
		            items_per_page : 20,
		            current_page : page - 1, // zero base
		            callback : function(pageSelected) {
		              if (pageSelected > -1) {
		              	$.history.load(formatString("{{ type }}/{{ name }}?page={{ page }}", {
		              		type: self.currentType.sign,
		              	  name: name,
		              	  page: pageSelected + 1
		              	}));
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
		      highlightActiveRow: function(id) {
		      	id || self.current && (id = self.current.id);
		      	id || HASH_TOKENS && (id = HASH_TOKENS[1]);
		      	if(id) {
  		      	$("#article-list tr.active").removeClass("active");
  		      	$(formatString("#article-list tr:has(a[href*='/{{ id }}?'])", {id: id})).addClass("active");
		      	}
		      },
		      show: function(id) {
		      	self.highlightActiveRow(id);
		      	$("#article-item-body").html('<div class="loading"><i class="icon-clock">' + gettext("Loading...") + "</div>");
		      	$("#loading").show();
		      	$("#article-reputation, #article-item-tags").hide();
		      	$.getJSON("/service/article/" + id, function(data) {
		      		if(!data.article) {
		      			bootbox.alert(gettext("Not found. It may have been deleted."));
		      			$.history.load(location.hash.substring(1, location.hash.lastIndexOf("/")));
		      			return;
		      		}
		      		self.current = data.article;
		      		self.current.titleDecoded =  $("<div/>").html(data.article.title).text();
		      		self.current.tags = data.tags;
		      		self.current["liked-users"] = data["liked-users"];
		      		self.current["hated-users"] = data["hated-users"];
		      		self.current["subscribed-users"] = data["subscribed-users"];
		      		
		      		document.title = self.current.titleDecoded + " - " + data.article.category.name;
		      		self.render();
		      		$("#article-btns .btn-read").show();
		      		$("#article-btns .btn-reputation, #article-btns .btn-subscribe").hide();
		      		var me = service.User.getMe();
		      		if(!me || data.article.author.email_hash != me.email_hash) { // don't show for mine
			      		var reputationFound = false;
			      		$(service.Reputation.types).each(function(i, item) {
			      			if(data[item + "d"]) {
			      				reputationFound = true;
			      				$("#btn-un" + item + "-article").show();
			      				return;
			      			}
			      		});
			      		reputationFound || $("#btn-like-article, #btn-hate-article").show();
			      		$("#article-btns .btn-edit").hide();
			      		data.subscribed ? $("#btn-unsubscribe-article").show() :  $("#btn-subscribe-article").show();
		      		} else {
		      			$("#article-btns .btn-edit").show();
		      		}
		      		
		      		$("#article-item, #article-reputation").show();
		      		$.scrollTo($("#article-item").position().top - 40, 100);
		      		$("#loading, #article-list caption").hide();
		      		$("#comments li:not(#comment-input):not(:first)").remove();
		      		service.Comment.resetLoadedCount();
		      		service.Comment.renderBest(data.best_comment_list);
		      		service.Comment.render(data.comment_list);
		      	});
		      },
		      render: function() {
		      	$("#article-item-title").html(self.current.title);
		      	$("#article-item-body").html(self.current.body);
		      	$("#article-item-author-avatar").html(formatString('<a href="/user/{{ authorId }}" class="user">{{ thumbnail }}</a>', {
		      		authorId: self.current.author.id,
		      		original: service.User.getAvatar(self.current.author.email_hash, null, true),
		      		thumbnail: service.User.getAvatar(self.current.author.email_hash, 100)
		      	}));
		      	$("#article-item-author-nickname").html(formatString('<a href="/user/{{ author.id }}" class="user" rel="author"><span class="nickname">{{ author.nickname }}</span></a>', self.current));
		      	$("#article-item-author-joined").text(prettyDate(self.current.author.joined));
		      	$("#article-item-created time").attr("datetime", self.current.created).text(prettyDate(self.current.created));
		      	if(self.current.created != self.current.last_updated) {
		      		$("#article-item-last-updated").show().find("time").attr("datetime", self.current.last_updated).text(prettyDate(self.current.last_updated));
		      	} else {
		      		$("#article-item-last-updated").hide();
		      	}
	      		$("#article-item-tags").html($(self.current.tags).map(function(i, item) {
	      			return formatString('<li><i class="icon-tag"></i> <a href="/#tag/{{ primaryTag }}" class="tag-item" rel="tooltip" title="{{ tag }}">{{ primaryTag }}</a></li>', {
	      			  primaryTag: item.content[0],
	      			  tag: item.content.join(",")
	      			});
	      		}).get().join("")).show();
	      		
	      		var staticUrl = formatString("{{ protocol }}//{{ host }}/{{ id }}", {
              protocol: location.protocol,
              host: location.host,
              id: self.current.id,
              page: self.getCurrentPage()
            });
            
	      		var meta = {
	              title: self.current.title,
	              description: self.current.excerpt,
	              url: staticUrl
	      		}
	      		if(self.current.video) {
	      		  self.current.image || (meta.image = formatString("http://img.youtube.com/vi/{{ video|videoId }}/0.jpg", self.current));
	      		  meta.video = self.current.video;
	      		}
	      		self.current.image && (meta.image = self.current.image);
	      		Meta.add(meta);

	      		$("#fb-like").html(formatString('<fb:like send="true" href="{{ staticUrl }}" layout="button_count" show_faces="false"></fb:like>', {staticUrl: staticUrl}));
	      		typeof FB != "undefined" && FB.XFBML.parse();

	      		$("#g-plusone").html(formatString('<div class="g-plusone" data-size="medium" data-href="{{ staticUrl }}"></div>', {staticUrl: staticUrl}));
	      		typeof gapi != "undefined" && gapi.plusone.go();
	      		
	      		$("#twttr-share").html(formatString('<a href="https://twitter.com/share" class="twitter-share-button" data-text="{{ excerpt }}" data-url="{{ url }}" data-via="openalive">Tweet</a>', {
	      		  excerpt: self.current.excerpt.replace(/\s+/g," ").replace(/"/g,"&quot;").substring(0, 120),
	      		  url: location.href
	      		}));
	      		typeof twttr != "undefined" && twttr.widgets && twttr.widgets.load();
	      		
	      		$(service.Reputation.types).each(function(i, item) {
	      		  service.Reputation.renderUsers(item);
	      		});
		      },
		      hideList: function() {
		        $("#article-list, #article-pagination-container, #article-list caption").hide();
		      },
		      showList: function() {
		        $("#no-article").hide();
		        $("#article-list, #article-pagination-container, #article-list caption:not(:empty)").show();
		        self.resizeRow();
		      },
		      hide: function() {
		      	self.current = null;
		      	Meta.clear();
		      	$("#article-list tbody .active").removeClass("active");
		      	$("#article-item, #article-reputation, .btn-read").hide();
		      },
		      getFormAsJson: function(form) {
		      	var json = {};
		      	$(form.serializeArray()).each(function(i, item) {
		      		json[item.name] = item.name == "body" && ArticleEditor.isMobile ? item.value.replace(/([^>\r\n]?)(\r\n|\n\r|\r|\n)/g, '$1<br>$2') : item.value;
		      	});
		      	return json;
		      },
		      post: function(form) {
		        var currentCategory = service.Category.getCurrent();
		        $("#loading").show();
		        $.post("/service/article/" + encodeURI(currentCategory), self.getFormAsJson(form), function(data) {
		          if(self.getCurrentPage() != 1) {
		            $.history.load("!/" + currentCategory + "/?page=1");
		          }
		          $(data.article.category.path).each(function(i, item) {
		            var countDiv = $("#category-explorer .category-link[title=" + item + "] .article-count");
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
		      	$("#loading").show();
			      $.ajax({
			        type: "PUT",
			        url: "/service/article",
			        data: encodeURIComponent(JSON.stringify(self.getFormAsJson(form))),
			        cache: false,
			        success: function(data) {
			          self.current = data.article;
			          self.current.tags = data.tags;
			          self.current.titleDecoded =  $("<div/>").html(data.article.title).text();
			          self.render();
			          var activeRow = $("#article-list tbody tr.active");
			          activeRow.find(".article-excerpt").text(data.article.excerpt);
			          var title = activeRow.find(".article-title");
			          title.attr("title", self.current.titleDecoded);
			          title.text(self.current.titleDecoded);
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
			        	$.history.load(formatString("{{ sign }}/{{ value }}", {
			        		sign: self.currentType.sign,
			        		value: self.currentType.model.getCurrent()
			        	}));
			          $("#loading").hide();
		            $(self.current.category.path).each(function(i, item) {
		              var countDiv = $("#category-explorer .category-link[title=" + item + "] .article-count");
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
			          	<a href="#{{ type }}/{{ currentTypeValue }}/{{ id }}?page={{ page }}" class="article-title" title="{{ title }}">{{ title }}</a> {{ hasImage }}{{ hasVideo }}\
			          	<span class="comment-count">{{ commentCount }}</span>\
			          	<span class="article-excerpt">{{ excerpt }}</span>\
			          </div>\
		          </td>\
		          <td class="article-user"><a href="/user/{{ author.id }}" class="user" rel="author">{{ avatar }}<span class="nickname">{{ author.nickname }}</span></a></td>\
		          <td class="article-likes"><span class="like-count count">{{ like_count }}</span></td>\
		          <td class="article-date"><time datetime="{{ created }}">{{ created|prettyDate }}</time></td>\
		        </tr>', $.extend(true, item, {
		        type: self.currentType.sign,
		        currentTypeValue: self.currentType.model.getCurrent(),
		        page: page,
		        avatar: service.User.getAvatar(item.author.email_hash, 16),
		        hasVideo: item.video != null ? '<i class="icon-film"></i> ' : "",
		        hasImage: item.image != null ? '<i class="icon-picture"></i> ' : "",
		        commentCount: item.comment_count > 0 ? formatString(service.Comment.COUNT_TEMPLATE, {count: item.comment_count})  : ""
		        }));
		      },
		      resizeRow: function() {
				  	$("#article-list .article-item-wrapper").width(10).width($("#article-list .article-item").width());
				  }
		  }
		  $(window).bind("resize", self.resizeRow);
	    $("#btn-list-article").click(function() {
	      var loc = formatString("{{ type }}/{{ value|encodeURI }}", {type: self.currentType.sign, value: self.currentType.model.getCurrent()});
	      var page = self.getCurrentPage();
	      page > 1 && (loc += '?page=' + page);
	      $("#article-item-body").empty(); // to stop video.
	      $.history.load(loc);
	      $.scrollTo($("#article-list").position().top, 100);
	    });
	
		  $(".btn-post-article").click(function() {
		  	if(!service.User.getMe()) {
		  		$("#nav .login-url").click();
		  		return;
		  	}
		  	$("#post-article-id").attr("disabled", "disabled");
		  	ArticleEditor.open();
		  })
	    $("#btn-edit-article").click(function() {
	    	var form = $("#post-article-form");
	    	$("#post-article-id").removeAttr("disabled").val(self.current.id);
	    	$("#post-article-title").val(self.current.titleDecoded);
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
	        var me = service.User.getMe();
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
	    		service.Reputation.renderUsers(type);
	        $().toastmessage("showSuccessToast", gettext(action + "d."));
	        
	        $("#loading").hide();
	      };
	      $("#loading").show();
	      service.Reputation[action]('Article', self.current.id, callback);
	    });
	    $("#btn-post-article-submit").click(function() {
	    	$("#post-article-id").attr("disabled") ? self.post($("#post-article-form")) : self.put($("#post-article-form"));
	      return false;
	    });
	
	    $("#btn-delete-article").click(function() {
	    	bootbox.confirm(gettext("Are you sure?"), function(yes) {
	    		yes && self.delete(); 
	    	});
	      return false;
	    });
		  
		  $("#article-list tbody .article-title").live("click", function(event) {
		    $("#article-item #article-item-title").text($(this).attr("title"));
		    return true;
		  });
		  
		  if(typeof FB != "undefined") {
			  FB.Event.subscribe("edge.create", function(href, widget) {
			  	$("#btn-like-article").click();
			  });
			  
			  FB.Event.subscribe("edge.remove", function(href, widget) {
			  	$("#btn-unlike-article").click();
			  });
		  }
		  return self;
		})(),
		
		Comment: (function() {		  
			var self = {
			    COUNT_TEMPLATE: '<span class="badge">{{ count }}</span>',
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
						var article = service.Article.getCurrent();
						$.getJSON("/service/comment/" + article.id, {offset: article.comment_count - self.limit - self.loadedCount}, function(data) {
							var topId = $("#comments .comment-item:eq(0)").attr("id");
							self.render(data.comment_list, -1);
							$("#loading").hide();
							$("#btn-comment-load").button("complete");
							topId && $.scrollTo($("#" + topId).position().top, 500);
						});
					},
					render: function(data, position) {
						self.loadedCount += data.length;
						$("#comment-load-more").toggle(self.loadedCount < service.Article.getCurrent().comment_count);					
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
								 avatar: service.User.getAvatar(item.author.email_hash, 32),
								 buttons: isBest ? "" : self._getButtons(item),
								 label: isBest ? ' <span class="label label-success">BEST</span>' : ""
							 }));
					},
					_getButtons: function(item) {
            var me = service.User.getMe();
            var isMine = me && me.email_hash == item.author.email_hash;  
					  return '<span class="comment-btns">' + 
                    (isMine ? '<button class="btn-comment-delete btn" data-comment-id="' + item.id + '" title="' + gettext('Delete') + '"><i class="icon-trash"></i></button>' : "")
                      + '\
                        <button class="btn-comment-like btn btn-reputation' + (item.liked ? " " + self.didClass : "") + '" data-comment-id="' + item.id + '" title="' + gettext('Like') + '"' + (!me || isMine || item.hated ? ' disabled="disabled"' : "") + '><i class="icon-thumbs-up"></i> <span class="like-count count">' + item.like_count + '</span></button>\
                        <button class="btn-comment-hate btn btn-reputation' + (item.hated ? " " + self.didClass : "") + '" data-comment-id="' + item.id + '" title="' + gettext('Hate') + '"' + (!me || isMine || item.liked ? ' disabled="disabled"' : "") + '><i class="icon-thumbs-down"></i> <span class="hate-count count">' + item.hate_count + '</span></button>\
                        ' + 
                    (item.parent_id || !me ? "" : ' <button class="btn-comment-reply btn" data-comment-id="' + item.id + '" title="' + gettext('Reply') + '"><i class="icon-comment"></i></button>') +
                  '</span>';
					},
					updateCount: function(amount) {
		        var countDiv = $("#article-list tr.active .comment-count");
		        if(countDiv.length > 0) {
		        	var m = countDiv.text().match(/[0-9]+/);
		          var count = (m ? parseInt(m[0]) : 0) + amount;
		          countDiv.html(formatString(self.COUNT_TEMPLATE, {count: count}));
		          $("#article-item #article-item-comment_count").text(count);
		        }
					},
					post: function() {
						var val = $("#post-comment").val();
						if(!val) {
							return;
						}
						$("#loading").show();
						var url = "/service/comment/" + service.Article.getCurrent().id;
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
				var id = $(this).data("comment-id");
				bootbox.confirm(gettext("Are you sure?"), function(yes) {
					self.delete(id);
				});
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
	      service.Reputation[action]('Comment', id, callback);
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
			    	  		html = '<li class="no-record"> <i class="icon-ban-circle"></i> ' + gettext("No record.") + '</li>';
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
			        var thumbnail;
			        if(item.image) {
			          thumbnail = getImageShackThumbnail(item.image);
			        } else if(item.video) {
			          thumbnail = formatString("http://img.youtube.com/vi/{{ videoId }}/1.jpg", {videoId: getYoutubeVideoId(item.video)});
			        }
			        return formatString('<li>\
                <div>\
			            <span class="category label label-info">{{ category }}</span>\
                  <h4><a href="/#!/{{ category }}/{{ id }}" class="title">{{ title }}</a></h4>\
                  ' + (item.comment_count > 0 ? '<span class="comment-count badge">{{ comment_count }}</span>' : "") + '\
                  <span class="posted"><time datetime="{{ created }}">{{ created|prettyDate }}</time></span>\
                </div>\
                <p class="excerpt"><a href="/#!/{{ category }}/{{ id }}" class="title">{{ thumbnail }}{{ excerpt }}</a></p>\
              </li>', $.extend(true, item, {
                thumbnail: thumbnail ? formatString('<img src="{{ thumbnail }}" onerror="this.style.display=\'none\'">', {thumbnail: thumbnail}) : "" 
              }));
			      case "comment":
			        return formatString('<li>\
                <div>\
			            <span class="category label label-info">{{ article.category }}</span>\
                  <h4><a href="/#!/{{ article.category }}/{{ article.id }}" class="title">{{ article.title }}</a></h4>\
			        		{{ likeCount }}\
			        		{{ hateCount }}\
                  <span class="posted"><time datetime="{{ created }}">{{ created|prettyDate }}</time></span>\
                </div>\
                <p class="body">{{ body }}</p>\
              </li>', $.extend(true, item, {
              	likeCount: item.like_count > 0 ? '<span class="like-count badge"><i class="icon-thumbs-up icon-white"></i> ' + item.like_count + '</span>' : "",
              	hateCount: item.hate_count > 0 ? '<span class="hate-count badge"><i class="icon-thumbs-down icon-white"></i> ' + item.hate_count + '</span>' : ""
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
			$("a.more-users").live("click", function() {
			  $("#loading").show();
			  var title = $(this).data("window-title");
			  $.get($(this).attr("href"), function(html) {
	        showModalWindow({
	          title: title ? title : gettext("People"),
	          body: html
	        });
	        $("#loading").hide();
			  }, "html");
			  return false;
			})
		  return self;
		})(),
		
		Tag: (function() {
			var self = {
				current: null,
				getCurrent: function() {
					return self.current;
				},
				select: function(name, callback) {
				  service.Category.current = null;
					self.current = name;
		    	$("#nav li.active").removeClass("active");
		    	$("#nav li:has(a[href='/tags'])").addClass("active");					
					$("#home-content, #starred-wrapper, #category-explorer-wrapper, .btn-post-article").hide();
	        $("#container .breadcrumb li:gt(0)").remove();
	        $("#content, #container .breadcrumb li:eq(0) .divider").show();
          $("#container .breadcrumb").append(formatString('<li><a href="/tags" class="tags-link"><i class="icon-tags icon-blue"></i>{{ label }}</a> <span class="divider">/</span></li> <li><i class="icon-tag"></i>{{ tag }}</li>', {
          	label: gettext("Tags"), 
          	tag: gettext(name)
          }));
          service.Article.loadList('tag', name, callback);
				}	
			}
			$("a.tags-link").live("click", function() {
			  $("#loading").show();
			  $.get($(this).attr("href"), {output: "html"},function(html) {
			    $("#loading").hide();
			    showModalWindow({id: "tag-cloud-dialog", body: html});
			  }, "html");
			  return false;
			});
			$("#tag-cloud a").live("click", function() {
			  $("#tag-cloud-dialog").modal("hide");
			  return true;
			});
			return self;
		})(),
		
		Subscription: (function(){
		  var self = {
  		  subscribe: function(btn) {
          $.post("/service/subscription/" + service.Article.getCurrent().id, function() {
            btn.hide();
            btn.parent().find("#btn-unsubscribe-article").show();
            $().toastmessage("showSuccessToast", gettext("Subscribed"));
            $("#loading").hide();            
          });
  		  },
  		  unsubscribe: function(btn) {
          $.ajax({
            type: "DELETE",
            url: "/service/subscription/" + service.Article.getCurrent().id,
            cache: false,
            success: function() {
              btn.hide();
              btn.parent().find("#btn-subscribe-article").show();         
              $().toastmessage("showSuccessToast", gettext("Canceled your subscription"));
              $("#loading").hide();
            },
            dataType: "json"
          });  		    
  		  }
		  };
		  $(".btn-subscribe").click(function() {
        var btn = $(this);
        if(btn.attr("disabled")) {
          return;
        } 
        $("#loading").show();
        self[btn.attr("id") == "btn-subscribe-article" ? "subscribe" : "unsubscribe"](btn);
		  });
		  return self;
		})(),
		
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
			  var article = service.Article.getCurrent();
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
	        return '<a href="/user/' + item.id + '" class="user">' + service.User.getAvatar(item.email_hash, 16) + '<span class="nickname">' + item.nickname + "</span></a> ";
	      });
	      var output = rendered.get().join(", ");
	      
	      var totalCount = article[type + "_count"];
	      if(count < totalCount) {
	        var diff = totalCount - count;
	        var context = {
	        		link: formatString("/service/{{ type }}/{{ id }}", {type: type, id: article.id}),
	        		title: type == "like" ? gettext("People who likes this") : gettext("People who hates this") 
	        }
	        output += interpolate(ngettext(formatString(' and <a href="{{ link }}" class="more-users" rel="tooltip" data-window-title="{{ title }}">%s more</a> ', context), formatString(' and <a href="{{ link }}" class="more-users" rel="tooltip" data-window-title="{{ title }}">%s others</a> ', context), diff), [diff]);
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
		      			data: {offset: 5, output: "json", limit: 100},
		      			async: false,
		      			dataType: "json"
		      		}).responseText).user_list;
	      			$(this).data("others", data);
	      		}
	      		
	      		return $(data).map(function(i, item) {
	      			return item.nickname;
	      		}).get().join("<br>");
	      	}
	      });
			}
		}
	});
}