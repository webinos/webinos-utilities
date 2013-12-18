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
//var isPzp = process.mainModule.children[0].id.substr(process.mainModule.children[0].id.lastIndexOf(path.sep) + 1) === "pzp.js";
var userDataFolder;
var modules = {};

//Fix: On Android in nodejs 0.6 Path.sep is not defined
if(require('os').platform() === 'android'){
    path.sep = '/';
}

function load(mod, modDesc, registry, rpcHandler, config, moduleHttpHandlers, reloadOnlyInstances) {
    var params, instanceId;
    try {
        if (mod.Module) {
            var ApiModule = mod.Module;
            params = JSON.parse(JSON.stringify(modDesc.params));

            if (modDesc.submodules && typeof modDesc.submodules) {
                params._submodules = modDesc.submodules;
            }

            if (!reloadOnlyInstances) {
                modules[modDesc.name] = new ApiModule(rpcHandler, params, config);

                if (!modules[modDesc.name].init) {
                    throw new Error("api module has no init function");
                }

                modules[modDesc.name].init(function register(o) {
                    return registry.registerObject(o);
                }, function unregister(o) {
                    registry.unregisterObject(o);
                });
            }

            if (modDesc.params.instances){
                for (var i = 0; i < modDesc.params.instances.length; i++) {
                    if (modDesc.params.instances && modDesc.params.instances[i]) {
                        instanceId = modules[modDesc.name].updateServiceParams(modDesc.params.instances[i].id, JSON.parse(JSON.stringify(modDesc.params.instances[i].params)));
                        modDesc.params.instances[i].id = instanceId;
                    }
                }
            }

            if (modules[modDesc.name].httpHandler) {
                moduleHttpHandlers[modDesc.name] = modules[modDesc.name].httpHandler;
            }
        } else if (mod.Service) {
            var Service = mod.Service;

            if (!modDesc.params.instances) {
                modDesc.params.instances = [ {"id": "", "params" : JSON.parse(JSON.stringify(modDesc.params))} ];
            }

            for (var i = 0; i < modDesc.params.instances.length; i++) {
                var params = JSON.parse(JSON.stringify(modDesc.params.instances[i].params));
                if (modDesc.submodules && typeof modDesc.submodules) {
                    params._submodules = modDesc.submodules;
                }
                var s = new Service(rpcHandler, params);
                instanceId = registry.registerObject(s);
                if (modDesc.params.instances && modDesc.params.instances[i]) {
                    modDesc.params.instances[i].id = instanceId;
                }
                modDesc.apiURI = s.api;
            }
        } else {
            throw new Error("no Service or Module property");
        }

        storeConfiguration(modDesc);
        if (modDesc.submodules && typeof modDesc.submodules === 'object') {
            for (var k in modDesc.submodules) {
                storeConfiguration(modDesc.submodules[k]);
            }
        }

    } catch (error) {
        logger.error("Could not load module " + modDesc.name + " with message: " + error);
    }
}

function storeConfiguration(modDesc) {
    var tmpFolder = userDataFolder,
        apiFolderName, submodules = [], size;

    size = userDataFolder.length + 1;
    if(modDesc.customisedConfigFile.indexOf(userDataFolder) == 0){
        apiFolderName = modDesc.customisedConfigFile.substr(size, modDesc.customisedConfigFile.lastIndexOf(path.sep) - size);
    }

    try{
        apiFolderName.split(path.sep).map(function(folderFragment){
            tmpFolder = path.join(tmpFolder, folderFragment);
            if(!existsSync(tmpFolder)) {
                fs.mkdirSync(tmpFolder);
            }
        });

        size += apiFolderName.length + 1;
        if (modDesc.submodules && typeof modDesc.submodules === 'object' && Object.keys(modDesc.submodules).length) {
            for (var k in modDesc.submodules) {
                submodules.push(modDesc.submodules[k].customisedConfigFile.substr(size, modDesc.submodules[k].customisedConfigFile.lastIndexOf(path.sep) - size));
            }
            fs.writeFileSync(modDesc.customisedConfigFile, JSON.stringify({"apiURI": modDesc.apiURI, "params": modDesc.params, "submodules": submodules}, null, "  "));
        } else {
            fs.writeFileSync(modDesc.customisedConfigFile, JSON.stringify({"apiURI": modDesc.apiURI, "params": modDesc.params}, null, "  "));
        }
    } catch (error){
        logger.error("Could not store configuration for module " + modDesc.name + " with message: " + error);
    }
}

