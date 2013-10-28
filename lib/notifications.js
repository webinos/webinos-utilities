(function(exports) {
  var fs = require('fs');
  var path = require('path');
  var logger = require("./logging.js")(__filename);
  var eventEmitter = require('events').EventEmitter;
  var util = require('util');
  var uuid = require('node-uuid');
  var existsSync = fs.existsSync || path.existsSync;

  var NotificationManager = function(parent) {
    var _self = this;

    this.parent = parent;

    // Register to receive updates for notification actions.
    this.parent.registerActionProcessor("notification", actionProcessor.bind(this));

    eventEmitter.call(_self);

    // Known notification types.
    _self.notifyType = {
      all: "all",
      permissionRequest: "permissionRequest",
      permissionResponse: "permissionResponse",
      trustedZone: "trustedZone",
      untrustedZone: "untrustedZone",
      zoneConnectionAccepted: "zoneConnectionAccepted",
      zoneConnectionRejected: "zoneConnectionRejected"
    };

    _self.notificationHandlers = {};

    process.nextTick(function() { _self.initialiseNotifications(); });
  };

  util.inherits(NotificationManager, eventEmitter);

  // Handle notification actions from other entities.
  var actionProcessor = function(action) {
    var localList = this.loadList();
    var localNotifications = localList.notifications;
    var notify = action.payload;

    this.delayEmits();

    var dirty = false;
    switch (action.action) {
      case "add":
        if (!localNotifications.hasOwnProperty(notify.id)) {
          logger.log("SYNC adding: " + util.inspect(notify));
          localNotifications[notify.id] = notify;
          this.newItems.push(notify);
          dirty = true;
        } else {
          logger.error("SYNC new notification already exists: " + notify.id);
        }
        break;
      case "delete":
        if (localNotifications.hasOwnProperty(notify)) {
          logger.log("SYNC deleting: " + util.inspect(notify));
          delete localNotifications[notify];
          dirty = true;
        } else {
          logger.error("SYNC notification for deletion not found: " + notify);
        }
        break;
    }

    if (dirty) {
      this.saveList(localList);
    }
  }

  NotificationManager.prototype.delayEmits = function() {
    if (typeof this.delayed === "undefined" || this.delayed === false) {
      var _self = this;
      _self.delayed = true;
      _self.newItems = [];
      process.nextTick(function() {
        for (var n = 0; n < _self.newItems.length; n++) {
          _self.emit(_self.newItems[n].type, _self.newItems[n]);
          _self.emit(_self.notifyType.all, _self.newItems[n]);
        }
        _self.newItems = [];
        _self.delayed = false;
      });
    }
  }

  NotificationManager.prototype.getListFilename = function() {
    return path.join(this.parent.getMetaData("webinosRoot"),"userData", "notifications.json");
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
    // Register the notifications dashboard module
    try {
      var dashboard = require("webinos-dashboard");
      dashboard.registerModule("notifications","Notifications", path.join(__dirname,"./notification-dashboard/"));
    } catch (e) {
      logger.log("failed to register notifications dashboard module");
    }

    this.createNotificationHandlers();
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
      logger.log("started " + handlerName + " notification handler");
    }

    return handler;
  }

  NotificationManager.prototype.createNotificationHandlers = function() {
    var _self = this;

    // Create notification handlers.
    var notificationConfig = _self.getConfig();
    if (_self.parent.getMetaData("webinosType") === "Pzp") {
      // Running on PZP - get the pzp name to look-up config values.
      var entName = _self.parent.getMetaData("webinosName");

      // Only issue prompt and tray notifications on PZPs
      var PromptHandler = require("./notification-handlers/promptNotificationHandler/promptHandler").Handler;
      _self.addPZPHandler("promptNotification", PromptHandler, entName, true);

      var TrayHandler = require("./notification-handlers/trayNotificationHandler/trayHandler").Handler;
      _self.addPZPHandler("trayNotification", TrayHandler, entName);
    } else {
      // Only issue e-mail, SMS and voice notifications from PZH.
      var EmailHandler = require("./notification-handlers/emailNotificationHandler/emailHandler").Handler;
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

      // Update PZH.
      this.parent.addAction("notification","add", notify);
    } catch (e) {
      logger.log("error during notificationManger.addNotification: " + e.message);
    } finally {
    }

    return notify;
  };

  NotificationManager.prototype.deleteNotification = function(id) {
    var list = this.loadList();

    var notify;
    if (list.notifications.hasOwnProperty(id)) {
      notify = list.notifications[id];
      delete list.notifications[id];
      this.saveList(list);

      this.parent.addAction("notification","delete",notify.id);
    }

    return notify;
  };

  /***
   *
   * ZoneNotificationService
   */

  var RPCWebinosService = require("webinos-jsonrpc2").RPCWebinosService;

  var ZoneNotificationsService = function(rpcHandler, params) {
    // inherit from RPCWebinosService
    this.base = RPCWebinosService;
    this.base({
      api:'http://webinos.org/api/zonenotifications',
      displayName:'ZoneNotifications',
      description:'ZoneNotifications Module.'
    });
    this.pzpObject = params.pzpObject;
  };

  ZoneNotificationsService.prototype = new RPCWebinosService;

  /**
   * Get the value of an internal property and whatever was sent as params.
   * @param params Array with parameters.
   * @param successCB Success callback.
   * @param errorCB Error callback.
   */
  ZoneNotificationsService.prototype.getNotifications = function(params, successCB, errorCB) {
    logger.log("getNotifications was invoked");
    var lst = this.pzpObject.notificationManager.getNotifications();
    process.nextTick(function() { successCB(lst); });
  }

  ZoneNotificationsService.prototype.getNotification = function(params, successCB, errorCB) {
    logger.log("getNotification was invoked");
    var notification = this.pzpObject.notificationManager.getNotification(params[0]);
    process.nextTick(function() { successCB(notification) });
  }

  ZoneNotificationsService.prototype.addNotification = function(params, successCB, errorCB) {
    logger.log("addNotification was invoked");
    var type = params[0];
    var data = params[1];
    var notification = this.pzpObject.notificationManager.addNotification(type,data);
    if (typeof notification !== "undefined" && typeof successCB === "function") {
      process.nextTick(function() { successCB(notification) });
    } else if (typeof errorCB === "function") {
      process.nextTick(function() { errorCB("failed to create notification"); });
    }
  }

  ZoneNotificationsService.prototype.deleteNotification = function(params, successCB, errorCB) {
    logger.log("deleteNotification was invoked");
    var notification = this.pzpObject.notificationManager.deleteNotification(params[0]);
    if (typeof successCB === "function") {
      process.nextTick(function() { successCB(notification) } );
    }
  }

  exports.NotificationManager = NotificationManager;
  exports.NotificationService = ZoneNotificationsService;

})(module.exports);