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
 * Copyright 2011 Habib Virji, Samsung Electronics (UK) Ltd
 * Copyright 2011 Ziran Sun, Samsung Electronics (UK) Ltd
 *******************************************************************************/
/**
 * Determines the device name.
 *
 * @param type the type of PZ entity, string.
 * @param config object with optional forcedDeviceName property, overrides device name.
 * @param callback function which is called with device name as param.
 */
exports.fetchWebinosName = function(type, config, callback) {
    var os = require('os');
    // use user defined device name if given
    if (config && config.forcedDeviceName) {
        callback(config.forcedDeviceName.substring(0, 34));    // We have only 40 char limitation, and PZP:, : takes 3 charaters,so total 6 characters to leave for PZP:
        return;
    }
    //Get Android devices identity
    if(type === "Pzp" && (os.type().toLowerCase() === "linux") && (os.platform().toLowerCase() === "android")){
        var bridge = require("bridge");
        /* If WiFi Mac address is preferred
         * var prop = {
         * aspect: "WiFiNetwork",
         * property: "macAddress"
         * }
         */
        var prop = {
            aspect: "Device",
            property: "identity"
        };

        function onsuccess(prop_value, prop){
            callback(prop_value);
        }

        function onerror(){
            log.error("android get device name returns error");
            callback("android");
        }
        var devStatusModule = bridge.load(require("../platform_interfaces.json").android.DevicestatusImpl, this);
        devStatusModule.getPropertyValue(onsuccess, onerror, prop);
    } else if ((type.search("Pzp") !== -1)){
        callback((os.hostname()).substring(0, 34)); // We have only 40 char limitation, and PZP:, : takes 3 charaters,so total 6 characters to leave for PZP:
    } else if(type.search("PzhP") !== -1) {
        callback((os.hostname()).substring(0, 33));// We have only 40 char limitation, and PZPP:, : takes 3 charaters,so total 7 characters to leave for PZHP
    } else if (type.search("Pzh") !== -1){
        callback((config && config.friendlyName) || "defaultPzh");
    }
};
