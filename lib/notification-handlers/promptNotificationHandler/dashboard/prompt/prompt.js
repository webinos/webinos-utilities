(function() {

var UIdata = {};
var zoneService;
var notifyId;
var promptResponse;
function setData(args){
    //
    // Set prompt choices based on the following:
    // 0 = "Deny always";
    // 1 = "Deny for this session";
    // 2 = "Deny this time";
    // 3 = "Allow this time";
    // 4 = "Allow for this session";
    // 5 = "Allow always";

    var choices;
    switch (args["promptType"]) {
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

    notifyId = args["notifyId"];

    UIdata.user = {
        name: args["user"],
        email: "",
        img: "userPlaceholder.png",
        lastAccess: null
    };
    UIdata.permissions = {
        category: args["feature"],
        name: "request access",
        desc: "",
        permission: 0,
        required: true,
        choices: choices.split("|")
    };

    drawPrompts();
    
    $("#loading").addClass("hidden");
    $("#promptContainerContent").removeClass("hidden");

    if (args.hasOwnProperty("timeout")) {
    setTimeout(function() { window.close(); } , args["timeout"]);
}
}

function initialiseModule() {
  var args = {};
  if (window.location.search !== "") {
    // Get data from dashboard.
    webinos.dashboard.getData(
        function(tokenData){
            setData(tokenData);
        },
        function(){
        alert("Error getting dashboard data");
        }
    );
  } else if (window.location.hash !== "") {
    // Get data from notification.
    findZoneService(function() {
      var notifyId = window.location.hash.substr(1);
      zoneService.getNotification(notifyId, function(notification) {
        if (typeof notification !== "undefined") {
          setData(      {
            promptType: notification.data.promptType,
            notifyId: notification.id,
            user: notification.data.request.subjectInfo.userId,
            feature: notification.data.request.resourceInfo.apiFeature
          });
  }
      });
    });
	} else {
    $("#promptContainer").html("<p>No prompt data found.</p>")
	}
}

/* DRAW */
var objectsForLater = {}; //a place to gather all objects that I'm going to iterate later (onclick active class, and so on)

var drawPrompts = function() {
  $("#promptContinueButton").click(doContinue);

  $(".requestingUserName").html(UIdata.user.name);
  $(".requestingUserImage").attr("src",'prompt/img/'+UIdata.user.img);
  $(".requestedServiceAddress").html(UIdata.permissions.category);

    var choices = UIdata.permissions.choices;
      var buttonList = [];

      for (var choiceIdx = 0; choiceIdx < choices.length; choiceIdx++) {
        var choice = parseInt(choices[choiceIdx]);
        var n = "", c = "";
        switch (choice) {
          case 0:
            n = "Deny always";
            c = "deny";
            break;
          case 1:
            n = "Deny this session";
            c = "deny";
            break;
          case 2:
            n = "Deny this time";
            c = "deny";
            break;
          case 3:
            n = "Allow this time";
            c = "allow";
            break;
          case 4:
            n = "Allow this session";
            c = "allow";
            break;
          case 5:
            n = "Allow always";
            c = "allow";
            break;
          default:
            n = "!unknown prompt!";
            c = "deny";
            break;
        }
        buttonList.push({n: n, c: c, prompt: choice });
      }    
    
		drawPermissionButtons(buttonList, UIdata.permissions.permission);
	}

webinos.session.addListener('registeredBrowser', initialiseModule)

function drawPermissionButtons(buttons, active) {
	var docFragment = document.createDocumentFragment();
	var buttonObjList = objectsForLater["permissions-controls"] = []; //if the container has no id, clicking will not work
	var tmpBtnObj;

	for (var i = 0; i < buttons.length; i++) {
		tmpBtnObj = document.createElement("div");
		tmpBtnObj.innerHTML = buttons[i].n;
		tmpBtnObj.className = "button permissionButton "+buttons[i].c;
     tmpBtnObj.id = "prompt-" + buttons[i].prompt;

		tmpBtnObj.onclick = (function(buttons, clickedEl) {
			return function() {
				selectItem(buttons, clickedEl);
			};
		})("permissions-controls", i);

		docFragment.appendChild(tmpBtnObj);
		buttonObjList.push(tmpBtnObj);
	}

	//set active button
	if(!active) {
		var active = 0;
	}
	$(buttonObjList[active]).addClass('selected');

	//set class for number of buttons
	$(".permissions-controls").addClass('noOfButtons' + buttons.length);

	$(".permissions-controls").append(docFragment);
}

function selectItem(elements, active) {
	if(typeof elements == 'string') {
		elements = objectsForLater[elements];
	} else if(typeof elements != 'object' || (typeof elements == 'object' && isNaN(elements.length)) ) { //not an array
		console.log("selectItem: bad object type");
	}

	for(var i in elements) {
		if(i == active) {
        promptResponse = elements[i].id.split('-')[1];
			$(elements[i]).addClass('selected');
			continue;
		}
		$(elements[i]).removeClass('selected');
	}
}

function doContinue() {
  var reply = -1;
  
  if (typeof promptResponse !== "undefined") {
    reply = promptResponse;
  }

  if (window.location.hash === "") {
    // Send response back to dashboard.
  webinos.dashboard.actionComplete({ responseTo: notifyId, decision: reply });
    setTimeout(function() { window.close(); }, 500);
  } else {
    zoneService.addNotification("permissionResponse", { responseTo: notifyId, response: reply }, function(responseNotification) {
      window.location = "/dashboard/notifications";
    });
  }
}

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

}())