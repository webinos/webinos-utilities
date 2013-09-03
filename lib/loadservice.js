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
    try {
        if (mod.Module) {
            var ApiModule = mod.Module;
            var m = new ApiModule(rpcHandler, modDesc.params, config);
            if (!m.init) {
                throw new Error("api module has no init function");
            }

            m.init(function register(o) {
                registry.registerObject(o);
            }, function unregister(o) {
                registry.unregisterObject(o);
            });

            if (m.httpHandler) {
                moduleHttpHandlers[modDesc.name] = m.httpHandler;
            }
        } else if (mod.Service) {
            var Service = mod.Service;
            var s = new Service(rpcHandler, modDesc.params);
            registry.registerObject(s);
        } else {
            throw new Error("no Service or Module property");
        }
    } catch (error) {
        logger.error("Could not load module " + modDesc.name + " with message: " + error);
    }
}

exports.checkForWebinosModules = function(node_moduleDir) {
    try {
        // Assumption this function is inside webinos-pzp/node_modules/webinos-utilities/lib/loadService.js
        var fileList = fs.readdirSync(node_moduleDir), name,stat, config= {params:{}}, i, modules=[];
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
                try {
                    config = require(path.join(apiModDir, "config.json"));
                } catch(err) {// config.json might not be there for each API
                    config = {"params": {} };
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
                    params: config.params,
                    path: apiModDir,
                    testFile: testPath
                });
                logger.log("New module "+fileList[i]+" detected with configuration parameters "+ require("util").inspect(config.params) + " and testPath "+testPath);
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
        path.join(node_moduleDir,"webinos-utilities","wrt","webinos.serviceconfig.js")
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
