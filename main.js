var port = chrome.extension.connect({name: "eventspy"}),
    state = "stop";
    
port.postMessage({'action': 'frontend-subscribe'});

port.onDisconnect.addListener(function (evt) {
  port.postMessage({'action': 'frontend-unsubscribe'});
	port = undefined;
});

port.onMessage.addListener(function (msg) {
  switch (msg.action) {
    case "highlight": {
      
      $('.highlight').each(function (idx, obj) {
        $(obj).removeClass('highlight');
      });
      
      var obj = $(['[data-eventspy-target-node-id*="', msg.targetNodeID, '"]'].join(''));
      obj.addClass('highlight');
      
      break;
    }
    
    case "start-frontend": {
      
      state = "start";
      
    }
  }
});

var injectee = (function () {
	
  var eventspyState = document.createElement('div');
	
	eventspyState.id = "eventspy-status";	
	eventspyState.style.display = 'none';
		
	eventspyState.innerHTML = "stop";
	document.body.appendChild(eventspyState);
	
	var comm = (function () {
		
		var queue = [],
			  msgContainer = document.createElement('div');
			  
	  msgContainer.id = 'eventspy-msg-pool';
	  msgContainer.style.display = 'none';
	  document.body.appendChild(msgContainer);
		
		function send() {
			if (eventspyState.innerHTML == "start") {
				queue.forEach(function (message) {
					var container = document.createElement('div');
					container.style.display = 'none';
					container.setAttribute('data-eventspy-msg', true);
					try {
						container.innerHTML = JSON.stringify(message);
					} catch (ex) {}
					msgContainer.appendChild(container);
				});
				queue = [];
			} 
		}
		
		return {
			send: function (message) {
				queue.push(message);
				send();
			}
		};
	})();
	
	Element.prototype.realAddEventListener = Element.prototype.addEventListener; 
	Element.prototype.addEventListener = function (type, listener, useCapture) { 	
	  comm.send({
      'eventspy-type': 'created',
		  'data': {
			  'type': type,
			  'listener': listener,
			  'useCapture': useCapture
		  }
	  });
		
	  this.realAddEventListener(type, listener, useCapture); 
	
	  this.realAddEventListener(type, function (evt) {
      if (eventspyState.innerHTML == "start") {
        var targetNodeID = [evt.type, evt.pageX, evt.pageY, evt.timeStamp].join('-');
        if (evt.target.hasAttribute('data-eventspy-target-node-id')) {
          targetNodeID = targetNodeID + " " + evt.target.getAttribute('data-eventspy-target-node-id');
        }
        evt.target.setAttribute('data-eventspy-target-node-id', targetNodeID);

    	  evtMsgObj = {
				  "name": evt.toString(),
				  "type": evt.type,
				  "pageX": evt.pageX,
				  "pageY": evt.pageY,
				  "handler": "" + listener.valueOf() + "",
				  "timeStamp": evt.timeStamp,
				  "targetNodeID": targetNodeID, 
			  };
			
			  comm.send({
				  'eventspy-type': 'fired',
				  'data': {
				    'event': evtMsgObj
				  }
			  });
		  }
	  }, useCapture);
	};
}).valueOf();

var comm = (function () {
	
	var queue = [],
		  injecteeStatus = $('#eventspy-status'),
		  msgContainer = document.getElementById('eventspy-msg-pool');
	
	function poll() {
	
	  if (msgContainer == null) {
	    msgContainer = document.getElementById('eventspy-msg-pool');
	  } else {
		    
			  $('div[data-eventspy-msg="true"]', msgContainer).each(function (idx, obj) {
				  queue.push(JSON.parse(obj.innerHTML));
				  $(obj).remove();
			  });
	
		  if (port) {
		
			  port.postMessage({
				  'action': 'eventDump', 
				  'dump': queue}
			  );
		
		  }
		  
		  queue = [];
		  injecteeStatus.html(state);
		  
		}
		
		if (injecteeStatus.length <= 0) {
			injecteeStatus = $('#eventspy-status');
		}
	};
	
	return {
		startPoll: function () {
			setInterval(poll, 1000);
		}
	};

})();

var scriptTag = document.createElement('script');
scriptTag.innerHTML = "(" + injectee + ")();";

document.getElementsByTagName('head')[0].appendChild(scriptTag);

comm.startPoll();
