var HASH_PARAMS;
var HASH_TOKENS;
$(function() {
	if (location.pathname != "/") {
		return;
	}
	$(".login-url").click(
			function() {
				localStorage && location.hash
						&& location.hash != "#!/" && location.hash != "#!" && localStorage.setItem("lastHash", location.hash.substring(1));
				return true;
			});
	
	if (localStorage && localStorage.hasOwnProperty("lastHash")) {
		var lastHash = localStorage.getItem("lastHash");
		if (lastHash) {
			localStorage.removeItem("lastHash");
			$.history.load(lastHash);
		}
	}
	
	$.history.init(function(hash) {
		// "_trackEvent" is the pageview event, 
		_gaq.push(['_trackPageview']);
		if (hash == "") {
			$.history.load("!");
			return;
		}
		hash = decodeURI(hash);
		var idx = hash.indexOf("?");
		HASH_PARAMS = {};
		if (idx > -1) {
			var queryString = hash.substring(idx + 1);
			$(queryString.split("&")).each(function(i, item) {
				var pair = item.split("=");
				HASH_PARAMS[pair[0]] = pair[1];
			})
		}
		var m = hash.match(/^(!|tag)/);

		if (m) {
			var mString = m[0];
			initializeModels();
			HASH_TOKENS = hash.substring(mString.length + 1,
					idx > -1 ? idx : hash.length).split("/");
			
			var callback = HASH_TOKENS.length > 1 && HASH_TOKENS[1] ? function() {
				service.Article.show(HASH_TOKENS[1]);
			} : service.Article.hide;
			
			switch (mString) {
			case "!":
			case "category":
				service.Category.select(HASH_TOKENS[0], callback);
				if(HASH_TOKENS.length == 1 && !HASH_TOKENS[0]) {
				  service.Category.showTopLevelRecent();
				  $("#home-content").show();
				}
				break;
			case "tag":
				service.Tag.select(HASH_TOKENS[0], callback);
				break;
			}
		}
	}, {
		unescape : true
	});
});