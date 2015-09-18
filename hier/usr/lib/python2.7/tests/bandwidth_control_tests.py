import unittest2
import time
import sys
import pdb
import os
import re
import subprocess
import copy
import socket

from jsonrpc import ServiceProxy
from jsonrpc import JSONRPCException
from uvm import Manager
from uvm import Uvm
import remote_control
import global_functions
import test_registry
import global_functions

uvmContext = Uvm().getUvmContext()
defaultRackId = 1
node = None
nodeWF = None
limitedAcceptanceRatio = .3 # 30% - limited severly is 10% by default, anything under 30% will be accepted as successfull
origNetworkSettings = None
origNetworkSettingsWithQoS = None
wanLimitKbit = None
wanLimitMbit = None

def createBandwidthSingleMatcherRule( matcherType, value, actionType="SET_PRIORITY", priorityValue=3 ):
    matcherTypeStr = str(matcherType)
    valueStr = str(value)
    return {
        "action": {
            "actionType": actionType,
            "javaClass": "com.untangle.node.bandwidth_control.BandwidthControlRuleAction",
            "priority": priorityValue
            },
        "description": "test bandwidth rule",
        "ruleId": 1,
        "javaClass": "com.untangle.node.bandwidth_control.BandwidthControlRule",
        "enabled": True,
        "matchers": {
            "javaClass": "java.util.LinkedList",
            "list": [
                {
                    "invert": False,
                    "javaClass": "com.untangle.node.bandwidth_control.BandwidthControlRuleMatcher",
                    "matcherType": matcherTypeStr,
                    "value": valueStr
                }
            ]                
        }
    }

def createBandwidthPenaltyRule( matcherType, value, actionType="PENALTY_BOX_CLIENT_HOST", penaltyValue=1000 ):
    matcherTypeStr = str(matcherType)
    valueStr = str(value)
    return {
        "action": {
            "actionType": actionType,
            "javaClass": "com.untangle.node.bandwidth_control.BandwidthControlRuleAction",
            "penaltyTime": penaltyValue
        },
        "description": "penalty",
        "ruleId": 1,
        "enabled": True,
        "javaClass": "com.untangle.node.bandwidth_control.BandwidthControlRule",
        "matchers": {
            "javaClass": "java.util.LinkedList",
            "list": [
                {
                    "invert": False,
                    "javaClass": "com.untangle.node.bandwidth_control.BandwidthControlRuleMatcher",
                    "matcherType": matcherTypeStr,
                    "value": value
                }
            ]
        }
    }
            
def createBandwidthQuotaRule( matcherType, value, actionType="GIVE_CLIENT_HOST_QUOTA", quotaValue=100 ):
    matcherTypeStr = str(matcherType)
    valueStr = str(value)
    return {
        "action": {
            "actionType": "GIVE_CLIENT_HOST_QUOTA",
            "javaClass": "com.untangle.node.bandwidth_control.BandwidthControlRuleAction",
            "quotaBytes": quotaValue,
            "quotaTime": -3
        },
        "description": "quota",
        "ruleId": 2,
        "enabled": True,
        "javaClass": "com.untangle.node.bandwidth_control.BandwidthControlRule",
        "matchers": {
            "javaClass": "java.util.LinkedList",
            "list": [
                {
                    "invert": False,
                    "javaClass": "com.untangle.node.bandwidth_control.BandwidthControlRuleMatcher",
                    "matcherType": matcherTypeStr,
                    "value": valueStr
                }
            ]
        },
    }
    
