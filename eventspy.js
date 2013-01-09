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
		    codeDiv       = _window.document.createElement('div'),
		    eventDate;

    if (evtObj.eventspyType === 'fired') {
    
      eventDate = new Date(evtObj.data.event.timeStamp);
    
		  eventDiv.innerHTML = [eventDate.toLocaleTimeString(), " -> ",
						                evtObj.data.event.name, " : ",
						                evtObj.data.event.type, " (",				
						                evtObj.data.event.pageX, ", ",
						                evtObj.data.event.pageY, ")"].join('');
						     
	    codeDiv.innerHTML = evtObj.data.event.handler;
    
    } else if (evtObj.eventspyType === 'created') {
      eventDiv.innerHTML = [evtObj.data.type, " : useCapture(",				
						                evtObj.data.useCapture, ") "].join('');
						                
	    codeDiv.innerHTML = evtObj.data.listener;
			
    }
    
		eventDiv.addEventListener('mouseover', function (evt) {
			
			port.postMessage({
			  'action': 'highlight', 
			  'targetNodeID': evtObj.data.event.targetNodeID,
  		  'tabId': chrome.devtools.inspectedWindow.tabId 
			});
			
		}, false);

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
		    logFragment = document.createDocumentFragment(),
		    registeredFragment = document.createDocumentFragment(),
	      logTab = _window.$('#log-tab'),
	      registeredTab = _window.$('#registered-tab');

		dump.forEach(function(eventObj) {
		  var divs;
		  
		  if (eventObj && eventObj.eventspyType) {
  		  divs = drawEventDiv(eventObj);
		  } 

			console.log('eventspyType: ', eventObj.eventspyType);
		  
		  if (eventObj && eventObj.eventspyType === 'fired') {
        logFragment.appendChild(divs.eventdiv);
  			logFragment.appendChild(divs.codediv);	
		  } else if (eventObj && eventObj.eventspyType === 'created') {
		    registeredFragment.appendChild(divs.eventdiv);
  			registeredFragment.appendChild(divs.codediv);
		  }
			
		});
  
    logTab.append(logFragment);
    registeredTab.append(registeredFragment);
    
    _window.document.getElementById('log-tab').scrollTop = _window.document.getElementById('log-tab').scrollHeight;
    _window.document.getElementById('registered-tab').scrollTop = _window.document.getElementById('registered-tab').scrollHeight;
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
	  
		_window       = pWindow,
		
		_window.$('#tabs').css({
		  'height': (_window.$(_window).height() - 10)
		});
		
		_window.$('#tabs').tabs({heightStyle: 'fill'});
		
		_window.$(_window).resize(function () {
		
			_window.$('#tabs').css({
		    'height': (_window.$(_window).height() - 10)
  		});
		
		  _window.$('#tabs').tabs('refresh');
		});
		
	  port.onMessage.addListener(function(msg) {
		  switch (msg.action) {
	      case 'event-dump': {
		      if (msg.dump != undefined && msg.dump.length > 0) {
				      drawBulk(msg.dump); 
		      }
	        break;
	      }
	      
	      case 'tab-updated': {
	        port.postMessage({
      	    'action': 'start-frontend',
		        'tabId': chrome.devtools.inspectedWindow.tabId 
	        });
	        break;
	      }
		  }
	  });
	});
});
