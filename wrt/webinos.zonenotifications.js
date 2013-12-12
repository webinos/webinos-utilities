/*******************************************************************************
*  Code contributed to the webinos project
* 
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*  
*     http://www.apache.org/licenses/LICENSE-2.0
*  
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
* 
* Copyright 2013 Toby Ealden
******************************************************************************/
(function() {

	/**
	 * Webinos Get42 service constructor (client side).
	 * @constructor
	 * @param obj Object containing displayName, api, etc.
	 */
	ZoneNotificationsModule = function(obj) {
		WebinosService.call(this, obj);
		
		this._testAttr = "HelloWorld";
		this.__defineGetter__("testAttr", function (){
			return this._testAttr + " Success";
		});
	};
	// Inherit all functions from WebinosService
	ZoneNotificationsModule.prototype = Object.create(WebinosService.prototype);
	// The following allows the 'instanceof' to work properly
	ZoneNotificationsModule.prototype.constructor = ZoneNotificationsModule;
	// Register to the service discovery
	_webinos.registerServiceConstructor("http://webinos.org/api/zonenotifications", ZoneNotificationsModule);
	
	/**
	 * To bind the service.
	 * @param bindCB BindCallback object.
	 */
	ZoneNotificationsModule.prototype.bindService = function (bindCB, serviceId) {
		// actually there should be an auth check here or whatever, but we just always bind
		this.getNotifications = getNotifications;
    this.getNotification = getNotification;
    this.addNotification = addNotification;
    this.deleteNotification = deleteNotification;
    this.notificationResponse = notificationResponse;
		this.listenAttr = {};
		this.listenerFor42 = listenerFor42.bind(this);
		
		if (typeof bindCB.onBind === 'function') {
			bindCB.onBind(this);
		};
	}
	
	/**
	 * Get 42.
	 * An example function which does a remote procedure call to retrieve a number.
	 * @param attr Some attribute.
	 * @param successCB Success callback.
	 * @param errorCB Error callback. 
	 */
	function getNotifications(attr, successCB, errorCB) {
		var rpc = webinos.rpcHandler.createRPC(this, "getNotifications", [attr]);
		webinos.rpcHandler.executeRPC(rpc,
				function (params){
					successCB(params);
				},
				function (error){
					errorCB(error);
				}
		);
	}

  function notificationResponse(responseTo, response, successCB, errorCB) {
    var rpc = webinos.rpcHandler.createRPC(this, "notificationResponse", [responseTo, response]);
    webinos.rpcHandler.executeRPC(rpc,
      function (params){
        successCB(params);
      },
      function (error){
        errorCB(error);
      }
    );
  }

  function getNotification(id, successCB, errorCB) {
    var rpc = webinos.rpcHandler.createRPC(this, "getNotification", [id]);
    webinos.rpcHandler.executeRPC(rpc,
      function (params){
        successCB(params);
      },
      function (error){
        errorCB(error);
      }
    );
  }

  function addNotification(type,data,successCB,errorCB) {
    var rpc = webinos.rpcHandler.createRPC(this, "addNotification", [type, data]);
    webinos.rpcHandler.executeRPC(rpc,
      function (params){
        if (typeof successCB === "function") {
          successCB(params);
        }
      },
      function (error){
        if (typeof errorCB === "function") {
          errorCB(error);
        }
      }
    );
  }

  function deleteNotification(id,successCB,errorCB) {
    var rpc = webinos.rpcHandler.createRPC(this, "deleteNotification", [id]);
    webinos.rpcHandler.executeRPC(rpc,
      function (params){
        if (typeof successCB === "function") {
          successCB(params);
        }
      },
      function (error){
        if (typeof errorCB === "function") {
          errorCB(error);
        }
      }
    );
  }

	/**
	 * Listen for 42.
	 * An exmaple function to register a listener which is then called more than
	 * once via RPC from the server side.
	 * @param listener Listener function that gets called.
	 * @param options Optional options.
	 */
	function listenerFor42(listener, options) {
		var rpc = webinos.rpcHandler.createRPC(this, "listenAttr.listenFor42", [options]);

		// add one listener, could add more later
		rpc.onEvent = function(obj) {
			// we were called back, now invoke the given listener
			listener(obj);
			webinos.rpcHandler.unregisterCallbackObject(rpc);
		};

		webinos.rpcHandler.registerCallbackObject(rpc);
		webinos.rpcHandler.executeRPC(rpc);
	}
	
}());