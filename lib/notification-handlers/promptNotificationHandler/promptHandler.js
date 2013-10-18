(function() {
  var PromptHandler = function(notificationManager) {
    var logger = require("../../logging.js")(__filename);
    var promptTimeout = 20000;
    var path = require("path");
    var dashboard;

    try {
      dashboard = require("webinos-dashboard");
    } catch (e) {
      // ignore.
    }

    var onNotify = function(notify) {
      // Received permission request notification - check it's not for the dashboard API.
      if (notify.data.request.resourceInfo.apiFeature === "http://webinos.org/api/dashboard") {
        // Don't prompt for dashboard features - this will result in endless prompting.
        // Dashboard permission should be set in the default policy (for privileged apps).
        logger.error("Prompt ignored for feature " + notify.data.request.resourceInfo.apiFeature);
        return;
      }

      // Check if there's already a response received for this notification (need to optimise this)
      var responses = notificationManager.getNotifications(notificationManager.notifyType.permissionResponse);
      var ignore = false;
      for (var r in responses.notifications) {
        if (responses.notifications[r].data.responseTo === notify.id) {
          ignore = true;
          logger.log("Ignoring permission request (already has response)")
          break;
        }
      }

      // Don't prompt for old permission requests - check notification is recent.
      var notificationTime = new Date(notify.timestamp);
      var elapsedSeconds = (Date.now() - notificationTime.getTime())/1000;
      if (elapsedSeconds > 60) {
        ignore = true;
        logger.log("Ignoring permission request (not recent)")
      }

      if (!ignore) {
        dashboard.open(
          {
            module:"prompt",
            data:{
              promptType: notify.data.promptType,
              notifyId: notify.id,
              user: notify.data.request.subjectInfo.userId,
              feature: notify.data.request.resourceInfo.apiFeature,
              timeout: promptTimeout
            }
          },
          function() {
            logger.log("prompt success callback");
          },
          function(err) {
            logger.log("prompt error callback: " + err.toString());
          },
          function (response){
            logger.log("prompt complete callback: " + JSON.stringify(response));

            var responseTo = response.responseTo;
            var decision = parseInt(response.decision);
            notificationManager.addNotification(notificationManager.notifyType.permissionResponse, { responseTo: responseTo, response: decision });
          }
        );
      }
    };

    if (typeof dashboard !== "undefined") {

      // Register the prompting dashboard module
      dashboard.registerModule("prompt","Policy prompt",path.join(__dirname,"./dashboard/"));

      // Listen for permission request notifications
      notificationManager.on(notificationManager.notifyType.permissionRequest, onNotify);

    } else {
      logger.error("webinos-dashboard not found - can't start prompt handler.");
    }


    this.removeNotify = function() {
      // Remove listener for permission request notifications
      notificationManager.removeListener(notificationManager.notifyType.permissionRequest, onNotify);
    };
  };

  exports.Handler = PromptHandler;

})()