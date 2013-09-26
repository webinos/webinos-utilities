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
            break;
          }
        }
        if (!ignore) {
        //
        // Set prompt choices based on the following:
        // 0 = "Deny always";
        // 1 = "Deny for this session";
        // 2 = "Deny this time";
        // 3 = "Allow this time";
        // 4 = "Allow for this session";
        // 5 = "Allow always";

        var choices;
        switch (notify.data.promptType) {
          case 2:
            //Prompt oneshot
            choices = "0|2|3";
            break;
          case 3:
            //Prompt session
            choices = "0|1|2|3|4";
            break;
          default:
            //Prompt blanket
            choices = "0|1|2|3|4|5";
            break;
        }

        dashboard.open(
          {
            module:"prompt",
            data:{
              choices: choices,
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