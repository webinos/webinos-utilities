(function(exports) {
  var util = require("util");

  var ActionHandler = function () {
    "use strict";
    var parent = this;
    var logger = require("./logging.js")(__filename);
    var actionProcessors = {};
    var dBs = {};
    var syncPending = false;
    var uuid = require('node-uuid');

    parent.receivePendingActions = function(receivedMsg) {
      var entityId = receivedMsg.from;
      var actions = receivedMsg.payload.message;

      var acks = [];
      for (var i = 0; i < actions.length; i++) {
        var action = actions[i];
        try {
          addActionInternal(parent.getSessionId(), action);

          if (actionProcessors.hasOwnProperty(action.type)) {
            for (var p in actionProcessors[action.type]) {
              actionProcessors[action.type][p].call(null, action);
            }
          } else {
            logger.log("No processors for action type: " + action.type);
          }

          // Add to acknowledge list.
          acks.push(action.id);

        } catch (e) {
          // ToDo - acknowledge anyway?
          logger.error("Failure during receivePendingActions: " + e.message);
        }
      }

      if (acks.length > 0) {
        sendReceipts(entityId,acks);
      }
    };

    parent.sendPendingActions = function(receivedMsg) {
      sendPendingActionsInternal(receivedMsg.from);
    };

    parent.addAction = function(type, action, payload) {
      var newAction = {
        id: uuid.v1(),
        type: type,
        action: action,
        owner: parent.getSessionId(),
        payload: payload,
        timestamp: new Date()
      };

      addActionInternal(parent.getSessionId(), newAction);
    };

    parent.actionsAcknowledged = function(receivedMsg) {
      actionsAcknowledgedInternal(receivedMsg.from, receivedMsg.payload.message);
    };

    parent.broadcastActions = function() {
      // Update all entities
      var actionTrackingDb = loadActionTracking();
      for (var ent in actionTrackingDb.entities) {
        if (actionTrackingDb.entities.hasOwnProperty(ent) && parent.isConnected(ent)) {
          sendPendingActionsInternal(ent);
        }
      }
    };

    parent.registerActionProcessor = function(type, func) {
      if (!actionProcessors.hasOwnProperty(type)) {
        actionProcessors[type] = [];
      }
      actionProcessors[type].push(func);
    };

    function sendPendingActionsInternal(entityId) {
      // Send all pending actions to this entity.
      var actionTrackingDb = loadActionTracking();
      var actionDb = loadActions();
      var pending = [];

      if (!actionTrackingDb.entities.hasOwnProperty(entityId)) {
        logger.log("Received update request for unknown entity " + entityId + " sending all actions");
        actionTrackingDb.entities[entityId] = { pending: {} };
        for (var action in actionDb.actions) {
          actionTrackingDb.entities[entityId].pending[action] = true;
        }

        saveActionTracking();
      }

      for (var action in actionTrackingDb.entities[entityId].pending) {
        pending.push(actionDb.actions[action]);
      }

      if (pending.length > 0) {
        // Sort in ascending timestamp order.
        pending.sort(function(a,b) {
          var aTS = new Date(a.timestamp);
          var bTS = new Date(b.timestamp);
          return aTS < bTS ? -1 : aTS > bTS ? 1 : 0;
        });
        sendMessage(entityId, "actionsReceivePending", pending);
      }
    }

    function actionsAcknowledgedInternal(entityId, ackList) {
      // Remote entity has acknowledged having processing actions.
      var actionTrackingDb = loadActionTracking();
      var actionDb = loadActions();

      // Update action tracking.
      if (actionTrackingDb.entities.hasOwnProperty(entityId)) {
        for (var ack in ackList) {
          var ackId = ackList[ack];

          // Remove pending flag.
          delete actionTrackingDb.entities[entityId].pending[ackId];

          // Add to acknowledged list.
          if (actionDb.actions.hasOwnProperty(ackId)) {
            actionTrackingDb.acks[ackId][entityId] = true;
          } else {
            logger.error("Received acknowledgement for unknown action " + ackId);
          }
        }

        saveActionTracking();
      } else {
        logger.error("Unknown entity " + entityId);
      }
    }

    function addActionInternal(newOwner, newAction) {
      var actionDb = loadActions();

      newAction.originator = newAction.owner;
      newAction.owner = newOwner;

      actionDb.actions[newAction.id] = newAction;
      saveActions();

      // Set up tracking.
      var actionTrackingDb = loadActionTracking();

      // Flag all entities as needing this update.
      for (var ent in actionTrackingDb.entities) {
        if (ent !== newAction.originator && actionTrackingDb.entities.hasOwnProperty(ent)) {
          actionTrackingDb.entities[ent].pending[newAction.id] = true;
        }
      }

      // Set up acknowledgement receipts for this action.
      actionTrackingDb.acks[newAction.id] = { };
      actionTrackingDb.acks[newAction.id][newAction.originator] = true;

      saveActionTracking();

      triggerSync();
    }

    function triggerSync() {
      // Queue up broadcast event.
      if (syncPending === false) {
        syncPending = true;
        process.nextTick(function() {
          parent.broadcastActions();
          syncPending = false;
        });
      }
    }

    function sendMessage(entityId, status, msg) {
      try {
        var msg = {
          "type":"prop",
          "from": parent.getSessionId(),
          "to": entityId,
          "payload": {
            "status": status,
            "message":msg
          }
        };

        parent.sendMessage(msg, entityId);
      } catch (e) {
        logger.error("Error sending message: " + e.message);
        logger.error(util.inspect(msg));
      }
    }

    function sendReceipts(entityId,ackList) {
      sendMessage(entityId, "actionAck", ackList);
    }

    function loadActions() {
      if (!dBs.hasOwnProperty("actions")) {
        dBs.actions = new actionHelpers.ActionsDb(parent);
      }
      return dBs.actions.loadDb();
    }

    function saveActions() {
      if (dBs.hasOwnProperty("actions")) {
        dBs.actions.saveDb();
      }
    }

    function loadActionTracking() {
      if (!dBs.hasOwnProperty("actionTracking")) {
        dBs.actionTracking = new actionHelpers.ActionTrackingDb(parent);
      }
      return dBs.actionTracking.loadDb();
    }

    function saveActionTracking() {
      if (dBs.hasOwnProperty("actionTracking")) {
        dBs.actionTracking.saveDb();
      }
    }
  };

  var actionHelpers = function() {
    var path = require("path");
    var fs = require("fs");
    var existsSync = fs.existsSync || path.existsSync;

    var Db = function(zoneEntity, name, empty) {
      this.storeFile = path.join(zoneEntity.getMetaData("webinosRoot"),"userData",name + "_db.json");
      this.empty = empty;
    };

    Db.prototype.loadDb = function() {
      if (typeof this.cache === "undefined") {
        if (existsSync(this.storeFile)) {
          this.cache = JSON.parse(fs.readFileSync(this.storeFile));
        } else {
          this.cache = this.empty;
        }
      }
      return this.cache;
    }

    Db.prototype.saveDb = function() {
      if  (typeof this.cache !== "undefined") {
        fs.writeFileSync(this.storeFile,JSON.stringify(this.cache,null,2));
      }
    }

    var ActionsDb = function(zoneEntity) {
      Db.call(this,zoneEntity,"actions",{ actions: {}});
    }

    util.inherits(ActionsDb, Db);

    var ActionTrackingDb = function(zoneEntity) {
      Db.call(this,zoneEntity,"actionTracking",{ entities: {}, acks: {}});
    }
    util.inherits(ActionTrackingDb, Db);

    return {
      ActionsDb: ActionsDb,
      ActionTrackingDb: ActionTrackingDb
    };
  }();

  exports.ActionHandler = ActionHandler;

}(module.exports));