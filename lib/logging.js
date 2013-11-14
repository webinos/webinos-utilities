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
 *******************************************************************************/
var writeInfo = {}, writeError = {};

var config = {
    "debug": true
};

function WebinosLogging (filename) {
    "use strict";

    var util = require("util");
    var path = require ('path');
    var fs   = require ('fs');
    var os   = require ("os");
    var wPath= require("./webinosPath.js");
    var red   = '\u001b[31m';
    var green = '\u001b[32m';
    var yellow = '\u001b[33m';
    var blue = '\u001b[34m';
    var cyan = '\u001b[36m';
    var white = '\u001b[37m';
    var reset = '\u001b[39m';

    var logDebugMsg = util.print;
    var logErrMsg = util.error;

    /**
     * For android we should use a native module in order
     * to have javascript logging on logcat,
     * even for non rooted devices.
     */
    if (os.platform() === 'android') {
        var dbg = null;
        try {dbg = require('debuglog.node');} catch (e) {} //check that the distributed precompiled native code loads
        if (dbg!=null){
            logDebugMsg = console.log = function() {
                dbg.log(Array.prototype.slice.call(arguments).join(" ")); //convert arguments to array and join the to string
            };
            logErrMsg = console.error = function() {
                dbg.error(Array.prototype.slice.call(arguments).join(" ")); //convert arguments to array and join them and join the to string
            };
        }
    }

    function getLineNumber () {
        var error = new Error ();
        return ((os.type ().toLowerCase () === "windows_nt")?(error.stack.split ('\n')[3].split (':')[2]):(error.stack.split ('\n')[3].split (':')[1]));
    }

    function getTime() {
        var date = new Date();
        var date_ = date.getDate() < 10 ? "0" + date.getDate(): date.getDate();
        var month_ = (date.getMonth() + 1) < 10 ? "0"+date.getMonth(): (date.getMonth()+1);
        var hour_ = date.getHours () < 10 ? "0"+date.getHours(): date.getHours();
        var min_ = date.getMinutes() < 10 ? "0"+date.getMinutes(): date.getMinutes();
        var sec_ = date.getSeconds () < 10 ? "0"+date.getSeconds():date.getSeconds();
        var milliSeconds = date.getMilliseconds() < 10? "00"+date.getMilliseconds(): (date.getMilliseconds() <100)? "0"+date.getMilliseconds(): date.getMilliseconds();
        return  (date_ + "." + month_ + "." + date.getFullYear() + " " + hour_ + ":" + min_ + ":" + sec_ + ":" + milliSeconds);
    }

    var logging = {
        name:filename,
        id  :""
    };

    logging.setConfig = function(inputConfig) {
        var debug = inputConfig && inputConfig.debug ? true : false;
        config = {"debug": debug};
    };

    logging.addType = function (name) {
        new LogInstance (name, function (_writeError, _writeInfo) {
            writeError[name] = _writeError;
            writeInfo[name] = _writeInfo;
        });
    };

    logging.addId = function (id) {
        this.id = id;
    };

    logging.error = function (msg) {
        var name;
        var id = this.id ? " [" + this.id + "] " : " ";
        if (typeof msg === "object") {msg = util.inspect(msg,  { showHidden: true, depth: 3, colors: true });}
        if (os.type ().toLowerCase () === "windows_nt") { name = this.name.split ("\\").pop (); } else { name = this.name.split ("/").pop ();}
        var formattedMsg = yellow + "[" + getTime() + "]"+red+" error   " + green + name + "(" + getLineNumber () + ")" + id + red + msg + reset + "\n";
        logErrMsg(formattedMsg);
        this.writeLog ("error", "<p>" + formattedMsg + "</p>");
    };

    logging.info = function (msg) {
        var name;
        var id = this.id ? " [" + this.id + "]  " : " ";
        if (typeof msg === "object") {msg = util.inspect(msg);}
        if (os.type ().toLowerCase () === "windows_nt") { name = this.name.split ("\\").pop (); } else { name = this.name.split ("/").pop ();}
        var formattedMsg = yellow + "[" + getTime() + "]"+ white+" info    " + green + name + "(" + getLineNumber () + ")" + id + cyan + msg + reset + "\n";
        logDebugMsg(formattedMsg);
        this.writeLog ("info", "<p>" + formattedMsg + "</p>");
    };

    logging.log = function (msg) {
        if (!config.debug) return;

        var name;
        var id = this.id ? " [" + this.id + "]  " : " ";
        if (typeof msg === "object") {msg = util.inspect(msg);}
        if (os.type ().toLowerCase () === "windows_nt") { name = this.name.split ("\\").pop (); } else { name = this.name.split ("/").pop ();}
        var formattedMsg = yellow + "[" + getTime() + "]"+ blue+" verbose " + green + name + "(" + getLineNumber () + ")" + id + cyan + msg + reset + "\n";
        logDebugMsg(formattedMsg);
        this.writeLog ("info", "<p>" + formattedMsg + "</p>");
    };

    logging.writeLog = function (type, msg) {
        if (writeError[this.id] && type === "error") {
            writeError[this.id].write (msg);
        } else if (writeInfo[this.id] && type === "info") {
            writeInfo[this.id].write (msg);
        }
    };

    logging.fetchLog = function (logType, webinosType, friendlyName, callback) {
        var wId = require("./webinosId.js");
        var config = {friendlyName: friendlyName};
        wId.fetchWebinosName (webinosType, config, function (instanceName) {
            var filename = path.join (wPath.webinosPath() + "/logs/", instanceName + "_" + logType + ".json");
            fs.readFile (filename, function (err, data) {
                if (!err) {
                    callback (data.toString ());
                } else {
                    if (err.code === "ENOENT")
                        callback ("no errors reported");
                    else
                        callback (err.message);
                }
            });
        });
    };


    var LogInstance = function (name, callback) {
        function createWriteInfo(nodeVersionResolve, name, writeError, callback){
            var filename = path.join (wPath.webinosPath (), "logs", name + "_info.json");
            var writeInfo;
            nodeVersionResolve.exists (filename, function (err) {
                if (!err) {
                    fs.writeFile (filename, "", function (err) {
                        if (!err) {
                            writeInfo = fs.createWriteStream (filename, { flags:"a", encoding:"utf8"});
                            return callback (writeError, writeInfo);
                        }
                    });
                } else {
                    writeInfo = fs.createWriteStream (filename, { flags:"a", encoding:"utf8"});
                    return callback (writeError, writeInfo);
                }

            });
        }
        try {
            var split = (process.version.split (".") && process.version.split (".")[1]) || "6";
            var nodeVersionResolve = (parseInt (split) >= 8) ? fs : path;
            var filename = path.join (wPath.webinosPath(), "logs", name + "_error.json");
            var writeError;
            nodeVersionResolve.exists (filename, function (err) {
                if (!err) {
                    fs.writeFile (filename, "", function (err) {
                        if (!err) {
                            writeError = fs.createWriteStream (filename, { flags:"a", encoding:"utf8"});
                            createWriteInfo(nodeVersionResolve, name, writeError, callback);
                        }
                    });
                } else {
                    writeError = fs.createWriteStream (filename, { flags:"a", encoding:"utf8"});
                    createWriteInfo(nodeVersionResolve, name, writeError, callback);
                }
            });
        } catch (err) {
            console.log ("Error Initializing logs" + err);
        }
    };

    return logging;
}

module.exports = WebinosLogging;
