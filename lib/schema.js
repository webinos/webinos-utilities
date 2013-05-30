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
 * Copyright 2011-2013 Torsec -Computer and network security group-
 * Politecnico di Torino
 *
 ******************************************************************************/

(function () {
    'use strict';

    var JSV = require('JSV').JSV;
    var env = JSV.createEnvironment("json-schema-draft-03");

    var oldSchema = {
        'type': [{
            'type': 'object',
            'additionalProperties': false,
            'properties':{
                'type': {
                    'type': 'string',
                    'enum': ['prop'],
                    'required': true
                },
                'from': {
                    'type': ['string','null'],
                    'required': true
                },
                'to': {
                    'type': ['string','null'],
                    'required': true
                },
                'resp_to': {
                    'type': 'string',
                },
                'payload': {
                    'type': 'object',
                    'required': true
                }
            }
        },
        {
            'type': 'object',
            'additionalProperties': false,
            'properties':{
                'type': {
                    'type': 'string',
                    'enum': ['JSONRPC'],
                    'required': true
                },
                'from': {
                    'type': ['string','null'],
                    'required': true
                },
                'to': {
                    'type': ['string','null'],
                    'required': true
                },
                'resp_to': {
                    'type': 'string',
                },
                'register': {
                    'type':'boolean',
                },
                'id': {
                    'type': 'number',
                },
                'payload': {
                    'type': ['object', 'null'],
                    'required': true
                }
            }
        }]
    };

    /**
     * Validate messages
     * @name checkSchema
     * @function
     * @param msg Message to validate
     * @param version Message schema version
     */
    var checkSchema = function(msg, version) {
        var errors;

        // Validate messages defined in D3.3
        // http://dev.webinos.org/redmine/projects/wp3-3/wiki/Messaging_and_Routing
        if (version && version === 'D3.3') {
            errors = env.validate(msg, schema33).errors;
        // validate old messages
        } else {
            errors = env.validate(msg, oldSchema).errors;
        }

        if (errors.length == 0) {
            return false;
        }
        else {
            return true;
        }
    };

    exports.checkSchema = checkSchema;

}());
