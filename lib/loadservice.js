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
 * Copyright 2012 Fraunhofer
 *******************************************************************************/

var logger = require("./logging.js")(__filename);
var path = require("path");
var fs = require("fs");
var webinosJS;
var existsSync = fs.existsSync || path.existsSync;

function load(mod, modDesc, registry, rpcHandler, config, moduleHttpHandlers) {
    var userDataFolder = path.join(require("./webinosPath.js").webinosPath(), "userData"),
        tmpFolder = userDataFolder,
        apiFolderName,
        params;

    try {
        if (mod.Module) {
            var ApiModule = mod.Module;
            for (var i = 0; i < modDesc.instances.length; i++) {
                params = modDesc.instances[i].params;
                var m = new ApiModule(rpcHandler, params, config);

                if (!m.init) {
                    throw new Error("api module has no init function");
                }

                m.init(function register(o) {
                    var instanceId = registry.registerObject(o);
                    
                    if (modDesc.instances && modDesc.instances[i]) {
                        modDesc.instances[i].id = instanceId;
                    }
                }, function unregister(o) {
                    registry.unregisterObject(o);
                });

                if (m.httpHandler) {
                    moduleHttpHandlers[modDesc.name] = m.httpHandler;
                }
            }
        } else if (mod.Service) {
            var Service = mod.Service;
            for (var i = 0; i < modDesc.instances.length; i++) {
                params = modDesc.instances[i].params;
                var s = new Service(rpcHandler, params);
                modDesc.instances[i].id = registry.registerObject(s);
                modDesc.apiURI = s.api;
            };
        } else {
            throw new Error("no Service or Module property");
        }

        if (modDesc.name === "webinos-api-test"){
            apiFolderName = path.join("webinos-utilities", "node_modules", "webinos-api-test");
        } else {
            apiFolderName = modDesc.name
        }

        try{
            apiFolderName.split(path.sep).map(function(folderFragment){
                tmpFolder = path.join(tmpFolder, folderFragment);
                if(!existsSync(tmpFolder)) {
                    fs.mkdirSync(tmpFolder);
                }
            });

            fs.writeFileSync(modDesc.customisedConfigFile, JSON.stringify({"apiURI": modDesc.apiURI, "instances": modDesc.instances}, null, "  "));
        } catch (error){
            logger.error("Could not store configuration for module " + modDesc.name + " with message: " + error);
        }

    } catch (error) {
        logger.error("Could not load module " + modDesc.name + " with message: " + error);
    }
}

exports.checkForWebinosModules = function(node_moduleDir) {
    try {
        // Assumption this function is inside webinos-pzp/node_modules/webinos-utilities/lib/loadService.js
        var fileList = fs.readdirSync(node_moduleDir), name, stat, config = {"instances": []}, i, modules = [];
        for (i = 0; i < fileList.length; i = i + 1) {
            if (fileList[i]==="webinos-utilities") {
                fileList[i] = path.join("webinos-utilities", "node_modules", "webinos-api-test");
                name = "webinos-api-test"
            } else {
                name = fileList[i];
            }
            var apiModDir = path.join(node_moduleDir, fileList[i]);
            stat = fs.statSync(apiModDir);
            // Gather folders starting with webinos-api.
            // Do not load serviceDiscovery as it is preloaded.
            // check it is a a directory
            if (fileList[i].indexOf("webinos-api") !== -1 && stat.isDirectory()) {
                var userDataFolder = path.join(require("./webinosPath.js").webinosPath(), "userData"),
                    customisedConfigFile = path.join(userDataFolder, fileList[i] ,"config.json");

                if (!existsSync(customisedConfigFile)) {
                    try{
                        config = require(path.join(apiModDir, "config.json"));
                    } catch (err) {}
                } else {
                    try{
                        config = require(customisedConfigFile);
                    } catch (err) {}
                }

                if (!config.instances){
                    if (config.params){
                        config.instances = [ { "id": "", "params": config.params } ];
                    } else {
                        config.instances = [];
                    }
                }

                var testPath;
                if (path.resolve(apiModDir, "test", "web_root")){
                    var testFileDir = fs.readdirSync(path.join(apiModDir, "test", "web_root"));
                    // TODO: multi file support
                    testPath = path.join(fileList[i], "test", "web_root", testFileDir[0]);
                }
                // if file not found assume params is {}
                modules.push({
                    name: name,
                    apiURI: config.apiURI,
                    instances: config.instances,
                    path: apiModDir,
                    customisedConfigFile: customisedConfigFile,
                    testFile: testPath
                });

                config.instances.map(function(instance) {
                    logger.log("New module " + fileList[i] + " detected with configuration parameters " + require("util").inspect(instance.params) + " and testPath " + testPath);
                });
            }
        }
        return modules;
    } catch(e) {
        logger.error(e);
    }
};

