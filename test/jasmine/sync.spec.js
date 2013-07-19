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
 *******************************************************************************/
var sync_manager = require("../../index.js");

var pzh_crl = {
  value:"-----BEGIN X509 CRL-----\n-----END X509 CRL-----\n"
};

var pzh_cert={
  "master": {
  "key_id": "ws-0824u_master",
  "cert": "-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----\n"
 },
 "conn": {
  "key_id": "ws-0824u_conn",
  "cert": "-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----\n"
 },
 "web": {},
 "webssl": {
  "key_id": "ws-0824u_webssl",
  "cert": "-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----\n"
 },
 "webclient": {
  "key_id": "ws-0824u_webclient",
  "cert": "-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----\n"
 }
};

var pzh_userData={
 "country": "UK",
 "state": "MX",
 "city": "London",
 "orgname": "Webinos",
 "orgunit": "WP4",
 "cn": "",
 "email": "hello@webinos.org"
};

var pzh_userPref = {
 "ports": {
  "provider": 6080,
  "provider_webServer": 6443
 }
};

var pzp_policy = "<policy combine=\"first-applicable\" description=\"catch\"> \
    <rule effect=\"permit\"></rule>\
    <DataHandlingPreferences PolicyId=\"#DHP_allow_all\">\
        <AuthorizationsSet>\
            <AuthzUseForPurpose>\
            <Purpose/>\
            </AuthzUseForPurpose>\
        </AuthorizationsSet>\
    </DataHandlingPreferences>\
    <ProvisionalActions>\
        <ProvisionalAction>\
            <AttributeValue>#DHP_allow_all</AttributeValue>\
            <AttributeValue>http://webinos.org</AttributeValue>\
        </ProvisionalAction>\
        <ProvisionalAction>\
            <AttributeValue>#DHP_allow_all</AttributeValue>\
            <AttributeValue>http://www.w3.org</AttributeValue>\
        </ProvisionalAction>\
        <ProvisionalAction>\
            <AttributeValue>#DHP_allow_all</AttributeValue>\
            <AttributeValue>http://wacapps.net</AttributeValue>\
        </ProvisionalAction>\
    </ProvisionalActions>\
    </policy>";
var pzp_cert = {
 "master": {
  "key_id": "ws-0824u_master",
  "cert": "-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----\n"
 },
 "conn": {
  "key_id": "ws-0824u_conn",
  "cert": "-----BEGIN CERTIFICATE-----\n-----END CERTIFICATE-----\n"
 }
};
var pzp_userData={
 "country": "UK",
 "state": "MX",
 "city": "London",
 "orgname": "Webinos",
 "orgunit": "WP4",
 "cn": "",
 "email": "hello@webinos.org"
};

var pzp_userPref = {
 "ports": {
  "provider": 80,
  "provider_webServer": 6443,
  "pzp_webSocket": 8080,
  "pzp_tlsServer": 8040,
  "pzp_zeroConf": 4321,
  "iot": 3000
 }
};
var pzp_sync, pzh_sync, pzhSyncItems, pzpObject;
describe("Sync manager updates during PZP enrollment at PZH, also covers update from the PZH", function(){
    var pzpObj, compItems;
    it ("PZP initial sync message when PZP enrolls", function() {
        sync_manager.parseXML(pzp_policy, function(policyJson) {
            var pzpSyncItems = {crl: "", userData: pzp_userData, userPref: pzp_userPref, cert: pzp_cert, policy: policyJson["policy"]};
            pzp_sync = new sync_manager.sync(pzpSyncItems);
            pzpObj = pzp_sync.getObjectHash();
            expect(pzpObj).not.toBeNull();
            expect(typeof pzpObj).toEqual("object");
            expect(pzpObj.crl).not.toBeNull();
            expect(pzpObj.cert).not.toBeNull();
            expect(pzpObj.userData).not.toBeNull();
            expect(pzpObj.userPref).not.toBeNull();
            expect(pzpObj.policy).not.toBeNull();
        });
    });
    it ("PZH checks what to sync with PZP", function() {
        pzhSyncItems = {crl: pzh_crl, userData: pzh_userData, userPref: pzh_userPref, cert: pzh_cert, policy: ""};
        pzh_sync = new sync_manager.sync(pzhSyncItems);
        compItems = pzh_sync.compareObjectHash(pzpObj)
        expect(compItems).not.toBeNull();
        expect(typeof compItems).toEqual("object");
        expect(compItems.crl).not.toBeNull();
        expect(compItems.cert).not.toBeNull();
        expect(compItems.userData).toEqual(undefined);// Both PZH and PZP data are same, so this should not be present in compData
        expect(compItems.userPref).not.toBeNull();
    });
    it ("PZP applies changes", function() {
        expect(pzp_userPref.ports.provider).toEqual(80); // To determine a single value is too updated by Sync
        pzpObject = pzp_sync.applyObjectContents(compItems);
        expect(pzpObject).not.toBeNull();
        expect(typeof pzpObject).toEqual("object");
        expect(pzpObject.crl).not.toBeNull();
        expect(pzpObject.crl).toEqual(pzh_crl);
        expect(pzpObject.userData).not.toBeNull();
        expect(pzpObject.userData).toEqual(pzp_userData);
        expect(pzpObject.userData).toEqual(pzh_userData);
        expect(pzpObject.userPref).not.toBeNull();
        expect(pzpObject.userPref.ports.provider).toEqual(6080); // PZP port value will be overwritten by PZH value
        expect(Object.keys(pzpObject.userPref.ports).length).toBeGreaterThan(Object.keys(pzh_userPref.ports).length);
        expect(pzpObject.cert).not.toBeNull();
        expect(Object.keys(pzpObject.cert).length).toEqual(Object.keys(pzh_cert).length);
        expect(pzpObject.cert).toEqual(compItems.cert);
        expect(pzpObject.policy).not.toBeNull();
    });
});

describe("PZP updates sync with PZH", function() {
    it("PZP updates policy changes to the PZH" , function() {
        var diff = pzp_sync.compareObjectHash(pzh_sync.getObjectContents());// PZP find differences based on last sync message.
        expect(pzhSyncItems.policy).toEqual("");
        var pzhObject = pzh_sync.applyObjectHash(diff);
        expect(pzhObject.policy).toEqual(pzpObject.policy);
        expect(pzhObject.userData).toEqual(pzpObject.userData);
        expect(pzhObject.userPref).toEqual(pzpObject.userPref);
        expect(pzhObject.cert).toEqual(pzpObject.cert);
        expect(pzhObject.crl).toEqual(pzpObject.crl);
    });
});
