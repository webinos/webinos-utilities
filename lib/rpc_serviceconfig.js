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
    var PzpAPI = require(require("path").join(require.main.paths[0], "..", "lib", "pzp_sessionHandling.js"));

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
        this.getServiceConfiguration = function (params, successCB, errorCB, objectRef) {
            var configFilePath = path.join(params[1].path, "config.json");
            var templateFilePath = path.join(params[1].path, "template.json");
            if (existsSync(configFilePath) && existsSync(templateFilePath)) {
                successCB({
                    'config' : JSON.parse(fs.readFileSync(configFilePath).toString())
                  , 'template' : JSON.parse(fs.readFileSync(templateFilePath).toString())
                  , 'apiName' : params[1].name
                });
            }
            else errorCB("config.json, template.json or both of them are not accessible");
        };

        /**
         * @param successCB Success callback.
         * @param errorCB Error callback.
         * @param objectRef RPC object reference.
         */
        this.setServiceConfiguration = function (params, successCB, errorCB, objectRef) {
            PzpAPI.setServiceConfiguration(params[1], params[2]);
            successCB();
        };
    };

    ServiceConfiguration.prototype = new RPCWebinosService;

    exports.Service = ServiceConfiguration;

})();
