(function(exports) {
  var fs = require('fs');
  var path = require('path');
  var existsSync = fs.existsSync || path.existsSync;
  var webinosPath = require("./webinosPath.js").webinosPath();
  var eventEmitter = require('events').EventEmitter;
  var util = require('util');
  var uuid = require('node-uuid');
  var filePath;
  var locked = false;

  function getListFilename() {
    var f;
    if (typeof filePath === "undefined") {
      f = path.join(webinosPath,"userData/notifications.json");
    } else {
      f = path.join(filePath,"userData/notifications.json");
    }
    return f;
  }

  function loadList() {
    var listFile = getListFilename();
    var list;
    if (existsSync(listFile)) {
    var fileContents = fs.readFileSync(listFile);
      list = JSON.parse(fileContents);
    } else {
      list = { notifications: {} };
    }
    return list;
  }

  function saveList(list) {
    var listFile = getListFilename();
    var fileContents = JSON.stringify(list,null,2);
    fs.writeFileSync(listFile,fileContents);
  }

  function initialiseNotifications(manager){

    // Register the notifications dashboard module
    try {
      var dashboard = require("webinos-dashboard");
      dashboard.registerModule("notifications","Notifications", path.join(__dirname,"./dashboard/"));
    } catch (e) {
      // ignore.
    }

    // Create notification handlers.
    var notificationConfig = manager.getConfig();
    var utilities = require("webinos-utilities");
    utilities.webinosId.fetchWebinosName("Pzp",null, function(entName) {
      if (!notificationConfig.promptNotification || !notificationConfig.promptNotification.devices.hasOwnProperty(entName) || notificationConfig.promptNotification.devices[entName] === true) {
        var promptHandler = new utilities.webinosNotifications.PromptHandler(notificationConfig.promptNotification);
      }
      if (notificationConfig.trayNotification && notificationConfig.trayNotification.devices.hasOwnProperty(entName) && notificationConfig.trayNotification.devices[entName]) {
        var trayHandler = new utilities.webinosNotifications.TrayHandler(notificationConfig.trayNotification);
      }
      if (notificationConfig.emailNotification && notificationConfig.emailNotification.devices.hasOwnProperty(entName) && notificationConfig.emailNotification.devices[entName]) {
        var emailHandler = new utilities.webinosNotifications.EmailHandler(notificationConfig.emailNotification);
      }
    });
  }

  var NotificationManager = function() {
    var _self = this;

    eventEmitter.call(this);
    this.notifyType = {
      all: "all",
      notification: "notification",
      permissionRequest: "permissionRequest",
      permissionResponse: "permissionResponse",
      connectionRequest: "connectionRequest",
      sync: "sync"
    };

    process.nextTick(function() { initialiseNotifications(_self); });
  };

  util.inherits(NotificationManager, eventEmitter);

  NotificationManager.prototype.getConfig = function() {
    var list = loadList();
    if (typeof list.config === "undefined") {
      list.config = { };
    }
    return list.config;
  };

  // Retrieve a specific notification from the list
  NotificationManager.prototype.getNotification = function(id) {
    var list = loadList();

    var notify;
    if (list.notifications.hasOwnProperty(id)) {
      notify = list.notifications[id];
    }

    return notify;
  };

  // Retrieve all notifications (optionally of a given type)
  NotificationManager.prototype.getNotifications = function(type) {
    var list = loadList();

    var lst = { notifications: {}};

    for (var id in list.notifications) {
      if (list.notifications.hasOwnProperty(id) && (typeof type === "undefined" || type === "" || list.notifications[id].type === type)) {
        lst.notifications[id] = list.notifications[id];
      }
    }

    lst.config = list.config;

    return lst;
  };

  NotificationManager.prototype.addNotification = function(type,data) {
    locked = true;

    var notify = {};

    try {
      var list = loadList();

      console.log("NOTIFICATIONS - adding: " + util.inspect(data));

      notify.id = uuid.v1();
      notify.timestamp = new Date();
      notify.type = type;
      notify.data = data;
      list.notifications[notify.id] = notify;
      saveList(list);

      this.emit(notify.type, notify);
      this.emit(this.notifyType.all, notify);
    } catch (e) {
      console.log("error during notificationManger.addNotification: " + e.message);
    } finally {
      locked = false;
    }

    return notify;
  };

  // Remote initiated sync occurred (we received updates from PZH)
  NotificationManager.prototype.updateAfterRemoteSync = function(remoteList) {
    var syncList = loadList();
    var newItems = [];

    for (var nId in remoteList.notifications) {
      if (remoteList.notifications.hasOwnProperty(nId) && !syncList.notifications.hasOwnProperty(nId)) {
        // Notification not found in sync list - add it.
        var notify = remoteList.notifications[nId];
        console.log("NOTIFICATION - sync adding: " + util.inspect(notify));
        syncList.notifications[nId] = notify;
        newItems.push(notify);
      }
    }

    var configDirty = false;
    if (typeof remoteList.config !== "undefined") {
      if (!syncList.hasOwnProperty("config")) {
        syncList.config = {};
      }

      for (var cfg in remoteList.config) {
        if (syncList.config.hasOwnProperty(cfg)) {
          if (syncList.config[cfg].hasOwnProperty("isNew") && syncList.config[cfg].isNew) {
            console.log("NOTIFICATION - sync skipping config property '" + cfg + "' which has been modified locally");
          } else {
            if (syncList.config[cfg].hasOwnProperty("devices")) {
              console.log("NOTIFICATION - sync updating device list for config property '" + cfg + "'");
              syncList.config[cfg] = remoteList.config[cfg];
              configDirty = true;
            }
          }
        } else {
          console.log("NOTIFICATION - sync adding config property '" + cfg + "' ");
          syncList.config[cfg] = remoteList.config[cfg];
          configDirty = true;
        }
      }
    }

    if (configDirty || newItems.length > 0) {
      saveList(syncList);

      for (var n in newItems) {
        this.emit(notify.type, newItems[n]);
        this.emit(this.notifyType.all, newItems[n]);
      }
    }

    return configDirty || newItems.length > 0;
  };

  exports.setFilePath = function(fp) { filePath = fp; };
  exports.notificationManager = new NotificationManager();
  exports.PromptHandler = require("./notification-handlers/promptNotificationHandler/promptHandler").Handler;
  exports.TrayHandler = require("./notification-handlers/trayNotificationHandler/trayHandler").Handler;
  exports.EmailHandler = require("./notification-handlers/emailNotificationHandler/emailHandler").Handler;

})(module.exports);
