/*******************************************************************************
 *  Code contributed to the webinos project*
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
 * Copyright 2012 - 2013 Samsung Electronics (UK) Ltd
 * Author: Habib Virji (habib.virji@samsung.com)
 *******************************************************************************/
function loadConfig(path_to_config) {
    if(!path_to_config) {
        return null;
    }
    // TODO: parse out all the information
    return require(path_to_config);
}
// All these below functions are related to reading, writing and updating webinos_config.json\\
/**
 * Helper function to compare two objects
 * @param {Object} objA - Object 1 to compare
 * @param {Object} objB - Object 2 to compare
 * @return {Boolean} true if both objects are equal or else false
 */
function compareObjects(objA, objB){
    if (typeof objA !== "object" || typeof objB !== "object") {
        return false;
    }

    if ((Object.keys(objA)).length !== (Object.keys(objB)).length) {
        return false;
    }

    for (var i = 0; i < Object.keys(objA).length; i = i + 1) {
        if (objA[i] !== objB[i]){
            return false;
        }
    }

    return true;// both objects are equal
}
/**
 * Update webinos config if the service cache has changed..
 * @param {String} fileName - fileName (ServiceCache or userPref) that has been updated
 * @param {Object} config - updated configuration details
 */
function updateWebinosConfigFile(fileName, config) {
    try {
        var filePath = path.resolve(__dirname, "../config.json");
        fs.writeFileSync(filePath, JSON.stringify(config, null, "  "));
        logger.log("updated webinos config with details related to "+ fileName);
    } catch (err) {
        ConfigContext.emit("EXCEPTION", "webinos_config write failed", err);
    }
}
/**
 * Updates webinos config regarding service cache and user ports
 * @param {String} fileName - file that has been changed
 */
function updateWebinosConfig(fileName) {
    try {
        if (fileName === "serviceCache") {
            if (ConfigContext.metaData.webinosType === "Pzh" &&
                webinosConfigValue.pzhDefaultServices.length !== ConfigContext.serviceCache.length) {
                webinosConfigValue.pzhDefaultServices = ConfigContext.serviceCache;
            } else if (ConfigContext.metaData.webinosType === "Pzp" &&
                webinosConfigValue.pzpDefaultServices.length !== ConfigContext.serviceCache.length) {
                webinosConfigValue.pzpDefaultServices = ConfigContext.serviceCache;
            }
            updateWebinosConfigFile(fileName, webinosConfigValue);
        } else if (fileName === "userPref" && !compareObjects(webinosConfigValue.ports, ConfigContext.userPref.ports)) {
            webinosConfigValue.ports = ConfigContext.userPref.ports;
            updateWebinosConfigFile(fileName, webinosConfigValue);
        }
    } catch(err) {
        ConfigContext.emit("EXCEPTION", "webinos_config update failed", err);
    }
}
/**
 * Reads webinos_config values every time PZP is restarted.
 * This can reset values based on webinos_config,json for ports, webinos_version and serviceCache
 */
function checkDefaultValues() {
    try {
        var filePath = path.resolve (__dirname, "../../../../webinos_config.json");
        var config = require(filePath), key;
        if (!compareObjects(config.webinos_version, ConfigContext.metaData.webinos_version)) {
            ConfigContext.metaData.webinos_version = config.webinos_version;
            ConfigContext.storeDetails("metaData", ConfigContext.metaData);
        }
        if (!compareObjects(config.ports, ConfigContext.userPref.ports)) {
            ConfigContext.userPref.ports = config.ports;
            ConfigContext.storeDetails("userData", "userPref", ConfigContext.userPref);
        }
        if (ConfigContext.metaData.webinosType === "Pzh" && config.pzhDefaultServices.length !== ConfigContext.serviceCache.length) {
            ConfigContext.serviceCache = config.pzhDefaultServices;
            ConfigContext.storeDetails("userData", "serviceCache", ConfigContext.serviceCache);
        } else if (ConfigContext.metaData.webinosType === "Pzp" && config.pzpDefaultServices.length !== ConfigContext.serviceCache.length) {
            ConfigContext.serviceCache = config.pzpDefaultServices;
            ConfigContext.storeDetails("userData", "serviceCache", ConfigContext.serviceCache);
        }
        if (ConfigContext.metaData.webinosType === "Pzp" && config.friendlyName !== "") {
            setFriendlyName(config.friendlyName);
        }
    } catch(err) {
        ConfigContext.emit("EXCEPTION", "webinos_config check update failed", err);
    }
}
module.exports=loadConfig;