def createQoSCustomRule( matcherType, value, priorityValue=3 ):
    matcherTypeStr = str(matcherType)
    valueStr = str(value)
    return {
        "description": "bypass " + matcherTypeStr + " ATS",
        "enabled": True,
        "javaClass": "com.untangle.uvm.network.QosRule",
        "matchers": {
            "javaClass": "java.util.LinkedList",
            "list": [
                {
                    "invert": False,
                    "javaClass": "com.untangle.uvm.network.QosRuleMatcher",
                    "matcherType": matcherTypeStr,
                    "value": valueStr
                },
                {
                    "invert": False, 
                    "javaClass": "com.untangle.uvm.network.QosRuleMatcher", 
                    "matcherType": "PROTOCOL", 
                    "value": "TCP,UDP"
                }
                
            ]                
        },
        "priority": priorityValue,
        "ruleId": 5
    }
    
def createBypassMatcherRule( matcherType, value):
    return {
        "bypass": True, 
        "description": "test bypass " + str(matcherType) + " " + str(value), 
        "enabled": True, 
        "javaClass": "com.untangle.uvm.network.BypassRule", 
        "matchers": {
            "javaClass": "java.util.LinkedList", 
            "list": [
                {
                    "invert": False, 
                    "javaClass": "com.untangle.uvm.network.BypassRuleMatcher", 
                    "matcherType": str(matcherType), 
                    "value": str(value)
                }, 
                {
                    "invert": False, 
                    "javaClass": "com.untangle.uvm.network.BypassRuleMatcher", 
                    "matcherType": "PROTOCOL", 
                    "value": "TCP,UDP"
                }
            ]
        }, 
        "ruleId": 1
    } 

def appendRule(newRule):
    rules = node.getRules()
    rules["list"].append(newRule)
    node.setRules(rules)

def nukeRules():
    rules = node.getRules()
    rules["list"] = []
    node.setRules(rules)
    
def printResults( wget_speed_pre, wget_speed_post, expected_speed, allowed_speed ):
        print "Pre Results   : %s KB/s" % str(wget_speed_pre)
        print "Post Results  : %s KB/s" % str(wget_speed_post)
        print "Expected Post : %s KB/s" % str(expected_speed)
        print "Allowed Post  : %s KB/s" % str(allowed_speed)
        print "Summary: %s < %s = %s" % (wget_speed_post, allowed_speed, str( wget_speed_post < allowed_speed ))

