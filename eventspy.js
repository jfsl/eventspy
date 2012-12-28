var port = chrome.extension.connect({
	name : "eventspy"
});

port.onDisconnect.addListener(function (evt) {
  port.postMessage({'action': 'unsubscribe'});
	port = undefined;
});

chrome.devtools.panels.create("Event Spy", "devtools_icon.png", "devtools_tab.html", function(panel) {
	var _window;

	function drawEventDiv(evtObj) {
		var eventDiv      = _window.document.createElement('h3'),
		    codeDiv       = _window.document.createElement('div');
		    
		eventDiv.innerHTML = [evtObj.data.event.timeStamp, " -> ",
						             evtObj.data.event.name, " : ",
						             evtObj.data.event.type, " (",				
						             evtObj.data.event.pageX, ", ",
						             evtObj.data.event.pageY, ")"].join('');
						   
		eventDiv.addEventListener('mouseover', function (evt) {
			
			port.postMessage({
			  'action': 'highlight', 
			  'targetNodeID': evtObj.data.event.targetNodeID,
  		  'tabId': chrome.devtools.inspectedWindow.tabId 
			});
			
		}, false);

    codeDiv.innerHTML = evtObj.data.event.handler;

    $(eventDiv).addClass( "ui-accordion-header ui-helper-reset ui-state-default ui-corner-all" )
               .hover(function () {
                 $(this).addClass("ui-state-hover");
               },function () {
                 $(this).removeClass("ui-state-hover");
               }).css({
                 'padding': '2px',
                 'font-size': '14px',
               }).click(function () {
                  console.log($(codeDiv).data('beautified'));
                 if ($(codeDiv).data('beautified') == null) {
                   $(codeDiv).html(_window.js_beautify($(codeDiv).html()).replace(/\n/g, "<br/>").replace(/ /g, "&nbsp;"));
                   $(codeDiv).data('beautified', true)
                 }
                 
                 $(codeDiv).toggle(500);
               });
               
    $(codeDiv).addClass( "ui-accordion-content ui-helper-reset ui-widget-content ui-corner-bottom" )
              .css({
                'padding': '2px',
                'font-size': '12px'
              })
              .hide();
    
    $(eventDiv)
    
		return {'eventdiv': eventDiv, 'codediv': codeDiv}
	}

	function drawBulk(dump) {
		var idx = 0,
		    fragment = document.createDocumentFragment(),
	      accordionElem = _window.$('#accordion');

		dump.forEach(function(eventObj) {
		  var divs = drawEventDiv(eventObj)
			fragment.appendChild(divs.eventdiv);
			fragment.appendChild(divs.codediv);
		});
  
    accordionElem.append(fragment);		
    _window.document.body.scrollTop = _window.document.body.scrollHeight;
	}

	panel.onShown.addListener(function(pWindow) {
    port.postMessage({
		  'action' : "subscribe",
		  'tabId': chrome.devtools.inspectedWindow.tabId 
	  });
	  
	  port.postMessage({
	    'action': 'start-frontend',
		  'tabId': chrome.devtools.inspectedWindow.tabId 
	  });
	  
	  
		var accordionElem;

		_window       = pWindow,
		accordionElem = _window.$('#accordion');
		
		accordionElem.css({
		  margin: '3px'
		})
		
	  port.onMessage.addListener(function(msg) {
		  switch (msg.action) {
	      case 'eventDump': {
		      if (msg.dump != undefined && msg.dump.length > 0) {
				      drawBulk(msg.dump); 
		      }
	        break;
	      }
	      
	      case 'clear': {
	        accordionElem.children().remove();
	        break;
	      }
		  }
	  });
	});
});
