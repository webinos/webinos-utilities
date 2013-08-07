(function() {
  var EmailHandler = function(config) {
    var notificationManager = require('webinos-utilities').webinosNotifications.notificationManager;

    // Add listener to receive notification of permission requests.
    notificationManager.on(notificationManager.notifyType.permissionRequest, function(notify) {
      // Received notification.
      // Send e-mail
      var email = require("emailjs");
      var server  = email.server.connect(config.auth);

      // Send the message and get a callback with an error or details of the message that was sent.
      server.send({
        text:    "user " + notify.data.request.subjectInfo.userId + " has requested permission to access feature: " + notify.data.request.resourceInfo.apiFeature,
        from:    "webinos",
        to:      config.email,
        cc:      "",
        subject: "new permission request"
      }, function(err, message) { console.log(err || message); });
    });
  }

  exports.Handler = EmailHandler;
})()