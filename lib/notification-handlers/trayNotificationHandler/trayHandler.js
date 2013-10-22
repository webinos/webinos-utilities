(function() {
  var TrayHandler = function(notificationManager) {
    var webinosPath = require('../../webinosPath.js').webinosPath();
    var fs = require('fs');
    var path = require('path');

    var onNotify = function(notify) {
      var msg;

      switch (notify.type) {
        case notificationManager.notifyType.permissionRequest:
          msg = "User " +  notify.data.request.subjectInfo.userId + " has requested access to " + notify.data.request.resourceInfo.apiFeature;
          break;
        case notificationManager.notifyType.permissionResponse:
          var responseTo = notificationManager.getNotification(notify.data.responseTo);
          if (typeof responseTo !== "undefined") {
            var response;
            if (parseInt(notify.data.response) > 2) {
              response = "permitted";
            } else  {
              response = "denied"
            }
            msg = "User " +  responseTo.data.request.subjectInfo.userId + " was " + response + " access to " + responseTo.data.request.resourceInfo.apiFeature;
          }
          break;
        case notificationManager.notifyType.untrustedZone:
          msg = notify.data.zone + " has requested to connect to your zone";
          break;
        case notificationManager.notifyType.trustedZone:
          msg = notify.data.zone + " is now trusted and connected to your zone."
          break;
        case notificationManager.notifyType.zoneConnectionAccepted:
          msg = notify.data.zone + " has accepted your zone connection request";
          break;
        default:
          break;
      }

      if (typeof msg !== "undefined") {
        var uuid = require("node-uuid");
        var file = path.join(webinosPath,"wrt",uuid.v1() + ".notify");
        fs.writeFileSync(file,msg);
      }
    };

    // Listen for **all** notifications
    notificationManager.on(notificationManager.notifyType.all, onNotify);

    this.removeNotify = function() {
      notificationManager.removeListener(notificationManager.notifyType.all, onNotify);
    }
  }

  exports.Handler = TrayHandler;
})()