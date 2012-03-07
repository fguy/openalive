var HASH_PARAMS;
$(function() {
	if (location.pathname != "/") {
		return;
	}
	$("#nav .login-url").click(
			function() {
				// var href = $(this).attr("href");
				// var hashPart = encodeURIComponent(location.hash);
				// $(this).attr("href", href.indexOf("&action=") > -1 ?
				// href.replace("&action=", hashPart + "&action=") : href + hashPart);
				// return true;
				localStorage && location.hash
						&& localStorage.setItem("lastHash", location.hash.substring(1));
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
			var tokens = hash.substring(mString.length + 1,
					idx > -1 ? idx : hash.length).split("/");
			
			var callback = tokens.length > 1 && tokens[1] ? function() {
				models.Article.show(tokens[1]);
			} : models.Article.hide;
			
			switch (mString) {
			case "!":
			case "category":
				models.Category.select(tokens[0], callback);
				break;
			case "tag":
				models.Tag.select(tokens[0], callback);
				break;
			}
		}
	}, {
		unescape : true
	});
});