exports.loadServiceModules = function(modulesDesc, registry, rpcHandler, config, moduleHttpHandlers) {
    var mods = modulesDesc.map(function(m) {
        try {
            return require(m.path);
        } catch(e) {
            logger.error("module require for " + m.name + " failed: " + e);
            return m;
        }
    });
    for (var i=0; i<mods.length; i++) {
        load(mods[i], modulesDesc[i], registry, rpcHandler, config, moduleHttpHandlers);
    }
};

exports.loadServiceModule = function(modDesc, registry, rpcHandler, config, moduleHttpHandlers) {
    var mod = require(modDesc.path);
    load(mod, modDesc, registry, rpcHandler, config, moduleHttpHandlers);
};

exports.createWebinosJS = function(node_moduleDir, apiModules) {
    var wrt_Dir, fileList, data, i, j, fileName, webroot_Dir, stat, android_Dir;
    var os = require('os');
    webroot_Dir = path.join(node_moduleDir, "../web_root");
    wrt_Dir = path.join(node_moduleDir, "../wrt"); // To read webinos.js and webinos.session.js
    android_Dir = path.join(node_moduleDir, "../android");
    fs.writeFileSync(path.join(webroot_Dir, "webinos.js"),""); // Overwrite/create file
    webinosJS = fs.createWriteStream(path.join(webroot_Dir, "webinos.js"), { flags:"a", encoding:"utf8"});

    webinosJS.write("(function(exports){\n\n");

    // Need to write first webinos.session and then webinos.js otherwise it fails
    
    var mandatoryWebinosJS=[
        path.join(node_moduleDir,"webinos-jsonrpc2","lib","registry.js"),
        path.join(node_moduleDir,"webinos-jsonrpc2","lib","rpc.js"),
        path.join(node_moduleDir,"webinos-utilities","lib","messagehandler.js"),
        path.join(wrt_Dir,"webinos.session.js"),
        path.join(wrt_Dir,"webinos.js"),
        path.join(node_moduleDir,"webinos-utilities","wrt","webinos.service.js"),
        path.join(node_moduleDir,"webinos-utilities","wrt","webinos.servicedisco.js"),
        path.join(node_moduleDir,"webinos-utilities","wrt","webinos.serviceconfig.js"),
        path.join(node_moduleDir,"webinos-utilities","wrt","webinos.zonenotifications.js")
    ];

    //If webinos-dashboard exists, load the wrt file
    var dashboard = null;
    try {dashboard = require.resolve("webinos-dashboard");}catch (e){}
    if (dashboard != null){
        mandatoryWebinosJS.push(path.join(node_moduleDir,"webinos-dashboard","wrt","webinos.dashboard.js"));
    }

    mandatoryWebinosJS.forEach(function(name){
        data = fs.readFileSync(name);
        webinosJS.write(data.toString());
    });

    // Gather folders starting with webinos-api
    for (i = 0; i < apiModules.length; i = i + 1) {
        fileName = fs.readdirSync(path.join(apiModules[i].path, "wrt"));
        fileName.sort();
        for (j=0; j < fileName.length; j = j + 1) {
            stat = fs.statSync(path.join(apiModules[i].path, "wrt", fileName[j]));
            if (!stat.isFile()) continue;

            try {
                data = fs.readFileSync(path.join(apiModules[i].path, "wrt", fileName[j]));
                webinosJS.write(data.toString());
            } catch(err) {
                logger.log("Webinos module without client side code. " ,"Using Web RunTime you will not be able to access module "+ apiModules[i].name);
            }
        }
    }

    webinosJS.write("\n})(window);\n");
    
    if(os.platform() === 'android')
    {
        var androidInterfaces = require("../platform_interfaces.json").android;
        var wrtDir = androidInterfaces.wrt;
        if (!existsSync (wrtDir)) 
            fs.mkdirSync (wrtDir);
        staticPath = androidInterfaces.static;
        if (!existsSync (staticPath)) 
            fs.mkdirSync (staticPath);
      
        fs.writeFileSync(path.join(staticPath, "webinos.js"),""); 
        wrtJs = fs.createWriteStream(path.join(staticPath, "webinos.js"), { flags:"a", encoding:"utf8"});
        var webinossoketJs = path.join(android_Dir,"wrt","webinossocket.js");
        data = fs.readFileSync(webinossoketJs);
        wrtJs.write(data.toString());
        fs.createReadStream(path.join(webroot_Dir, "webinos.js")).pipe(wrtJs);
    } 
};
