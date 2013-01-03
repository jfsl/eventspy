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

chrome.extension.onConnect.addListener(function(port) {

	console.assert(port.name == "eventspy");

	port.onMessage.addListener(function(msg) {
	  var idx = 0;
	    
		switch (msg.action) {
		
      case "eventDump": {
        if (subscribers[port.sender.tab.id] != null) {
          if (msg.dump.length > 0) {
            for (idx = 0; idx < subscribers[port.sender.tab.id].length; idx++) {
	            subscribers[port.sender.tab.id][idx].postMessage(msg);
            }
          }
        }
        break;
      }

      case "subscribe": {
      
        if (subscribers[msg.tabId] == null) {
            subscribers[msg.tabId] = [];
        }
    
        subscribers[msg.tabId].push(port);
        
        break;
      }
      
      case "unsubscribe": {
        if (subscribers[port.sender.tab.id] != null) {
          delete subscribers[port.sender.tab.id];
        }
        break;
      }

      case "frontend-subscribe": {

        if (frontends[port.sender.tab.id] == null) {
            frontends[port.sender.tab.id] = [];
        }
        
        frontends[port.sender.tab.id].push(port);
        
        break;
      }

      case "frontend-unsubscribe": {
        delete frontends[frontends.indexOf(port)];
        break;
      }

      case "highlight": {
        if (frontends[msg.tabId] != null) {
          for (idx = 0; idx < frontends[msg.tabId].length; idx++) {
            try {
              frontends[msg.tabId][idx].postMessage(msg);
            } catch (ex) {
              // do nothing
            }
          }
        }
        break;
      }
      
      case "start-frontend": {
        if (frontends[msg.tabId] != null) {
          for (idx = 0; idx < frontends[msg.tabId].length; idx++) {
            try {
              frontends[msg.tabId][idx].postMessage(msg);
            } catch (ex) {
              // do nothing
            }
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
