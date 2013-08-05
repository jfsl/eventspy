var port = chrome.extension.connect({name: "eventspy"}),
    injected = false,
    scriptTagInjected = false;

port.postMessage({'action': 'frontend-subscribe'});

var injectee = (function () {

  var eventspyContainer = document.createElement('div');
  
  eventspyContainer.id = "eventspy";
      
  document.body.appendChild(eventspyContainer);
    
  var comm = (function () {
        
    var queue = [],
        msgContainer = document.createElement('div');
          
    msgContainer.id = 'eventspy-msg-pool';
    msgContainer.style.display = 'none';
    eventspyContainer.appendChild(msgContainer);
      
    function send() { 
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
      
    return {
        send: function (message) {
            queue.push(message);
            if (document.getElementById('eventspyStart')) {
              send();
            } 
        }
    };
  })();
    

  function trampoline (x) {
    while (x && x.func) {
      x = x.func.apply(null, x.args);
    }
    return x;
  }

  var walkTheDOM = function walk(node, func) {
    func(node);
    node = node.firstChild;
    while (node) {
        trampoline({
          func: walk,
          args: [node, func]
        });
        //walk(node, func);
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
      "handler": "" + escape(listener.valueOf()) + "",
      "timeStamp": evt.timeStamp,
      "targetNodeID": targetNodeID
    };
    
    comm.send({
      'eventspyType': 'fired',
      'data': {
        'event': evtMsgObj
      }
    });
  }

  if (typeof Element.prototype.realAddEventListener !== 'function') {
    Element.prototype.realAddEventListener = Element.prototype.addEventListener;
  }
  Element.prototype.addEventListener = function (type, listener, useCapture) {
    this.dataset.eventspyTargetNodeId = Math.random().toString(36).substring(2);
    comm.send({
      'eventspyType': 'created',
        'data': {
            'type': type,
            'listener': "" + listener.valueOf() + "",
            'useCapture': useCapture,
            'event': {
              "targetNodeID": this.dataset.eventspyTargetNodeId
            }
        }
    });
    
    this.realAddEventListener(type, listener, useCapture); 
    this.realAddEventListener(type, function (evt) {
      if (typeof jQuery != 'undefined' && jQuery._data(this, 'events')[type] !== undefined) {
          jQuery._data(this, 'events')[type].forEach(function (jqEvent) {
            evt.type = jqEvent.type;
            registerEvent(evt, jqEvent.handler);
          });
      } else {
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
            node[prop] = function (event) {
              registerEvent(event, origCb);
              origCb.call(this, event);
            };
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
  var queue          = []
      msgContainer   = document.getElementById('eventspy-msg-pool'),
      eventspyStart  = document.createElement('div');
    
  eventspyStart.id = 'eventspyStart';

  function poll() {
    var msgIdx = 0,
        messages;
    
    if (document.getElementById('eventspy') && document.getElementById('eventspyStart') == undefined) {
      document.getElementById('eventspy').appendChild(eventspyStart);
    }

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
    } 
  }
    
  return {
    startPoll: function () {

      if (document.getElementById('eventspy')) {
        document.getElementById('eventspy').appendChild(eventspyStart);
      }

      try {
        document.querySelector('#eventspy').addEventListener('DOMSubtreeModified', poll);
      } catch (ex) {}

      setInterval(poll, 1000);
    }
  };
})();

port.onMessage.addListener(function (msg) {
  var highlighted, 
      obj,
      scriptTag;
 
  switch (msg.action) {
    case "highlight": {

      highlighted = document.querySelector('.eventspy-highlight');
      
      if (highlighted) {
        highlighted.className = highlighted.className.replace('eventspy-highlight', '');
      }
      
      obj = document.querySelector(['[data-eventspy-target-node-id*="', msg.targetNodeID, '"]'].join(''));
      
      if (obj) {
        obj.className = obj.className + ' eventspy-highlight';
      }
      
      break;
    }
    
    case "start-frontend": {
      scriptTag = document.createElement('script');
      scriptTag.innerHTML = "(" + injectee + ")();";

      if (!scriptTagInjected) {
        document.getElementsByTagName('head')[0].appendChild(scriptTag);
        scriptTagInjected = true;
      }

      document.addEventListener('DOMSubtreeModified', domSubMod, false);

      var startSending = function () {
        comm.startPoll();
        document.removeEventListener('DOMSubtreeModified', domSubMod, false);
      };

      var bump = setTimeout(startSending, 5000); 
      
      var domSubMod = function () {
        clearTimeout(bump);
        bump = setTimeout(startSending, 5000);         
      };
    }
  }
});