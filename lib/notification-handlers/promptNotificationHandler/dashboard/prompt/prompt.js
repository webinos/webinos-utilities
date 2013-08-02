var UIdata = {};

/* WIDGET */
var notifyId;
var promptResponse;
function setData(args){
    notifyId = args["notifyId"];

    UIdata.user = {
        name: args["user"],
        email: "",
        img: "userPlaceholder.png",
        lastAccess: null
    };
    UIdata.permissions = [{
        category: args["feature"],
        name: "request access",
        desc: "",
        permission: 0,
        required: true,
        choices: args["choices"].split("|")
    }];

    drawPrompts();
    
    addClass("loading","hidden");
    removeClass("user-permission-list-container-content","hidden");

    setTimeout(function() { window.close(); } , args["timeout"]);
}

function initialiseWidget() {
  var args = {};
  if (typeof widget !== 'undefined'){
    args.prompt = widget.args["prompt"];
    args.user = widget.args["user"];
    args.feature = widget.args["feature"];
    args.choices = widget.args["choices"];
    args.timeout = widget.args["timeout"];
    setData(args);
  }else{
    webinos.dashboard.getData(
        function(tokenData){
            setData(tokenData);
        },
        function(){
            var args = {};
            if (typeof widget !== 'undefined'){
                args.prompt = widget.args["prompt"];
                args.user = widget.args["user"];
                args.feature = widget.args["feature"];
                args.choices = widget.args["choices"];
                args.timeout = widget.args["timeout"];
                setData(args);
            }
        }
    );
  }
}

/* GENERAL */

function removeClass(element, className) {
	if(typeof element != 'object') element = document.getElementById(element);
	var classString = element.className;
	var newClassString = '';
	var indexPos = classString.indexOf(className);
	if(indexPos == -1) {
		return;
	} else if (indexPos == 0) {
		newClassString = classString.substring(0, indexPos) + classString.substr(indexPos+className.length);
	} else {
		newClassString = classString.substring(0, indexPos-1) + classString.substr(indexPos+className.length);
	}

	element.className = newClassString;
}

function addClass(element, className) {
	if(typeof element != 'object') element = document.getElementById(element);
	var classString = element.className;
	if(classString != '') {
		var indexPos = classString.indexOf(className);
		if(indexPos == -1) {
			element.className += ' '+className;
		}
	} else {
		element.className = className;
	}
}

/* DRAW */
var objectsForLater = {}; //a place to gather all objects that I'm going to iterate later (onclick active class, and so on)

var drawPrompts = function() {
   var newUserReqContinue = document.getElementById('newUserReqContinue');
   newUserReqContinue.onclick = function() {
    doContinue();
   };

	document.getElementById('newUserReqName').innerHTML = UIdata.user.name;
	document.getElementById('newUserReqNameInfo1').innerHTML = UIdata.user.name;
	document.getElementById('newUserReqNameInfo2').innerHTML = UIdata.user.name;
	document.getElementById('newUserReqImg').src = 'prompt/img/'+UIdata.user.img;

	var permissionsListContainer = document.getElementById('user-permission-list-container'),
		permissions = UIdata.permissions,
		i = 0,
		j = permissions.length;

	for(i; i<j; i++) {
		var category = document.createElement("h1");
		category.innerHTML = permissions[i].category;
		permissionsListContainer.appendChild(category);

      var choices = permissions[i].choices;
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
    
		var permControls = document.createElement("div");
		permControls.className = "permissions-controls";
		permControls.id = "permButtons"+i;
		drawPermissionButtons(permControls,  buttonList, permissions[i].permission);
		permissionsListContainer.appendChild(permControls);
	}
}

webinos.session.addListener('registeredBrowser', initialiseWidget);

function drawPermissionButtons(container, buttons, active) {
	if(typeof container != 'object') container = document.getElementById(container);

	var docFragment = document.createDocumentFragment();
	var buttonObjList = objectsForLater[container.id] = []; //if the container has no id, clicking will not work
	var tmpBtnObj;
	var i = 0,
		j = buttons.length;

	for(i;i<j;i++) {
		tmpBtnObj = document.createElement("div");
		tmpBtnObj.innerHTML = buttons[i].n;
		tmpBtnObj.className = "button permissionButton "+buttons[i].c;
     tmpBtnObj.id = "prompt-" + buttons[i].prompt;

		tmpBtnObj.onclick = (function(buttons, clickedEl) {
			return function() {
				selectItem(buttons, clickedEl);
			};
		})(container.id, i);

		docFragment.appendChild(tmpBtnObj);
		buttonObjList.push(tmpBtnObj);
	}

	//set active button
	if(!active) {
		var active = 0;
	}
	addClass(buttonObjList[active], 'selected');

	//set class for number of buttons
	addClass(container, 'noOfButtons'+j);

	container.appendChild(docFragment);
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
			addClass(elements[i], 'selected');
			continue;
		}
		removeClass(elements[i], 'selected');
	}
}

function doContinue() {
  var reply = -1;
  
  if (typeof promptResponse !== "undefined") {
    reply = promptResponse;
  }

  webinos.dashboard.actionComplete({ responseTo: notifyId, decision: reply });

  setTimeout(function() { window.close(); }, 500);
}