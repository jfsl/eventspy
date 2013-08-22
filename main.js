var port = chrome.extension.connect({name: "eventspy"}),
    injected = false,
    scriptTagInjected = false;

port.postMessage({'action': 'frontend-subscribe'});

var injectee = (function () {
    
  var comm = (function () {
    return {
        send: function (message) {
          window.postMessage(message, '*');         
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

  walkTheDOM(document.body, function (node) {
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

window.addEventListener('message', function (event) {
  port.postMessage({
    'action': 'event-dump', 
    'dump': [event.data]
  });
}, false);

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
    }
  }
});