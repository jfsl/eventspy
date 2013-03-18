console.log('Event Spy -> background script started');

var subscribers = [],
    frontends = [];
    
chrome.tabs.onUpdated.addListener(function (tabId) {
  if (subscribers[tabId] != null) {
    for (idx = 0; idx < subscribers[tabId].length; idx++) {
      subscribers[tabId][idx].postMessage({
        'action': 'tab-updated'
      });
    }
  }
});

function postMsg(port, msg) {
  try{
    port.postMessage(msg);
  } catch (ex) {
    if (ex.message === 'Attempting to use a disconnected port object') {
      return false;
    } else {
      throw ex;
    }
  }
}

chrome.extension.onConnect.addListener(function(port) {

  console.assert(port.name == "eventspy");

  port.onMessage.addListener(function(msg) {
    var idx = 0,
        found = false;
      
    switch (msg.action) {
    
      case "event-dump": {
        if (subscribers[port.sender.tab.id] != null) {
          if (msg.dump.length > 0) {
            for (idx = 0; idx < subscribers[port.sender.tab.id].length; idx++) {
              try {
                if (subscribers[port.sender.tab.id][idx]) {
                  subscribers[port.sender.tab.id][idx].postMessage(msg);
                }
              } catch (ex) {
                if (ex.message === 'Attempting to use a disconnected port object') {
                  subscribers[port.sender.tab.id][idx] = undefined;
                } else {
                  throw ex;
                }
              }
            }
          }
        }
        break;
      }

      case "subscribe": {
      
        if (subscribers[msg.tabId] == null) {
            subscribers[msg.tabId] = [];
        }

        if (subscribers.length > 0) {
          subscribers[msg.tabId].forEach(function (subscriber) {
            if (subscriber.portId_ == port.portId_) {
              found = true;
            }
          });
        }
        
        if (!found) {
          subscribers[msg.tabId].push(port);
        } 
        
        break;
      }

      case "frontend-subscribe": {

        if (frontends[port.sender.tab.id] == null) {
            frontends[port.sender.tab.id] = {
              injected: false,
              ports: []
            };
        } else {
          frontends[port.sender.tab.id].ports.push(port);
        }

        if (frontends[port.sender.tab.id].injected) {
          frontends[port.sender.tab.id].ports.forEach(function (pPort) {
            var result = postMsg(pPort, {
              'action': 'start-frontend'
            });
          }); 
        }
        
        break;
      }

      case "highlight": {
        if (frontends[msg.tabId] != null) {
          for (idx = 0; idx < frontends[msg.tabId].ports.length; idx++) {
            try {
              frontends[msg.tabId].ports[idx].postMessage(msg);
            } catch (ex) {
              // do nothing
            }
          }
        }
        break;
      }
      
      case "start-frontend": {
        if (frontends[msg.tabId] != null) {
          if (!frontends[msg.tabId].injected || msg.reInject) {
            chrome.tabs.reload(msg.tabId, function () {
              frontends[msg.tabId].injected = true;
            });
          }
        }
        break;
      }

      default: {
        console.log('Event Spy -> Recieved invalid message: ', msg);
        break;
      }
    }
  });
});
