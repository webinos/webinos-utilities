(function(exports) {
  var fs = require('fs');
  var path = require('path');
  var webinosPath = require("./webinosPath.js").webinosPath();
  var logger = require("./logging.js")(__filename);
  var eventEmitter = require('events').EventEmitter;
  var util = require('util');
  var uuid = require('node-uuid');
  var existsSync = fs.existsSync || path.existsSync;

  var NotificationManager = function(pzhObject) {
    var _self = this;

    // Cache the PZH object if running under a PZH.
    if (typeof pzhObject !== "undefined") {
      _self.pzh = pzhObject;
    }

    eventEmitter.call(_self);

    // Known notification types.
    _self.notifyType = {
      all: "all",
      notification: "notification",
      permissionRequest: "permissionRequest",
      permissionResponse: "permissionResponse",
      connectionRequest: "connectionRequest",
      sync: "sync"
    };

    _self.notificationHandlers = {};

    process.nextTick(function() { _self.initialiseNotifications(); });
  };

  util.inherits(NotificationManager, eventEmitter);

  NotificationManager.prototype.getListFilename = function() {
    var f;
    if (typeof this.pzh === "undefined") {
      f = path.join(webinosPath,"userData/notifications.json");
    } else {
      f = path.join(this.pzh.getWebinosRoot(),"userData/notifications.json");
    }
    return f;
  }

  function getEmptyConfig() {
    return {
      promptNotification: {},
      emailNotification: {},
      trayNotification: {}
    };
  }

  NotificationManager.prototype.loadList = function() {
    var listFile = this.getListFilename();
    var list;
    if (existsSync(listFile)) {
    var fileContents = fs.readFileSync(listFile);
      list = JSON.parse(fileContents);
    } else {
      list = {
        notifications: {},
        config: getEmptyConfig()
      };
    }
    return list;
  }

  NotificationManager.prototype.saveList = function(list) {
    var listFile = this.getListFilename();
    var fileContents = JSON.stringify(list,null,2);
    fs.writeFileSync(listFile,fileContents);
  }

  NotificationManager.prototype.initialiseNotifications = function(){
    var _self = this;

    // Register the notifications dashboard module
    try {
      var dashboard = require("webinos-dashboard");
      dashboard.registerModule("notifications","Notifications", path.join(__dirname,"./dashboard/"));
    } catch (e) {
      // ignore.
    }

    _self.createNotificationHandlers();
  };

  NotificationManager.prototype.addPZPHandler = function(handlerName, handlerClass, entName, createIfMissing) {
    var _self = this;
    var create = false;
    var handler;
    if (_self.notificationHandlers.hasOwnProperty(handlerName)) {
      _self.notificationHandlers[handlerName].removeNotify();
      delete _self.notificationHandlers[handlerName];
    }
    var notificationConfig = _self.getConfig();
    if (notificationConfig.hasOwnProperty(handlerName) && notificationConfig[handlerName].hasOwnProperty(entName)) {
      create = notificationConfig[handlerName][entName] === true;
    } else {
      create = typeof createIfMissing !== "undefined" && createIfMissing === true;
    }
    if (create) {
      handler = new handlerClass(_self,notificationConfig[handlerName]);
      _self.notificationHandlers[handlerName] = handler;
      logger.log(">>>>>> started " + handlerName + " notification handler");
    }

    return handler;
  }

  NotificationManager.prototype.createNotificationHandlers = function() {
    var _self = this;

    var webinosId = require("./webinosId.js");
    var PromptHandler = require("./notification-handlers/promptNotificationHandler/promptHandler").Handler;
    var TrayHandler = require("./notification-handlers/trayNotificationHandler/trayHandler").Handler;
    var EmailHandler = require("./notification-handlers/emailNotificationHandler/emailHandler").Handler;

    // Create notification handlers.
    var notificationConfig = _self.getConfig();
    if (typeof _self.pzh === "undefined") {
      // Running on PZP - get the pzp name to look-up config values.
      webinosId.fetchWebinosName("Pzp",null, function(entName) {
        // Only issue prompt and tray notifications on PZPs
        _self.addPZPHandler("promptNotification", PromptHandler, entName, true);
        _self.addPZPHandler("trayNotification", TrayHandler, entName);
      });
    } else {
      // Only issue e-mail, SMS and voice notifications from PZH.
    }
  }

  NotificationManager.prototype.getConfig = function() {
    var list = this.loadList();
    if (typeof list.config === "undefined") {
      list.config = getEmptyConfig();
    }
    return list.config;
  };

  NotificationManager.prototype.setConfig = function(cfg) {
    var list = this.loadList();
    list.config = cfg;
    this.saveList(list);
    this.createNotificationHandlers();
  };

  // Retrieve a specific notification from the list
  NotificationManager.prototype.getNotification = function(id) {
    var list = this.loadList();

    var notify;
    if (list.notifications.hasOwnProperty(id)) {
      notify = list.notifications[id];
    }

    return notify;
  };

  // Retrieve all notifications (optionally of a given type)
  NotificationManager.prototype.getNotifications = function(type) {
    var list = this.loadList();

    var lst = { notifications: {}};

    for (var id in list.notifications) {
      if (list.notifications.hasOwnProperty(id) && (typeof type === "undefined" || type === "" || list.notifications[id].type === type)) {
        lst.notifications[id] = list.notifications[id];
      }
    }

    lst.config = list.config;

    return lst;
  };

  NotificationManager.prototype.getNotificationsArray = function() {
    var list = this.loadList();

    var lst = [];

    for (var id in list.notifications) {
      if (list.notifications.hasOwnProperty(id)) {
        lst.push(list.notifications[id]);
      }
    }

    return lst;
  };

  NotificationManager.prototype.addNotification = function(type,data) {
    var notify = {};

    try {
      var list = this.loadList();

      logger.log("NOTIFICATIONS - adding: " + util.inspect(data));

      notify.id = uuid.v1();
      notify.timestamp = new Date();
      notify.type = type;
      notify.data = data;
      list.notifications[notify.id] = notify;
      this.saveList(list);

      this.emit(notify.type, notify);
      this.emit(this.notifyType.all, notify);
    } catch (e) {
      logger.log("error during notificationManger.addNotification: " + e.message);
    } finally {
    }

    return notify;
  };

  // Remote initiated sync occurred (we received updates from remote PZH/PZP)
  NotificationManager.prototype.updateAfterSync = function(remoteList) {
    var syncList = this.loadList();
    var newItems = [];

    for (var nIdx = 0; nIdx < remoteList.length; nIdx++) {
      var notify = remoteList[nIdx];
      if (!syncList.notifications.hasOwnProperty(notify.id)) {
        logger.log("SYNC adding: " + util.inspect(notify));
        syncList.notifications[notify.id] = notify;
        newItems.push(notify);
      }
    }

    if (newItems.length > 0) {
      this.saveList(syncList);

      for (var n in newItems) {
        this.emit(newItems[n].type, newItems[n]);
        this.emit(this.notifyType.all, newItems[n]);
      }
    }

    return newItems.length > 0;
  };

//  exports.notificationManager = new NotificationManager();
  exports.NotificationManager = NotificationManager;
})(module.exports);