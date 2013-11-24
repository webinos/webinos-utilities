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
 ******************************************************************************/
(function () {
    var RPCWebinosService = require("webinos-jsonrpc2").RPCWebinosService;
    var logger = require("./logging.js")(__filename);

    var fs = require("fs");
    var path = require("path");
    var existsSync = fs.existsSync || path.existsSync;

    /**
    * Webinos ServiceConfiguration service constructor (server side).
    * @constructor
    * @param rpcHandler A handler for functions that use RPC to deliver their result.
    */
    var ServiceConfiguration = function(rpcHandler, params) {
        // inherit from RPCWebinosService
        this.base = RPCWebinosService;
        this.base({
            api: 'ServiceConfiguration',
            displayName: 'ServiceConfiguration',
            description: 'Webinos ServiceConfiguration'
        });

        /**
         * RPC handler
        */
        this.rpcHandler = rpcHandler;

        /**
         * @param successCB Success callback.
         * @param errorCB Error callback.
         * @param objectRef RPC object reference.
         */
        this.getAPIServicesConfiguration = function (params, successCB, errorCB, objectRef) {
            var templateFilePath = path.join(params[1].path, "template.json"),
                configFilePath,
                userDataConfigFilePath;

            configFilePath = path.join(params[1].path, "config.json");
            userDataConfigFilePath = path.join(require("./webinosPath.js").webinosPath(), "userData", params[1].relativePath, "config.json");

            if (existsSync(templateFilePath)) {
                if (existsSync(userDataConfigFilePath)) {
                    successCB({
                        'config' : JSON.parse(fs.readFileSync(userDataConfigFilePath).toString())
                        , 'template' : JSON.parse(fs.readFileSync(templateFilePath).toString())
                        , 'apiName' : params[1].name
                    });
                } else if (existsSync(configFilePath)) {
                    successCB({
                        'config' : JSON.parse(fs.readFileSync(configFilePath).toString())
                      , 'template' : JSON.parse(fs.readFileSync(templateFilePath).toString())
                      , 'apiName' : params[1].name
                    });
                } else errorCB("Configuration not available");
            } else errorCB("Configuration's template not available");
        };

        /**
         * @param successCB Success callback.
         * @param errorCB Error callback.
         * @param objectRef RPC object reference.
         */
        this.getServiceConfiguration = function (params, successCB, errorCB, objectRef) {
            try {
                var PzpAPI = require(require("path").join(require.main.paths[0], "..", "lib", "pzp_sessionHandling.js"));
                PzpAPI.setServiceConfiguration(params[1], params[2]);
                successCB();
            } catch(e) {
                errorCB("Cannot set service configuration");
            }
        };

        /**
         * @param successCB Success callback.
         * @param errorCB Error callback.
         * @param objectRef RPC object reference.
         */
        this.setAPIServicesConfiguration = function (params, successCB, errorCB, objectRef) {
            try {
                var PzpAPI = require(require("path").join(require.main.paths[0], "..", "lib", "pzp_sessionHandling.js"));
                if (PzpAPI.setServiceConfiguration(null, params[1], params[2])) {
                    successCB();
                } else {
                    errorCB("Cannot set service configuration");
                }
            } catch(e) {
                errorCB("Cannot set service configuration");
            }
        };

        /**
         * @param successCB Success callback.
         * @param errorCB Error callback.
         * @param objectRef RPC object reference.
         */
        this.setServiceConfiguration = function (params, successCB, errorCB, objectRef) {
            try {
                var PzpAPI = require(require("path").join(require.main.paths[0], "..", "lib", "pzp_sessionHandling.js"));
                PzpAPI.setServiceConfiguration(params[1], params[2], params[3]);
                successCB();
            } catch(e) {
                errorCB("Cannot set service configuration");
            }
        };
    };

    ServiceConfiguration.prototype = new RPCWebinosService;

    exports.Service = ServiceConfiguration;

})();