class BandwidthControlTests(unittest2.TestCase):

    @staticmethod
    def nodeName():
        return "untangle-node-bandwidth-control"

    @staticmethod
    def nodeNameWF():
        return "untangle-node-web-filter"

    @staticmethod
    def vendorName():
        return "Untangle"

    @staticmethod
    def displayName():
        return "Bandwidth Control"

    def setUp(self):
        global node, nodeWF, origNetworkSettings
        if node == None:
            if (uvmContext.nodeManager().isInstantiated(self.nodeName())):
                print "ERROR: Node %s already installed" % self.nodeName()
                raise Exception('node %s already instantiated' % self.nodeName())
            node = uvmContext.nodeManager().instantiate(self.nodeName(), defaultRackId)
        if nodeWF == None:
            if (uvmContext.nodeManager().isInstantiated(self.nodeNameWF())):
                print "ERROR: Node %s already installed" % self.nodeNameWF()
                raise Exception('node %s already instantiated' % self.nodeNameWF())
            nodeWF = uvmContext.nodeManager().instantiate(self.nodeNameWF(), defaultRackId)
        if origNetworkSettings == None:
            origNetworkSettings = uvmContext.networkManager().getNetworkSettings()

    # verify client is online
    def test_010_clientIsOnline(self):
        result = remote_control.isOnline()
        assert (result == 0)

    def test_011_enableQoS(self):
        global origNetworkSettingsWithQoS, node, wanLimitKbit, wanLimitMbit

        netsettings = copy.deepcopy( origNetworkSettings )

        # disable QoS for speed test if enabled
        if netsettings['qosSettings']['qosEnabled']:
            print "Disabling QoS for speed test"
            netsettings['qosSettings']['qosEnabled'] = False
            uvmContext.networkManager().setNetworkSettings( netsettings )

        preDownSpeedKbsec = global_functions.getDownloadSpeed()

        wanLimitKbit = int((preDownSpeedKbsec*8) * .9)
        # set max to 100Mbit, so that other limiting factors dont interfere
        if wanLimitKbit > 100000: wanLimitKbit = 100000 

        wanLimitMbit = round(wanLimitKbit/1024,2)

        print "Setting WAN limit: %i Kbps" % (wanLimitKbit)

        # turn on QoS and set bandwidth
        netsettings['qosSettings']['qosEnabled'] = True
        
        # Set wan limits & bypass and qos rules
        i = 0
        for interface in netsettings['interfaces']['list']:
            if interface['isWan']:
                netsettings['interfaces']['list'][i]['downloadBandwidthKbps']=wanLimitKbit
                netsettings['interfaces']['list'][i]['uploadBandwidthKbps']=wanLimitKbit
            i += 1
        netsettings['bypassRules']['list'] = []
        netsettings['qosSettings']['qosRules']['list'] = []

        # save settings
        print "Enableding QoS"
        origNetworkSettingsWithQoS = copy.deepcopy( netsettings )

        uvmContext.networkManager().setNetworkSettings(netsettings)
        postDownSpeedKbsec = global_functions.getDownloadSpeed()

        # now that QoS is enabled - start the node
        # must be called since bandwidth doesn't auto-start
        settings = node.getSettings()
        settings["configured"] = True
        node.setSettings(settings)        
        nukeRules()
        node.start() 

        # since the limit is 90% of first measure, check that second measure is less than first measure
        assert (preDownSpeedKbsec >  postDownSpeedKbsec)

    def test_013_qosBypassCustomRules(self):
        global node
        nukeRules()
        priority_level = 7
        # Record average speed without bandwidth control configured
        wget_speed_pre = global_functions.getDownloadSpeed()

        # Create SRC_ADDR based custom Q0S rule to limit bypass QoS
        netsettings = copy.deepcopy( origNetworkSettingsWithQoS )
        netsettings['qosSettings']['qosRules']["list"].append( createQoSCustomRule("SRC_ADDR",remote_control.clientIP,priority_level) )
        netsettings['bypassRules']['list'].append( createBypassMatcherRule("SRC_ADDR",remote_control.clientIP) )
        uvmContext.networkManager().setNetworkSettings( netsettings )
        
        # Download file and record the average speed in which the file was download
        wget_speed_post = global_functions.getDownloadSpeed()

        # Restore original network settings
        uvmContext.networkManager().setNetworkSettings( origNetworkSettingsWithQoS )
        
        printResults( wget_speed_pre, wget_speed_post, wget_speed_pre*0.1, wget_speed_pre*limitedAcceptanceRatio )

        assert ((wget_speed_pre) and (wget_speed_post))
        assert (wget_speed_pre * limitedAcceptanceRatio >  wget_speed_post)

    def test_014_qosBypassCustomRulesUDP(self):
        global wanLimitMbit
        targetSpeedMbit = str(wanLimitMbit)+"M"
        if remote_control.quickTestsOnly:
            raise unittest2.SkipTest('Skipping a time consuming test')
        # We will use iperf server and iperf for this test.
        wan_IP = uvmContext.networkManager().getFirstWanAddress()
        iperfAvailable = global_functions.verifyIperf(wan_IP)
        if (not iperfAvailable):
            raise unittest2.SkipTest("Iperf server and/or iperf not available")

        netsettings = uvmContext.networkManager().getNetworkSettings()
        netsettings['bypassRules']['list'].append( createBypassMatcherRule("DST_PORT","5000") )
        netsettings['qosSettings']['qosRules']["list"].append( createQoSCustomRule("DST_PORT","5000", 1) )
        uvmContext.networkManager().setNetworkSettings( netsettings )

        pre_UDP_speed = global_functions.getUDPSpeed( receiverIP=global_functions.iperfServer, senderIP=remote_control.clientIP, targetRate=targetSpeedMbit )

        netsettings['qosSettings']['qosRules']['list'] = []
        netsettings['qosSettings']['qosRules']["list"].append( createQoSCustomRule("DST_PORT","5000", 7) )
        uvmContext.networkManager().setNetworkSettings( netsettings )

        post_UDP_speed = global_functions.getUDPSpeed( receiverIP=global_functions.iperfServer, senderIP=remote_control.clientIP, targetRate=targetSpeedMbit )
        
        # Restore original network settings

        uvmContext.networkManager().setNetworkSettings( origNetworkSettingsWithQoS )

        printResults( pre_UDP_speed, post_UDP_speed, (wanLimitKbit/8)*0.1, pre_UDP_speed*.9 )
        assert (post_UDP_speed < pre_UDP_speed*.9)

    def test_015_qosNoBypassCustomRules(self):
        global node
        nukeRules()
        priority_level = 7

        # Record average speed without bandwidth control configured
        wget_speed_pre = global_functions.getDownloadSpeed()

        # Create SRC_ADDR based custom Q0S rule to limit bypass QoS
        netsettings = copy.deepcopy( origNetworkSettingsWithQoS )
        netsettings['qosSettings']['qosRules']["list"].append(createQoSCustomRule("SRC_ADDR",remote_control.clientIP,priority_level))
        uvmContext.networkManager().setNetworkSettings( netsettings )
        
        # Download file and record the average speed in which the file was download
        wget_speed_post = global_functions.getDownloadSpeed()

        # Restore original network settings
        uvmContext.networkManager().setNetworkSettings( origNetworkSettingsWithQoS )
        
        # Because the session is NOT bypassed, the QoS rule should not take effect
        printResults( wget_speed_pre, wget_speed_post, wget_speed_pre*0.1, wget_speed_pre*limitedAcceptanceRatio )

        assert ((wget_speed_pre) and (wget_speed_post))
        assert (not (wget_speed_pre * limitedAcceptanceRatio >  wget_speed_post))

    def test_024_srcAddrRule(self):
        global node
        nukeRules()
        priority_level = 7
        # Record average speed without bandwidth control configured
        wget_speed_pre = global_functions.getDownloadSpeed()

        # Create SRC_ADDR based rule to limit bandwidth
        appendRule(createBandwidthSingleMatcherRule("SRC_ADDR",remote_control.clientIP,"SET_PRIORITY",priority_level))
        # Set the configured flag otherwise bandwidth fails to power on.
        settings = node.getSettings()
        settings["configured"] = True
        node.setSettings(settings)        
        # Download file and record the average speed in which the file was download
        wget_speed_post = global_functions.getDownloadSpeed()

        printResults( wget_speed_pre, wget_speed_post, wget_speed_pre*0.1, wget_speed_pre*limitedAcceptanceRatio )

        assert ((wget_speed_post) and (wget_speed_post))
        assert (wget_speed_pre * limitedAcceptanceRatio >  wget_speed_post)

        events = global_functions.get_events('Bandwidth Control','Prioritized Sessions',None,1)
        assert(events != None)
        found = global_functions.check_events( events.get('list'), 5, 
                                            "bandwidth_control_priority", priority_level,
                                            "c_client_addr", remote_control.clientIP)
        assert( found )

    def test_035_dstAddrRule(self):
        global node
        nukeRules()
        priority_level = 7

        # Get the IP address of test.untangle.com.  We could hardcoded this IP.
        test_untangle_IP = socket.gethostbyname("test.untangle.com")
        
        # Record average speed without bandwidth control configured
        wget_speed_pre = global_functions.getDownloadSpeed()
        
        # Create DST_ADDR based rule to limit bandwidth
        appendRule(createBandwidthSingleMatcherRule("DST_ADDR",test_untangle_IP,"SET_PRIORITY",priority_level))
        # Set the configured flag otherwise bandwidth fails to power on.
        settings = node.getSettings()
        settings["configured"] = True
        node.setSettings(settings)        

        # Download file and record the average speed in which the file was download
        wget_speed_post = global_functions.getDownloadSpeed()

        printResults( wget_speed_pre, wget_speed_post, wget_speed_pre*0.1, wget_speed_pre*limitedAcceptanceRatio )

        assert ((wget_speed_post) and (wget_speed_post))
        assert (wget_speed_pre * limitedAcceptanceRatio >  wget_speed_post)

        events = global_functions.get_events('Bandwidth Control','Prioritized Sessions',None,1)
        assert(events != None)
        found = global_functions.check_events( events.get('list'), 5, 
                                            "bandwidth_control_priority", priority_level,
                                            "c_client_addr", remote_control.clientIP)
        assert( found )

    def test_045_dstPortRule(self):
        global node
        nukeRules()
        priority_level = 7

        # Record average speed without bandwidth control configured
        wget_speed_pre = global_functions.getDownloadSpeed()
        
        # Create DST_PORT based rule to limit bandwidth
        appendRule(createBandwidthSingleMatcherRule("DST_PORT","80","SET_PRIORITY",priority_level))
        # Set the configured flag otherwise bandwidth fails to power on.
        settings = node.getSettings()
        settings["configured"] = True
        node.setSettings(settings)        

        # Download file and record the average speed in which the file was download
        wget_speed_post = global_functions.getDownloadSpeed()
        
        printResults( wget_speed_pre, wget_speed_post, wget_speed_pre*0.1, wget_speed_pre*limitedAcceptanceRatio )

        assert ((wget_speed_post) and (wget_speed_post))
        assert (wget_speed_pre * limitedAcceptanceRatio >  wget_speed_post)

        events = global_functions.get_events('Bandwidth Control','Prioritized Sessions',None,1)
        assert(events != None)
        found = global_functions.check_events( events.get('list'), 5, 
                                            "bandwidth_control_priority", priority_level,
                                            "c_client_addr", remote_control.clientIP)
        assert( found )

    def test_046_dstPortRuleUDP(self):
        global node, nodeWF, wanLimitMbit
        # only use 30% because QoS will limit to 10% and we want to make sure it takes effect
        # really high levels will actually be limited by the untangle-vm throughput instead of QoS
        # which can interfere with the test
        targetSpeedMbit = str(wanLimitMbit*.3)+"M"
        if remote_control.quickTestsOnly:
            raise unittest2.SkipTest('Skipping a time consuming test')
        # We will use iperf server and iperf for this test.
        wan_IP = uvmContext.networkManager().getFirstWanAddress()
        iperfAvailable = global_functions.verifyIperf(wan_IP)
        if (not iperfAvailable):
            raise unittest2.SkipTest("Iperf server and/or iperf not available, skipping alternate port forwarding test")
        # Enabled QoS
        netsettings = uvmContext.networkManager().getNetworkSettings()
        if not netsettings['qosSettings']['qosEnabled']:
            netsettings['qosSettings']['qosEnabled'] = True
            uvmContext.networkManager().setNetworkSettings( netsettings )
        nukeRules()

        appendRule(createBandwidthSingleMatcherRule("DST_PORT","5000","SET_PRIORITY",1))
            
        pre_UDP_speed = global_functions.getUDPSpeed( receiverIP=global_functions.iperfServer, senderIP=remote_control.clientIP, targetRate=targetSpeedMbit )

        # Create DST_PORT based rule to limit bandwidth
        nukeRules()
        appendRule(createBandwidthSingleMatcherRule("DST_PORT","5000","SET_PRIORITY",7))

        post_UDP_speed = global_functions.getUDPSpeed( receiverIP=global_functions.iperfServer, senderIP=remote_control.clientIP, targetRate=targetSpeedMbit )

        printResults( pre_UDP_speed, post_UDP_speed, (wanLimitKbit/8)*0.1, pre_UDP_speed*.9 )
        assert (post_UDP_speed < pre_UDP_speed*.9)

    def test_047_hostnameRule(self):
        global node
        nukeRules()
        priority_level = 7
        # This test might need web filter for untangle-casing-http to start
        # Record average speed without bandwidth control configured
        wget_speed_pre = global_functions.getDownloadSpeed()
        
        # Create HTTP_HOST based rule to limit bandwidth
        appendRule(createBandwidthSingleMatcherRule("HTTP_HOST","test.untangle.com","SET_PRIORITY",priority_level))
        # Set the configured flag otherwise bandwidth fails to power on.
        settings = node.getSettings()
        settings["configured"] = True
        node.setSettings(settings)        

        # Download file and record the average speed in which the file was download
        wget_speed_post = global_functions.getDownloadSpeed()
        
        printResults( wget_speed_pre, wget_speed_post, wget_speed_pre*0.1, wget_speed_pre*limitedAcceptanceRatio )

        assert ((wget_speed_post) and (wget_speed_post))
        assert (wget_speed_pre * limitedAcceptanceRatio >  wget_speed_post)

        events = global_functions.get_events('Bandwidth Control','Prioritized Sessions',None,1)
        assert(events != None)
        found = global_functions.check_events( events.get('list'), 5, 
                                            "bandwidth_control_priority", priority_level,
                                            "c_client_addr", remote_control.clientIP)
        assert( found )

    def test_048_contentLengthAddrRule(self):
        global node
        nukeRules()
        priority_level = 7

        # Record average speed without bandwidth control configured
        wget_speed_pre = global_functions.getDownloadSpeed()
        
        # Create DST_ADDR based rule to limit bandwidth
        appendRule(createBandwidthSingleMatcherRule("HTTP_CONTENT_LENGTH",">3000000","SET_PRIORITY",priority_level))
        # Set the configured flag otherwise bandwidth fails to power on.
        settings = node.getSettings()
        settings["configured"] = True
        node.setSettings(settings)        

        # Download file and record the average speed in which the file was download
        wget_speed_post = global_functions.getDownloadSpeed()

        printResults( wget_speed_pre, wget_speed_post, wget_speed_pre*0.1, wget_speed_pre*limitedAcceptanceRatio )

        assert ((wget_speed_post) and (wget_speed_post))
        assert (wget_speed_pre * limitedAcceptanceRatio >  wget_speed_post)

        events = global_functions.get_events('Bandwidth Control','Prioritized Sessions',None,1)
        assert(events != None)
        found = global_functions.check_events( events.get('list'), 5, 
                                            "bandwidth_control_priority", priority_level,
                                            "c_client_addr", remote_control.clientIP)
        assert( found )

    def test_050_webFilterFlaggedRule(self):
        global node, nodeWF
        nukeRules()
        priority_level = 7
        # This test might need web filter for untangle-casing-http to start
        # Record average speed without bandwidth control configured
        wget_speed_pre = global_functions.getDownloadSpeed()
        
        # Create WEB_FILTER_FLAGGED based rule to limit bandwidth
        appendRule(createBandwidthSingleMatcherRule("WEB_FILTER_FLAGGED","true","SET_PRIORITY",priority_level))
        # Set the configured flag otherwise bandwidth fails to power on.
        settings = node.getSettings()
        settings["configured"] = True
        node.setSettings(settings)        

        # Test.untangle.com is listed as Software, Hardware in web filter. As of 1/2014 its in Technology 
        settingsWF = nodeWF.getSettings()
        i = 0
        untangleCats = ["Software,", "Technology"]
        for webCategories in settingsWF['categories']['list']:
            if any(x in webCategories['name'] for x in untangleCats):
                settingsWF['categories']['list'][i]['flagged'] = "true"
            i += 1
        nodeWF.setSettings(settingsWF)

        # Download file and record the average speed in which the file was download
        wget_speed_post = global_functions.getDownloadSpeed()
        
        printResults( wget_speed_pre, wget_speed_post, wget_speed_pre*0.1, wget_speed_pre*limitedAcceptanceRatio )

        assert ((wget_speed_post) and (wget_speed_post))
        assert (wget_speed_pre * limitedAcceptanceRatio >  wget_speed_post)

        events = global_functions.get_events('Bandwidth Control','Prioritized Sessions',None,1)
        assert(events != None)
        found = global_functions.check_events( events.get('list'), 5, 
                                            "bandwidth_control_priority", priority_level,
                                            "c_client_addr", remote_control.clientIP)
        assert( found )

    def test_060_quotaPenaltyRule(self):
        global node
        nukeRules()
        given_quota = 100
        penalty_time = 2000000
        penalty_time_margin_error = penalty_time * 1.05  # we seem to add a few milliseconds in the code

        # Enabled QoS
        netsettings = uvmContext.networkManager().getNetworkSettings()
        if not netsettings['qosSettings']['qosEnabled']:
            netsettings['qosSettings']['qosEnabled'] = True
            uvmContext.networkManager().setNetworkSettings( netsettings )
        # Create rule to give quota
        appendRule(createBandwidthQuotaRule("CLIENT_HAS_NO_QUOTA","true","GIVE_CLIENT_HOST_QUOTA",given_quota))
        # Create penalty for exceeding quota
        appendRule(createBandwidthPenaltyRule("CLIENT_QUOTA_EXCEEDED","true","PENALTY_BOX_CLIENT_HOST",penalty_time))
        
        # Set the configured flag otherwise bandwidth fails to power on.
        settings = node.getSettings()
        settings["configured"] = True
        node.setSettings(settings)
        node.start()  # in case bandwidth was not started in previous tsst.
        #  in case the client is already in the penalty box
        uvmContext.hostTable().releaseHostFromPenaltyBox(remote_control.clientIP)
        uvmContext.hostTable().refillQuota(remote_control.clientIP)

        # Get test.untangle.com to exceed given quota
        result = remote_control.isOnline()

        status_of_host = uvmContext.hostTable().getHostTableEntry(remote_control.clientIP)
        # remove from penalty box before testing status
        uvmContext.hostTable().releaseHostFromPenaltyBox(remote_control.clientIP)
        uvmContext.hostTable().removeQuota(remote_control.clientIP)
        # print "status_of_host : %s" % str(status_of_host)
        penalty_assigned_time = (status_of_host['penaltyBoxExitTime'] - status_of_host['penaltyBoxEntryTime']) / 1000
        # print " : %s" % exit_time_string
        # print "penalty_assigned_time : %s" % penalty_assigned_time
        assert(status_of_host['penaltyBoxed'])       
        assert(status_of_host['quotaSize'] == given_quota)
        assert(penalty_assigned_time < penalty_time_margin_error)
        
        # check quota event
        events = global_functions.get_events('Host Viewer','Quota Events',None,1)
        assert(events != None)
        found = global_functions.check_events( events.get('list'), 5, 
                                            "size", given_quota,
                                            "address", remote_control.clientIP)
        assert(found)

        # check penalty box
        events = global_functions.get_events('Host Viewer','Penalty Box Events',None,1)
        assert(events != None)
        found = global_functions.check_events( events.get('list'), 5, 
                                            "address", remote_control.clientIP)
        assert(found)

    @staticmethod
    def finalTearDown(self):
        global node, nodeWF, origNetworkSettings
        # Restore original settings to return to initial settings
        if origNetworkSettings != None:
            uvmContext.networkManager().setNetworkSettings( origNetworkSettings )
        if node != None:
            uvmContext.nodeManager().destroy( node.getNodeSettings()["id"] )
            node = None
        if nodeWF != None:
            uvmContext.nodeManager().destroy( nodeWF.getNodeSettings()["id"] )
            nodeWF = None


test_registry.registerNode("bandwidth-control", BandwidthControlTests)

