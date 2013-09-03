/*******************************************************************************
 * Code contributed to the webinos project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 ******************************************************************************/

(function () {
    function isOnNode() {
        return typeof module === "object" ? true : false;
    }

    /**
     * Interface ConfigurationInterface
     */
    var ServiceConfiguration = function (rpcHandler) {

        /**
         * Get current configuration for a specified API.
         * @param apiName Name of source API.
         * @param successCB Callback to call with results.
         * @param errorCB Callback to call in case of error.
         */
        this.getServiceConfiguration = function(apiName, successCB, errorCB) {
            //Calls to this method can be constrained using dashboard's feature
            var rpc = rpcHandler.createRPC('ServiceConfiguration', 'getServiceConfiguration', [{'api':'http://webinos.org/api/dashboard'}, apiName]);
            rpcHandler.executeRPC(rpc
                    , function (params) { successCB(params); }
                    , function (params) { errorCB(params); }
            );
        };
        
        /**
         * Set configuration to a specified API.
         * @param apiName Name of target API.
         * @param config Configuration to apply. It updates the params field in the config.json file
         * @param successCB Callback to call with results.
         * @param errorCB Callback to call in case of error.
         */
        this.setServiceConfiguration = function(apiName, config, successCB, errorCB) {
            //Calls to this method can be constrained using dashboard's feature
            var rpc = rpcHandler.createRPC('ServiceConfiguration', 'setServiceConfiguration', [{'api':'http://webinos.org/api/dashboard'}, apiName, config]);
            rpcHandler.executeRPC(rpc
                    , function (params) { successCB(params); }
                    , function (params) { errorCB(params); }
            );
        };
    };

    /**
     * Export definitions for node.js
     */
    if (isOnNode()) {
        exports.ServiceConfiguration = ServiceConfiguration;
    } else {
        // this adds ServiceDiscovery to the window object in the browser
        window.ServiceConfiguration = ServiceConfiguration;
    }
    
    webinos.configuration = new ServiceConfiguration (webinos.rpcHandler);
}());
