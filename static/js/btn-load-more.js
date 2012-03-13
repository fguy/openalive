	$(function() {
		$("#btn-load-more").click(function() {
			var self = $(this);
			var offset = self.data("offset");
			self.button("loading");
			$.getJSON(self.data("url"), {offset: offset}, function(data) {
				if(data.list.length == 0) {
					$().toastmessage("showWarningToast", gettext("No more."));
					self.hide();
					return;
				}
				var div = $($(data.list).map(function(i, item) {
					return formatString(ROW_TEMPLATE, $.extend(item, {
						commentCount: item.comment_count > 0 ? formatString('<span class="badge"><i class="icon-comment icon-white"></i> {{ comment_count }}</span>', item) : ""
					}));
				}).get().join("")).hide().appendTo("ul.thumbnails").slideDown();
				$.fn.fancybox && div.find(".image-zoom").fancybox();
				self.data("offset", offset + data.list.length);
				self.button("complete");
				data.list.length != 20 && self.hide();
			});
		});		
	});