var port = chrome.extension.connect({name: "eventspy"}),
    state = "stop";
    
port.postMessage({'action': 'frontend-subscribe'});

port.onDisconnect.addListener(function (evt) {
  port.postMessage({'action': 'frontend-unsubscribe'});
	port = undefined;
});

port.onMessage.addListener(function (msg) {
  var highlighted, 
      obj;
 
  switch (msg.action) {
    case "highlight": {
      highlighted = document.querySelector('.highlight');
      
      if (highlighted) {
        highlighted.className = highlighted.className.replace('highlight', '');
      }
      
      obj = document.querySelector(['[data-eventspy-target-node-id*="', msg.targetNodeID, '"]'].join(''));
      
      if (obj) {
        obj.className = obj.className + ' highlight';
      }
      
      break;
    }
    
    case "start-frontend": {
      
      state = "start";
      document.querySelector('#eventspy-status').innerHTML = state;
      
    }
  }
});

var injectee = (function () {
	
  var eventspyState     = document.createElement('div'),
      eventspyContainer = document.createElement('div');
	
	eventspyContainer.id = "eventspy";
	
	eventspyState.id = "eventspy-status";	
	eventspyState.style.display = 'none';
		
	eventspyState.innerHTML = "stop";
	eventspyContainer.appendChild(eventspyState);
	document.body.appendChild(eventspyContainer);
	
	var comm = (function () {
		
		var queue = [],
			  msgContainer = document.createElement('div');
			  
	  msgContainer.id = 'eventspy-msg-pool';
	  msgContainer.style.display = 'none';
	  eventspyContainer.appendChild(msgContainer);
		
		function send() {
			if (eventspyState.innerHTML == "start") {
				queue.forEach(function (message) {
					var container = document.createElement('div');
					container.style.display = 'none';
					container.dataset.dataEventspyMsg = true;
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
	
	var walkTheDOM = function walk(node, func) {
    func(node);
    node = node.firstChild;
    while (node) {
        walk(node, func);
        node = node.nextSibling;
    }
  };
	
	function registerEvent(evt, listener) {
	  var targetNodeID;

    if (!evt.target.dataset.eventspyTargetNodeId) {
      targetNodeID = [evt.type, evt.pageX, evt.pageY, evt.timeStamp].join('-');
      evt.target.dataset.eventspyTargetNodeId = targetNodeID;
    } else {
      targetNodeID = evt.target.dataset.eventspyTargetNodeId;
    }

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
		  'eventspyType': 'fired',
		  'data': {
		    'event': evtMsgObj
		  }
	  });
	}
	
	Element.prototype.realAddEventListener = Element.prototype.addEventListener; 
	Element.prototype.addEventListener = function (type, listener, useCapture) { 	
	  comm.send({
      'eventspyType': 'created',
		  'data': {
			  'type': type,
			  'listener': "" + listener.valueOf() + "",
			  'useCapture': useCapture
		  }
	  });
	  
	  this.realAddEventListener(type, listener, useCapture); 
	
	  this.realAddEventListener(type, function (evt) {
      if (eventspyState.innerHTML == "start") {
        registerEvent(evt, listener);
		  }
	  }, useCapture);
	};
	
	walkTheDOM(document.body, function (node) {
	
	  function checkEventProperties (node) {
	    var properties = [
        'onclick',
        'ondblclick',
        'onmousedown',
        'onmousemove',
        'onmouseover',
        'onmouseout',
        'onmouseup'
      ];

      properties.forEach(function (prop) {
        var origCb;
        
        if (typeof node[prop] === 'function') {
          origCb = node[prop];
          
          if (!node.dataset.eventSpyCb) {
            node[prop] = (function (event) {
              registerEvent(event, origCb);
              origCb.call(event, this);
            });
            
            node.removeAttribute(prop);
          }
          
          node.dataset.eventSpyCb = true;
        }
        
      });
	  }
	
	  if (node.id != 'eventspy') {

      checkEventProperties(node);
      
      if (typeof node.realAddEventListener === 'function') {
        node.realAddEventListener('DOMSubtreeModified', function (event) {
          walkTheDOM(event.target, checkEventProperties);
        });      
      }
      
    }
	
	});
	
	
}).valueOf();

var comm = (function () {
	
	var queue = [],
		  injecteeStatus = document.querySelector('#eventspy-status'),
		  msgContainer = document.getElementById('eventspy-msg-pool');
	
	function poll() {
	  var msgIdx = 0,
	      messages;
	
	  if (msgContainer == null) {
	    msgContainer = document.getElementById('eventspy-msg-pool');
	  } else {
		  messages = msgContainer.children;
		  
		  for (msgIdx = 0; msgIdx < messages.length; msgIdx++) {
			  queue.push(JSON.parse(messages[msgIdx].innerHTML));
			  msgContainer.removeChild(messages[msgIdx]);
		  }
	
		  if (port) {
			  port.postMessage({
				  'action': 'event-dump', 
				  'dump': queue}
			  );
		  }
		  
		  queue = [];
		  
		  if (injecteeStatus) {
		    injecteeStatus.innerHTML = state;
		  }
		  
		}
		
		if (injecteeStatus && injecteeStatus.length <= 0) {
			injecteeStatus = document.querySelector('#eventspy-status');
		}
	};
	
	return {
		startPoll: function () {
		  document.querySelector('#eventspy').addEventListener('DOMSubtreeModified', poll);
			setInterval(poll, 1000);
		}
	};

})();

var scriptTag = document.createElement('script');
scriptTag.innerHTML = "(" + injectee + ")();";

document.getElementsByTagName('head')[0].appendChild(scriptTag);
comm.startPoll();
