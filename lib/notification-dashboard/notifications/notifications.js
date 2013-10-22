(function() {
  var types;
  var permissionResponses;
  var zoneService;
  var typeLookup = {
    permissionRequest: {
      displayName: "permission request",
      displayFunc: permissionRequest
    },
    untrustedZone: {
      displayName: "friend request",
      displayFunc: untrustedZone
    },
    trustedZone: {
      displayName: "approved friend",
      displayFunc: trustedZone
    }
  };
  var permissionResponseText = {
    0: "deny always",
    1: "deny for this session",
    2: "deny this time",
    3: "allow this time",
    4: "allow for this session",
    5: "allow always"
  };

  $(function() {
    initialise("permissionRequest");
  });

  function findZoneService(cb) {
    webinos.discovery.findServices(new ServiceType("http://webinos.org/api/zonenotifications"), {
      onFound: function (service) {
        // Only interested in local API
        if (service.serviceAddress === webinos.session.getPZPId()) {
          service.bindService({
            onBind: function(svc) { zoneService = svc; cb(); }
          });
        }
      },
      onError: function(err) {
        console.error("failed to find notifications service: " + err.message);
        cb();
      }
    });
  }

  function initialise(type){
    $(document).on("change","#typeList", function() {
      queryService($("#typeList option:selected").val());
    });

//    $(document).on("click", ".approveFriendLink", function() {
//      var nid = this.id.split('_')[1];
//      approveFriendRequest(nid);
//      return false;
//    });

    $(document).on("click", ".permissionResponseLink", function() {
      var nid = this.id.split('_')[1];
      respondToPermissionRequest(nid);
      return false;
    });

    $(document).on("click", ".deleteNotificationLink", function() {
      var nid = this.id.split('_')[1];
      deleteNotification(nid);
      return false;
    });

    findZoneService(function() {
      queryService("permissionRequest");
    });
  }

  function queryService(type) {
    $("#loading").show();
    $("#content").hide();

    if (typeof zoneService !== "undefined") {
      zoneService.getNotifications(123,
        function(result) {
          loadList(result.notifications,type);
        },
        function() {
          console.log("failed");
        }
      );
    } else {
      console.error("no zone service");
    }
  }

  function loadList(lst,type) {
    $("#content").html("");
    if (!$.isEmptyObject(lst)) {
      $("#content").append("select notification type <select id='typeList'><option>[select...]</option></select><ul id='notificationList'></ul>");
      types = {};
      permissionResponses = {};
      for (var n in lst) {
        if (lst.hasOwnProperty(n)) {
          var notification = lst[n];
          if (notification.type === "permissionResponse") {
            permissionResponses[notification.data.responseTo] = notification;
          } else {
            console.log("notification type " + notification.type + " with id " + notification.id);
            if (!types.hasOwnProperty(notification.type)) {
              types[notification.type] = [];
            }
            types[notification.type].push(notification);
          }
        }
      }

      var selectLst = $("#typeList");
      selectLst.html("");
      for (var t in types) {
        if (typeLookup.hasOwnProperty(t)) {
          selectLst.append("<option value=" + t + ">" + typeLookup[t].displayName + "</option>");
        } else {
          selectLst.append("<option value=" + t + ">" + t + "</option>");
        }
        types[t].sort(function(a,b) {
          var aTS = new Date(a.timestamp);
          var bTS = new Date(b.timestamp);
          return aTS > bTS ? -1 : aTS < bTS ? 1 : 0;
        });
      }

      if (typeof type !== "undefined") {
        listNotifications(type);
      }
    } else {
      $("#content").html("<p>You currently have no notifications.</p>");
    }

    $("#content").show();
    $("#loading").hide();
  }

  function listNotifications(type) {
    $("#typeList").val(type);
    $("#notificationList").html("");

    for (var n in types[type]) {
      var notification = types[type][n];
      var notificationText;
      if (typeLookup.hasOwnProperty(notification.type)) {
        notificationText = typeLookup[notification.type].displayFunc(notification);
      } else {
        notificationText = notification.id;
      }
      notificationText = notificationText + "<div class='commandBar'><a id='nid_" + notification.id + "' class='deleteNotificationLink' href='#'>delete</a></div>"
      var ts = moment(notification.timestamp).format("MMM Do YYYY HH:mm:ss");
      $("#notificationList").append("<li><div class='timestamp'>" + ts + "</div>" + notificationText + "</li>")
    }
  }

  function permissionRequest(notification) {
    if (permissionResponses.hasOwnProperty(notification.id)) {
      var response = permissionResponses[notification.id];
      return notification.data.request.subjectInfo.userId + " requested access to " + notification.data.request.resourceInfo.apiFeature + "<br/>Response was <span class='permissionResponse'>" + permissionResponseText[response.data.response] + "</span>";
    } else {
      return notification.data.request.subjectInfo.userId + " requesting access to " + notification.data.request.resourceInfo.apiFeature + "<br/><a id='nid_" + notification.id + "' href='/dashboard/prompt#" + notification.id + "'>respond now</a>";
    }
  }

  function untrustedZone(notification) {
    var txt = notification.data.zone + " requesting access to your zone.<br />";
    var connected = webinos.session.getConnectedDevices();
    var isConnected = false;
    for (var d in connected) {
      if (connected.hasOwnProperty(d) && connected[d].id === notification.data.zone) {
        isConnected = true;
        break;
      }
    }

    if (!isConnected) {
      txt += "<a id='nid_" + notification.id + "' class='approveFriendLink' href='" + webinos.session.getPzhWebAddress() + "approveUser'>Approve</a>";
    } else {
      txt += "This zone is now trusted and has access to your zone."
    }

    return txt;
  }

  function trustedZone(notification) {
    return notification.data.zone + " is now trusted and connected to your zone";
  }

  // Post a request to approve the request.
  function approveFriendRequest(notificationId) {
    var url = webinos.session.getPzhWebAddress() + "dashboard/approve/" + webinos.session.getPZHId() + "/" + notificationId;
    $.ajax(url,
      {
        success: function(data, status, xhr) {
          if (data.message === true) {
            queryService("untrustedZone");
          } else {
            alert("Sorry, failed to approve request.\r\n\r\nCheck your network connection.");
          }
        } ,
        error: function(xhr,status,err) {
          alert("error: " + err);
        }
      });
  }

  function respondToPermissionRequest(notificationId) {
    zoneService.addNotification("permissionResponse", { responseTo: notificationId, response: 3 })
  }

  function deleteNotification(notificationId) {
    zoneService.deleteNotification(notificationId, function(deleted) {
      queryService(deleted.type);
    });
  }
}());