exports.checkForWebinosModules = function(node_moduleDir, userDataPath) {
    try {
        // Assumption this function is inside webinos-pzp/node_modules/webinos-utilities/lib/loadService.js
        var fileList = fs.readdirSync(node_moduleDir),
            stat, i, j,
            config,  submoduleConfig,
            modules = [], modulesList = [],
            name, customisedConfigFile, moduleDir;

        userDataFolder = userDataPath;

        for (i = 0; i < fileList.length; i = i + 1) {
            moduleDir = path.join(node_moduleDir, fileList[i]);

            stat = fs.statSync(moduleDir);
            // Gather folders starting with webinos-api.
            // Do not load serviceDiscovery as it is preloaded.
            // check it is a a directory
            if ((fileList[i].indexOf("webinos-api") !== -1 && stat.isDirectory()) || fileList[i] === "webinos-utilities") {
                try{
                    config = require(path.join(moduleDir, "config.json"));

                    if (config.include && config.include.length > 0) {
                        config.include.map(function(module){
                            modulesList.push(fileList[i] + path.sep + module.split(/[\\\/]/).join(path.sep));
                        });
                    }
                } catch (err) {}

                if (fileList[i] !== "webinos-utilities") {
                    modulesList.push(fileList[i]);
                }
            }
        }

        for (i = 0; i < modulesList.length; i = i + 1) {
            customisedConfigFile = path.join(userDataFolder, modulesList[i] ,"config.json");
            moduleDir = path.join(node_moduleDir, modulesList[i]);
            name = modulesList[i].substr(modulesList[i].lastIndexOf(path.sep) + 1);

            if (!existsSync(customisedConfigFile)) {
                try{
                    config = require(path.join(moduleDir, "config.json"));
                } catch (err) {}
            } else {
                try{
                    config = require(customisedConfigFile);
                } catch (err) {}
            }

            var testPath;
            if (path.resolve(moduleDir, "test", "web_root")){
                var testFileDir = fs.readdirSync(path.join(moduleDir, "test", "web_root"));
                // TODO: multi file support
                for (var j=0; j<testFileDir.length; j++) {
                    var ent = path.join(moduleDir, "test", "web_root", testFileDir[j]);
                    if (fs.statSync(ent).isFile() && /\.html$/i.test(testFileDir[j])) {
                        testPath = path.join(modulesList[i], "test", "web_root", testFileDir[j]);
                        break;
                    }
                }
            }

            var submodulesList = config.submodules || [],
                submodules = {};

            for (j = 0; j < submodulesList.length; j = j + 1) {
                var submoduleCustomisedConfigFile = path.join(userDataFolder, modulesList[i], submodulesList[j] ,"config.json"),
                submoduleDir = path.join(node_moduleDir, modulesList[i], submodulesList[j]),
                submoduleName = submodulesList[j].substr(submodulesList[j].lastIndexOf(path.sep) + 1);

                if (!existsSync(submoduleCustomisedConfigFile)) {
                    try{
                        submoduleConfig = require(path.join(submoduleDir, "config.json"));
                    } catch (err) {}
                } else {
                    try{
                        submoduleConfig = require(submoduleCustomisedConfigFile);
                    } catch (err) {}
                }

                submodules[submoduleName] = {
                    apiURI: submoduleConfig.apiURI,
                    params: submoduleConfig.params || {},
                    path: submoduleDir,
                    customisedConfigFile: submoduleCustomisedConfigFile
                };
            }

            // if file not found assume params is {}
            modules.push({
                name: name,
                apiURI: config.apiURI,
                params: config.params || {},
                submodules: submodules,
                path: moduleDir,
                customisedConfigFile: customisedConfigFile,
                testFile: testPath
            });

            logger.log("New module " + name + " detected with configuration parameters " + require("util").inspect(config.params) + " and testPath " + testPath);
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

exports.loadServiceModule = function(modDesc, registry, rpcHandler, config, moduleHttpHandlers, reloadOnlyInstances) {
    var mod = require(modDesc.path);
    load(mod, modDesc, registry, rpcHandler, config, moduleHttpHandlers, reloadOnlyInstances);
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

    var wrtDir = fs.readdirSync(wrt_Dir);
    wrtDir.sort();
    for (j=0; j < wrtDir.length; j = j + 1) {
        stat = fs.statSync(path.join(wrt_Dir, wrtDir[j]));
        if (!stat.isFile()) continue;
        else {
            if (path.extname(wrtDir[j]) === ".js" && wrtDir[j]!="webinos.js" && wrtDir[j]!="webinos.session.js"){
                mandatoryWebinosJS.push(path.join(wrt_Dir,wrtDir[j]));
            }
        }
    }

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
                if (path.extname(fileName[j]) === ".js"){
		            data = fs.readFileSync(path.join(apiModules[i].path, "wrt", fileName[j]));
		            webinosJS.write(data.toString());
                }
            } catch(err) {
                logger.log("Webinos module without client side code. " ,"Using Web RunTime you will not be able to access module "+ apiModules[i].name);
            }
        }
    }

    webinosJS.write("\n})(window);\n");
    
    if(os.platform() === 'android')
    {
        var androidInterfaces = require("../platform_interfaces.json").android;
        var wrtDir = androidInterfaces.wrt_home;
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
