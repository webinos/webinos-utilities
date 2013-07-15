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
* Copyright 2012 - 2013 Samsung Electronics (UK) Ltd
* Author: Habib Virji (habib.virji@samsung.com)
*         Ziran Sun (ziran.sun@samsung.com)
*******************************************************************************/
/**
 * Creates a webinos configuration
 * - Creates default directories in .webinos or AppData/Roaming/webinos or /data/data/org.webinos.app
 * - Read webinos_config and separate them in different files
 * - Default certificates from client and master
 *@param {Object} inputConfig - These are command line parameters that are passed by PZH or PZP
 *@constructor
 */
function Config(webinosType, inputConfig) {
    "use strict";
    var path = require ("path");
    var fs = require ("fs");
    var logger = require("./logging.js") (__filename) || console;
    var wPath = require("./webinosPath.js");
    var ConfigContext = this;
    var existsSync = fs.existsSync || path.existsSync;
    
    function initializeConfigContext() {
        ConfigContext.metaData={};
        ConfigContext.trustedList={pzh:{}, pzp:{}};
        ConfigContext.untrustedCert={};
        ConfigContext.exCertList={};
        // This is set by certificate handler.. This is only for initialization
        ConfigContext.userData={};
        // This are ports value.. set by PZH and PZP
        ConfigContext.userPref={};
        // This is empty at initialization
        ConfigContext.serviceCache=[];
        ConfigContext.invitationTokens = {}; // used for certificate exchange via token.
        setWebinosMetaData();
    }
    /**
    * This function sets default value to make certificate and keystore run correctly
    * If user has modified default values, default values updated by this function will be overwritten
    */
    function setWebinosMetaData() {
        var webinos_root =  (webinosType.search("Pzh") !== -1)?wPath.webinosPath()+"Pzh" :wPath.webinosPath();
        ConfigContext.metaData.webinosType = webinosType;
        try {
            require("./webinosId.js").fetchWebinosName(webinosType, inputConfig, function (webinosName) {
                ConfigContext.metaData.webinosName = webinosName;
                ConfigContext.metaData.webinosRoot = (webinosType.search("Pzh") !== -1)?
                                                    (webinos_root + "/" + webinosName): webinos_root;
                if (inputConfig.forcedDeviceName) {
                    ConfigContext.metaData.webinosRoot = webinos_root + "/" + inputConfig.forcedDeviceName;
                }

                ConfigContext.metaData.serverName = (inputConfig && inputConfig.sessionIdentity) || "0.0.0.0";
            });
        } catch(err) {
            ConfigContext.emit("EXCEPTION", new Error("Failed Setting Webinos MetaData -"+ err));
        }
        ConfigContext.fileList = [{folderName: "", fileName: "metaData", object: ConfigContext.metaData},
            {folderName: "", fileName:"trustedList", object: ConfigContext.trustedList},
            {folderName: "", fileName:"untrustedList", object: ConfigContext.untrustedCert},
            {folderName: "", fileName:"invitationTokens", object: ConfigContext.invitationTokens},
            {folderName: "", fileName:"exCertList", object: ConfigContext.exCertList},
            {folderName:"userData", fileName:"userDetails", object: ConfigContext.userData},
            {folderName:"userData", fileName:"serviceCache", object: ConfigContext.serviceCache},
            {folderName:"userData", fileName:"userPref", object: ConfigContext.userPref}];
    }

    /**
     * This should be presumably the first function to check if webinos is pre-enrolled
     * Checks whether webinos configuration exists or else a new configuration is needed to be loaded
     */
    function checkConfigExists() {
        try {
            var name, i;
            if (ConfigContext.metaData.webinosRoot) {
                for (i = 0; i < ConfigContext.fileList.length; i = i + 1) {
                    name = ConfigContext.fileList[i];
                    if ((webinosType === "PzhP" || webinosType === "Pzh") && name.fileName === "serviceCache") {
                        continue;
                    }
                    if (name.fileName !== "trustedList" && name.fileName !== "untrustedList"
                        && name.fileName !== "invitationTokens" && name.fileName !== "serviceCache"
                        && name.fileName !== "exCertList" && name.folderName !== "certificates/external" ){
                        var fileName = (name.fileName) ? (name.fileName+".json"):(webinosName +".json");
                        var filePath = path.join (ConfigContext.metaData.webinosRoot, name.folderName, fileName);
                        if( !existsSync(filePath)){
                            return false;
                        }
                    }
                }
                return true;
            } else {
                ConfigContext.emit("FUNC_ERROR", new Error("webinos default files are not present -"+ err));
                return false;
            }
        } catch (err) {
            ConfigContext.emit("EXCEPTION", new Error("checking of webinos configuration failed -"+ err));
            return false;
        }
    }
    /**
     * Creates default webinos default directories
     * Permission restricts person who created file to read/write file, other users can read file
     * @return {Boolean} true if successful in creating all directories or else
     */
    this.createDefaultDirectories = function() {
        try {
            var permission = "0744";
            var webinos_root =  (ConfigContext.metaData.webinosType.search("Pzh") !== -1)?
                wPath.webinosPath()+"Pzh" :wPath.webinosPath();
            //If the main folder doesn't exist i.e. webinos/webinosPzh
            if (!existsSync (webinos_root)) {
                fs.mkdirSync (webinos_root, permission);
            }
            if (!existsSync (ConfigContext.metaData.webinosRoot)){
                fs.mkdirSync (ConfigContext.metaData.webinosRoot, permission);
            }
            // webinos root was created, we need the following 1st level dirs
            var list = [ path.join (ConfigContext.metaData.webinosRoot, "logs"),
                path.join (webinos_root, "wrt"),
                path.join (ConfigContext.metaData.webinosRoot, "certificates"),
                path.join (ConfigContext.metaData.webinosRoot, "policies"),
                path.join (ConfigContext.metaData.webinosRoot, "wrt"),
                path.join (ConfigContext.metaData.webinosRoot, "userData"),
                path.join (ConfigContext.metaData.webinosRoot, "keys"),
                path.join (ConfigContext.metaData.webinosRoot, "certificates", "external"),
                path.join (ConfigContext.metaData.webinosRoot, "certificates", "internal")];
            list.forEach (function (name) {
                if (!existsSync (name)) fs.mkdirSync (name, permission);
            });
            logger.log ("created default webinos directories at location : " + ConfigContext.metaData.webinosRoot);
            return true;
        } catch (err) {
            ConfigContext.emit("EXCEPTION", new Error("Failed in Creating Webinos Default Directories -"+ err));
            return false;
        }
    };

    this.loadCertificates = function(cert) {
        ConfigContext.cert = cert;
        var certList = [
            {folderName: "", fileName:"crl", object: ConfigContext.cert.crl},
            {folderName: "certificates/internal", fileName:"certificates", object: ConfigContext.cert.internal},
            {folderName: "certificates/external", fileName:"certificates", object: ConfigContext.cert.external}
        ];
        certList.forEach(function(name){
            if (existsSync(path.join(ConfigContext.metaData.webinosRoot, name.folderName, name.fileName+".json"))){
                ConfigContext.fetchDetails(name.folderName, name.fileName, name.object);
                if (name.folderName = "certificates/internal") {
                    ConfigContext.fetchDetails("certificates/internal", "signedCertificate", ConfigContext.cert.internal.signedCert);
                }
                loadFileReferencedInCert(name.object);
            } else {
                if (name.folderName !== "certificates/external") {
                    return false;
                }
            }
        });
        return true;
    };
    
    /**
     * This function replaces any certificate contents which are actually file
     * names rather than PEM strings.  The contents are replaced with the 
     * contents of the referenced file.
     *
     * The reason for this function is to help the webinos PZH Web Server load
     * SSL certificates from files provided by a third party (i.e., the
     * certificate authority without needing to convert to JSON.
     */
    function loadFileReferencedInCert(cert) {
        var util = require('util');
        //console.log("Cert config :" + util.inspect(cert));
        for (var c in cert) {
            if (cert.hasOwnProperty(c)) {
                if (cert[c].hasOwnProperty('cert')) {
                    // it's a certificate field
                    if (typeof cert[c].cert === 'string') {
                        //with a string value
                        var compareStr = '-----BEGIN CERTIFICATE-----';
                        if (cert[c].cert.length < 200 || !cert[c].cert.substr(0, (compareStr.length)) !== compareStr) {
                            // it isn't a certificate in PEM format, so we're going 
                            // to go out on a limb and assume it is a file.

                            // we're not going to check that we have permission 
                            // to open it, that's the caller's problem.

                            // it must be an absolute path and it must be in
                            // utf8
                            var fileName = cert[c].cert;
                            
                            try {
                                if (existsSync(fileName)) {
                                    var fileContent = fs.readFileSync(fileName, 'utf8');
                                    if (fileContent.substr(0, (compareStr.length)) === compareStr) {
                                        //it's a certificate file.
                                        cert[c].certName = cert[c].cert;
                                        cert[c].cert = fileContent;
                                    }
                                }
                                
                            } catch (err) {
                                logger.log(err);
                                logger.log("Failed to read file path: " + fileName);
                            }
                        }
                    }
                }
            }
        }
    }
    
    /**
     * This is a public function that gets triggered by PZH/PZP/PZHP to fetch existing configuration
     * or load old configuration.
     */
    this.loadWebinosConfiguration = function() {
        try {
            if (checkConfigExists()){
                ConfigContext.fileList.forEach(function(name){
                    if (existsSync(path.join(ConfigContext.metaData.webinosRoot,name.folderName, name.fileName+".json"))){
                        ConfigContext.fetchDetails(name.folderName, name.fileName, name.object);
                    }
                });
                return true;
            } else {
                return false;
            }
        } catch (err) {
            ConfigContext.emit("EXCEPTION", new Error("Webinos Configuration Load/Create Failed -"+ err));
            return false;
        }
    };
    /**
     * Used for storing key hash
     * @param {String} keys - private key to be stored
     * @param {String} name - name of the file
     */
    this.storeKeys = function (keys, name) {
        var filePath = path.join(ConfigContext.metaData.webinosRoot, "keys", name+".pem");
        try {
            fs.writeFileSync(path.resolve(filePath), keys);
            logger.log("saved " + name +".pem");
            //calling get hash
            // ConfigContext.getKeyHash(filePath);
            return true;
        } catch (err) {
            return false;
        }
    };
    /**
     * Stores webinos configuration in the webinos configuration default directory
     * @param {String} folderName -
     * @param {String} fileName
     * @param {Object} data - JSON object stored in the file
     */
    this.storeDetails = function(folderName, fileName, data) {
        if (!data && folderName && fileName) {
            data = fileName;
            fileName = folderName;
            folderName = "";
        }
        var filePath = path.join (ConfigContext.metaData.webinosRoot, folderName, fileName+".json");
        try {
            if (typeof data === "object") {
                fs.writeFileSync(path.resolve(filePath), JSON.stringify (data, null, " "));
                logger.log ("webinos configuration updated (" + filePath + ")");
                if (folderName === "userData") {
                    updateWebinosConfig(fileName);
                }
                return true;
            } else {
                ConfigContext.emit("WRITE_ERROR", new Error("Object to store should be of type object -"+ err));
            }
        } catch(err) {
            ConfigContext.emit("EXCEPTION", new Error("Webinos configuration store in " + filePath+ " failed -"+ err));
            return false;
        }
    };
    /**
     * Fetches webinos configuration data (JSON object) from the webinos configuration default directory
     * @param {String} folderName - folder inside webinos configuration specific directory
     * @param {String} fileName - name of the file from where to read configuration inside folderName
     * @param {Object} assignValue - value read is assigned in the passed object
     */
    this.fetchDetails = function(folderName, fileName, assignValue) {
        if (!assignValue && folderName && fileName) {
            fileName = folderName;
            assignValue = fileName;
            folderName = undefined;
        }
        var filePath = path.join(ConfigContext.metaData.webinosRoot, folderName, fileName+".json");
        try {
            var data = fs.readFileSync(path.resolve(filePath));
            var dataString = data.toString();
            if (dataString !== "") {
                data = JSON.parse(dataString);
                for (var key in data) {
                    if (data.hasOwnProperty(key)) assignValue[key] = data[key];
                }
                return true;
            } else {
                ConfigContext.emit("READ_ERROR", new Error("Webinos configuration data is empty in the file, considering it is corrupted"));
                return false;
            }
        } catch(error) {
            ConfigContext.emit("EXCEPTION", new Error("webinos configuration data is corrupted, webinos will not start correctly -"+ error));
        }
    };
    initializeConfigContext(); // Need to run this by default
}

Config.prototype.__proto__ = require("events").EventEmitter.prototype;
module.exports = Config;
