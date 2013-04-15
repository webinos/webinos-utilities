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
 * Copyright 2011 Alexander Futasz, Fraunhofer FOKUS
 ******************************************************************************/
(function () {
	var RPCWebinosService = require("webinos-jsonrpc2").RPCWebinosService;
	var logger = require("webinos-utilities").webinosLogging(__filename);

	var idCount = 0;

	/**
	 * Creates a new unique identifier to be used for RPC requests and responses.
	 * @function
	 * @private
	 */
	var getNextID = function(sessionId) {
		if (idCount == Number.MAX_VALUE) idCount = 0;
		idCount++;
		return sessionId + idCount;
	}

	/**
	 * Webinos ServiceDiscovery service constructor (server side).
	 * @constructor
	 * @alias Discovery
	 * @param rpcHandler A handler for functions that use RPC to deliver their result.
	 */
	var Discovery = function(rpcHandler, params) {
		// inherit from RPCWebinosService
		this.base = RPCWebinosService;
		this.base({
			api: 'ServiceDiscovery',
			displayName: 'ServiceDiscovery',
			description: 'Webinos ServiceDiscovery'
		});

		/**
		 * Registry of registered RPC objects.
		 */
		this.registry = params[0];

		/**
		 * RPC handler
		 */
		this.rpcHandler = rpcHandler;

		/**
		 * Holds other Service objects, not registered here. Only used on the
		 * PZH.
		 */
		this.remoteServiceObjects = [];

		/**
		 * Holds callbacks for findServices callbacks from the PZH
		 */
		this.remoteServicesFoundCallbacks = {};

		if (typeof this.rpcHandler.parent !== 'undefined') {
			var that = this;
			if(!logger.id) logger.addId(this.rpcHandler.parent.getSessionId());
			// add listener to pzp object, to be called when remote services
			// are returned by the pzh
			this.rpcHandler.parent.addRemoteServiceListener(function (payload) {
 				var callback = that.remoteServicesFoundCallbacks[payload.id];

				if (!callback) {
					logger.log("ServiceDiscovery: no findServices callback found for id: " + payload.id);
					return;
				}

				callback(payload.message, payload.id);
			});
		}

		/**
		 * Call a listener for each found service.
		 * @param params Array, first item being the service type to search.
		 * @param successCB Success callback.
		 * @param errorCB Error callback.
		 * @param objectRef RPC object reference.
		 */
		this.findServices = function (params, successCB, errorCB, objectRef) {
			var serviceType = params[0];
			var options = params[1];
			var filter = params[2];

			var callback;
			search.call(this, serviceType, callback, options, filter);

			function callback(services) {
				services = services || [];
                logger.log(services)
				for (var i = 0; i < services.length; i++) {
					logger.log('findServices: calling found callback for ' + services[i].id);
					var rpc = rpcHandler.createRPC(objectRef, 'onservicefound', services[i]);
					rpcHandler.executeRPC(rpc);
				}
			}
		};

		/**
		 * Used by the ServiceDiscovery to search for registered services.
		 * @param serviceType ServiceType object to search for.
		 * @param callback Callback to call with results.
		 * @param options Timeout, optional.
		 * @param filter Filters based on location, name, description, optional.
		 * @private
		 * @function
		 */
		var search = function (serviceType, callback, options, filter) {
			logger.log('INFO: [Discovery] '+"search: searching for ServiceType: " + serviceType.api);
			var results = [];

		/*	var deliverResults = function(r) {
				var isDuplicate = function(sv, pos) {
					var cnt = 0;
					for (var i=0; i<r.length; i++) {
						if (sv.id === r[i].id & sv.serviceAddress === r[i].serviceAddress) {
							if (i === pos && cnt === 0) {
								return true;
							}
							cnt += 1;
						}
					}
					return false;
				};
				r = r.filter(isDuplicate);

				// filter results for zoneId
				if (filter && typeof filter.zoneId === 'object') {
					var hasZoneId = function(sv) {
						// extract the openid account (user@foo.bar)
						var zoneId = /[^_]+_([^\/]+)/.exec(sv.serviceAddress);
						for (var i=0; i<filter.zoneId.length; i++) {
							if (zoneId && zoneId[1] === filter.zoneId[i]) return true;
						}
						return false;
					};
					r = r.filter(hasZoneId);
				}

				// finally return results
				callback(r);
			};*/

			var re = new RegExp(serviceType.api.replace(/\*/g, ".*"));
			var isPartialMatch = function(api) {
				if (serviceType.api.indexOf("*") !== -1) {
					if (api.api) {
						api = api.api;
					}
					return re.test(api);
				}
				return false;
			};

			for (var api in this.registry.getRegisteredObjectsMap()) {
				if (api === serviceType.api ||
						isPartialMatch(api)) {
					logger.log('INFO: [Discovery] '+"search: found matching service(s) for ServiceType: " + api + " at "+ this.rpcHandler.sessionId);
					var res = this.registry.getRegisteredObjectsMap()[api];
					for (var i =0 ; i < res.length; i = i + 1) {
						res[i].serviceAddress = this.rpcHandler.sessionId;
				    }
					results = results.concat(res);
			}
			}
			this.remoteServiceObjects.forEach(function(remoteObj){
				if (remoteObj.api === serviceType.api ||
					isPartialMatch(remoteObj)) {
					logger.log('INFO: [Discovery] '+"search: found matching service(s) for ServiceType at remoteSystem: " + remoteObj.api + " at "+ remoteObj.serviceAddress);
					results = results.concat(remoteObj);
				}
			});
			callback(results);
		};
	};

	Discovery.prototype = new RPCWebinosService;

	/**
	 * Add services to internal array. Used by PZH.
	 * @param services Array of services to be added.
	 */
	Discovery.prototype.addRemoteServiceObjects = function(msg) {
		var  that = this;
		logger.log('INFO: [Discovery] '+"addRemoteServiceObjects: found " + (msg && msg.length) || 0 + " services.");
		function contains(localArr, lname) {
			for (var i = 0 ; i < localArr.length; i = i + 1) {
				if (localArr[i].api == lname.api && localArr[i].serviceAddress == lname.serviceAddress) return false;
			}
			return true;
		}
		msg.forEach(function(name){
			if(contains(that.remoteServiceObjects, name))that.remoteServiceObjects.push(name);
		});
	};

	/**
	 * Remove services from internal array. Used by PZH.
	 * @param address Remove all services for this address.
	 */
	Discovery.prototype.removeRemoteServiceObjects = function(address) {
		var count = 0;
		var that = this;
		var localArr = this.remoteServiceObjects;
		localArr.forEach(function(services, index){
			if(services.serviceAddress === address) {
				that.remoteServiceObjects.splice(index, 1);
				count++;
			}
		});
		logger.log("removeRemoteServiceObjects: removed " + count + " services from: " + address);
	};

	/**
	 * Get an array of all registered Service objects.
	 * @returns Array with said objects.
	 * @private
	 */
	Discovery.prototype.getRegisteredServices = function() {
		var that = this;
		var results = [];

		for (var service in this.registry.getRegisteredObjectsMap()) {
			results = results.concat(this.registry.getRegisteredObjectsMap()[service]);
		}

		function getServiceInfo(el) {
			el = el.getInformation();
			el.serviceAddress = that.rpcHandler.sessionId;
			return el;
		}
		return results.map(getServiceInfo);
	};

	/**
	 * Get an array of all known services, including local and remote
	 * services. Used by PZH.
	 * @param exceptAddress Address of services that match will be excluded from
	 * results.
	 * @returns Array with known services.
	 * @private
	 */
	Discovery.prototype.getAllServices = function(exceptAddress) {
		var that = this;
		var results = [];
		this.remoteServiceObjects.map(function(address) {
			if (address.serviceAddress === exceptAddress) {
				return;
			}
			results = results.concat(address);
		});
		results = results.concat(this.getRegisteredServices());
		return results;
	};

	exports.Service = Discovery;

})();
