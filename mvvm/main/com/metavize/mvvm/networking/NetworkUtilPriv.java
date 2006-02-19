/*
 * Copyright (c) 2003, 2004, 2005 Metavize Inc.
 * All rights reserved.
 *
 * This software is the confidential and proprietary information of
 * Metavize Inc. ("Confidential Information").  You shall
 * not disclose such Confidential Information.
 *
 *  $Id$
 */

package com.metavize.mvvm.networking;

import java.util.List;
import java.util.LinkedList;
import java.util.Iterator;
import java.util.Map;
import java.util.LinkedHashMap;
import java.util.HashMap;

import java.io.BufferedReader;
import java.io.FileReader;

import org.apache.log4j.Logger;

import com.metavize.mvvm.NetworkingConfiguration;
import com.metavize.mvvm.InterfaceAlias;
import com.metavize.mvvm.IntfConstants;

import com.metavize.mvvm.argon.ArgonException;
import com.metavize.mvvm.argon.IntfConverter;

import com.metavize.mvvm.tran.IPaddr;
import com.metavize.mvvm.tran.ValidateException;

import com.metavize.mvvm.networking.internal.NetworkSpacesInternalSettings;
import com.metavize.mvvm.networking.internal.NetworkSpaceInternal;
import com.metavize.mvvm.networking.internal.RouteInternal;
import com.metavize.mvvm.networking.internal.RedirectInternal;
import com.metavize.mvvm.networking.internal.InterfaceInternal;
import com.metavize.mvvm.networking.internal.ServicesInternalSettings;

/* Utilities that are only required inside of this package */
class NetworkUtilPriv extends NetworkUtil
{
    private static final Logger logger = Logger.getLogger( NetworkUtilPriv.class );

    private static final NetworkUtilPriv INSTANCE = new NetworkUtilPriv();

    /* Prefix for the bridge devices */
    private static final String BRIDGE_PREFIX  = "br";

    /* Index of the first network space */
    public static final int SPACE_INDEX_BASE = 0;

    private NetworkUtilPriv()
    {
    }

    /* Convert a NetworkConfiguration and the previous internal network settings into 
     * a new network spaces settings object.
     * @param networkingConfiguration:  New networking configuration for the primary space.
     * @param internalSettings: Current configuration for all of the other spaces.
     */
    public NetworkSpacesInternalSettings toInternal( BasicNetworkSettings basic,
                                                     NetworkSpacesInternalSettings internalSettings )
        throws NetworkException, ValidateException
    {        
        NetworkSpacesSettings settings = toSettings( internalSettings );
        
        /* Now replace the parameters for the first space */
        NetworkSpace primary = settings.getNetworkSpaceList().get( 0 );
        
        boolean isDhcpEnabled = basic.isDhcpEnabled();
        primary.setIsDhcpEnabled( basic.isDhcpEnabled());
        primary.setIsNatEnabled( false );
        primary.setNatSpace( null );
        primary.setNatAddress( null );
        primary.setIsDmzHostEnabled( false );
        primary.setIsDmzHostLoggingEnabled( false );
        primary.setDmzHost( null );
        List<IPNetworkRule> networkList = new LinkedList<IPNetworkRule>();
        
        if ( !isDhcpEnabled ) networkList.add( IPNetworkRule.makeInstance( basic.host(), basic.netmask()));
        
        /* Add all of the other networks from the alias list */
        for ( InterfaceAlias a : basic.getAliasList()) {
            networkList.add( IPNetworkRule.makeInstance( a.getAddress(), a.getNetmask()));
        }

        /* Set the network list */
        primary.setNetworkList( networkList );

        settings.setDefaultRoute( basic.gateway());
        settings.setDns1( basic.dns1());
        settings.setDns2( basic.dns2());            

        return toInternal( settings );
    }

    /** this function is a mess on almost every level */
    public NetworkSpacesInternalSettings toInternal( NetworkSpacesSettings networkSettings )
        throws NetworkException, ValidateException
    {        
        List<InterfaceInternal> interfaceList       = new LinkedList<InterfaceInternal>();
        List<NetworkSpaceInternal> networkSpaceList = new LinkedList<NetworkSpaceInternal>();
        List<RouteInternal> routingTable            = new LinkedList<RouteInternal>();

        /* This must be ordered, or else the network spaces come out, out of order */
        Map<NetworkSpace,SpaceInfo> spaceToInfoMap = new LinkedHashMap<NetworkSpace,SpaceInfo>();

        /* First pass, get all of the primary addresses and interface lists */
        List<Interface> intfListCopy = new LinkedList<Interface>( networkSettings.getInterfaceList());

        IntfConverter ic = IntfConverter.getInstance();

        int index = SPACE_INDEX_BASE;

        SpaceInfo primarySpaceInfo = null;
        for ( NetworkSpace networkSpace : networkSettings.getNetworkSpaceList()) {
            Interface primaryIntf = null;
            List<Interface> networkSpaceIntfList = new LinkedList<Interface>();

            String deviceName = BRIDGE_PREFIX + index;
            
            if ( networkSpace.isLive()) {
                for ( Iterator<Interface> iter = intfListCopy.iterator() ; iter.hasNext() ; ) {
                    Interface intf = iter.next();
                    
                    if ( intf.getNetworkSpace().equals( networkSpace )) {
                        try {
                            /* Set the name of the interface */
                            intf.setIntfName( ic.argonIntfToString( intf.getArgonIntf()));
                        } catch( ArgonException e ) {
                            logger.error( "Unable to retrieve the interface name for: " + 
                                          intf.getArgonIntf(), e );
                            throw new NetworkException( "Unable determine the interface name for intf: " + 
                                                        intf.getArgonIntf());
                        }
                        
                        /* If there are more than 1, it is a bridge anyway, so the primary interface
                         * doesn't matter */
                        primaryIntf = intf;
                        iter.remove();
                        
                        networkSpaceIntfList.add( intf );
                    }
                }

                switch ( networkSpaceIntfList.size()) {
                case 0:
                    throw new NetworkException( "Each enabled network space " + index +
                                                " must be mapped to an interface" );
                case 1:
                    deviceName = primaryIntf.getIntfName();
                    break;
                default:
                    /* Nothing to do */
                }
            }
            
            IPNetwork primaryAddress = getPrimaryAddress( networkSpace, index );

            SpaceInfo info = new SpaceInfo( networkSpace, deviceName, index, 
                                            networkSpaceIntfList, primaryAddress );

            spaceToInfoMap.put( networkSpace, info );
            if ( index == SPACE_INDEX_BASE ) primarySpaceInfo = info;
            index++;
        }
        
        if ( intfListCopy.size() > 0 ) {
            throw new NetworkException( "At least one interface [ " + intfListCopy +" ] was not" + 
                                        " bound to a network space." );
        }

        /** Set the NAT addresses on the second iteration, this is when the primary 
         * address has been set on all of the spaces. */
        for ( SpaceInfo info :  spaceToInfoMap.values()) {
            setNatAddress( info, spaceToInfoMap );
            
            NetworkSpaceInternal nwi = makeNetworkSpaceInternal( info );
            
            /* Iterate all of its interfaces and add them to the
             *  interface list, this allows the network space in the
             *  interface to be final and to also have a final mapping
             *  between the network space and the interface.  */
            for ( InterfaceInternal intf : nwi.getInterfaceList()) interfaceList.add( intf );

            /* Add the network space to the list of network spaces. */
            networkSpaceList.add( nwi );
        }

        /* Create all of the routing entries */
        for ( Route route : networkSettings.getRoutingTable()) {
            routingTable.add( RouteInternal.makeInstance( route ));
        }
        
        /* Thsese may come from DHCP */
        IPaddr dns1          = networkSettings.getDns1();
        IPaddr dns2          = networkSettings.getDns2();
        
        IPaddr defaultRoute  = networkSettings.getDefaultRoute();
        
        SetupState setupState = networkSettings.getSetupState();
        boolean isEnabled     = networkSettings.getIsEnabled();

        /* Create all of the redirects */
        List<RedirectInternal> redirectList = new LinkedList<RedirectInternal>();
        
        int redirectIndex = 1;
        for ( RedirectRule redirect : networkSettings.getRedirectList()) {
            redirectList.add( new RedirectInternal( redirect, redirectIndex++ ));
        }

        
        /* If necessary, move all of the interfaces into the primary network space */
        List<InterfaceInternal> realInterfaceList = interfaceList;
        if ( !isEnabled ) {
            realInterfaceList = new LinkedList<InterfaceInternal>();
            SpaceInfo i = primarySpaceInfo;
            SpaceInfo info = new SpaceInfo( i.getNetworkSpace(), BRIDGE_PREFIX + SPACE_INDEX_BASE,
                                            SPACE_INDEX_BASE, networkSettings.getInterfaceList(), 
                                            i.getPrimaryAddress());
            info.setNatAddress( null );

            NetworkSpaceInternal nwi = makeNetworkSpaceInternal( info );
            
            /* Create a list of all of the interfaces mapped to the first space */
            for ( InterfaceInternal intf : nwi.getInterfaceList()) realInterfaceList.add( intf );
            
            /* Replace the first space with the new one the network space to the list of network spaces. */
            networkSpaceList.remove( 0 );
            networkSpaceList.add( 0, nwi );
        }

        return NetworkSpacesInternalSettings.
            makeInstance( setupState, isEnabled, realInterfaceList, interfaceList, networkSpaceList, 
                          routingTable, redirectList, dns1, dns2, defaultRoute );
                          
    }
    
    /**
     * Convert a networking configuration object to an internal representation.
     * This should only be used when updating a box.  Under other circumstances,
     * the other converter which takes the networking configuration and the previous
     * internal settings should be used
     */
    NetworkSpacesInternalSettings toInternal( NetworkingConfiguration configuration )
        throws NetworkException, ValidateException
    {
        IntfConverter ic = IntfConverter.getInstance();

        NetworkSpacesSettings newSettings = new NetworkSpacesSettingsImpl();

        /* By default the network space settings are disabled */
        newSettings.setIsEnabled( false );
        
        /* Build an empty network settings where all of the interfaces are mapped to the 
         * first network space */
        
        /* Create a single network space */
        NetworkSpace primary = new NetworkSpace();
        primary.setIsTrafficForwarded( true );
        primary.setIsNatEnabled( false );
        primary.setIsDmzHostEnabled( false );
        
        List<Interface> interfaceList = new LinkedList<Interface>();
        for ( byte argonIntf : ic.argonIntfArray()) {
            /* The VPN interface doesn't belong to a network space */
            if ( argonIntf == IntfConstants.VPN_INTF ) continue;
            
            /* Add each interface to the list */
            Interface intf =  new Interface( argonIntf, EthernetMedia.AUTO_NEGOTIATE, true );
            intf.setNetworkSpace( primary );
            interfaceList.add( intf );
        }
        List<NetworkSpace> networkSpaceList = new LinkedList<NetworkSpace>();
        
        /* Set the address and the address of the aliases */
        List<IPNetworkRule> networkList = new LinkedList<IPNetworkRule>();
        
        IPaddr host = configuration.host();
        IPaddr netmask = configuration.netmask();
        if (( host == null ) || ( netmask == null ) || ( host.isEmpty()) || netmask.isEmpty()) {
            /* This is pretty bad */
            logger.warn( "Configuration has an empty address[" + host + "] is netmask [" + netmask + "]" );
        } else {
            networkList.add( IPNetworkRule.makeInstance( host, netmask ));
        }

        for ( InterfaceAlias alias : configuration.getAliasList()) {
            host = alias.getAddress();
            netmask = alias.getNetmask();
            if (( host == null ) || ( netmask == null ) || ( host.isEmpty()) || netmask.isEmpty()) {
                /* This is pretty bad */
                logger.warn( "Configuration has an empty address[" + host + "] is netmask [" +
                             netmask + "]" );
            } else {
                networkList.add( IPNetworkRule.makeInstance( host, netmask ));
            }
        }

        primary.setNetworkList( networkList );

        networkSpaceList.add( primary );
        
        newSettings.setInterfaceList( interfaceList );
        newSettings.setNetworkSpaceList( networkSpaceList );
        newSettings.setRoutingTable( new LinkedList<Route>());
        newSettings.setDefaultRoute( configuration.gateway());
        newSettings.setDns1( configuration.dns1());
        newSettings.setDns2( configuration.dns2());
        
        return toInternal( newSettings );
    }

    ServicesInternalSettings toInternal( NetworkSpacesInternalSettings settings, DhcpServerSettings dhcp, 
                                         DnsServerSettings dns )
    {
        NetworkSpaceInternal serviceSpace = settings.getServiceSpace();

        IPaddr defaultRoute;
        IPaddr netmask;
        List<IPaddr> dnsServerList = new LinkedList<IPaddr>();
        String interfaceName =  null;
        IPNetwork primary = serviceSpace.getPrimaryAddress();

        if ( serviceSpace.getIsNatEnabled()) {
            defaultRoute = primary.getNetwork();
            netmask = primary.getNetmask();
            dnsServerList.add( defaultRoute );
            interfaceName = serviceSpace.getDeviceName();
        } else {
            /* This might be incorrect to assume the default route of the box */
            defaultRoute = settings.getDefaultRoute();
            netmask = primary.getNetmask();
            if ( !settings.getDns1().isEmpty()) dnsServerList.add( settings.getDns1());
            if ( !settings.getDns2().isEmpty()) dnsServerList.add( settings.getDns2());

            /* Don't bind to an interface */
            interfaceName = null;
        }

        return ServicesInternalSettings.
            makeInstance( settings.getIsEnabled(), dhcp, dns, defaultRoute, netmask, dnsServerList, 
                          interfaceName );
    }

    /* Get the default settings for services */
    ServicesSettingsImpl getDefaultServicesSettings()
    {
        ServicesSettingsImpl services = new ServicesSettingsImpl();

        services.setDhcpEnabled( false );
        services.setDhcpStartAddress( NetworkUtil.DEFAULT_DHCP_START );
        services.setDhcpEndAddress( NetworkUtil.DEFAULT_DHCP_END );
        services.setDhcpLeaseTime( NetworkUtil.DEFAULT_LEASE_TIME_SEC );

        services.setDnsEnabled( false );
        return services;
        
    }
    
    /* Used when the network settings change, but the dns masq settings haven't */
    ServicesInternalSettings update( NetworkSpacesInternalSettings settings, 
                                     ServicesInternalSettings server )
    {
        NetworkSpaceInternal serviceSpace = settings.getServiceSpace();

        IPaddr defaultRoute;
        IPaddr netmask;
        List<IPaddr> dnsServerList = new LinkedList<IPaddr>();
        String interfaceName =  null;
        
        IPNetwork primary = serviceSpace.getPrimaryAddress();
            
        if ( serviceSpace.getIsNatEnabled()) {
            defaultRoute = primary.getNetwork();
            netmask = primary.getNetmask();
            dnsServerList.add( defaultRoute );
            interfaceName = serviceSpace.getDeviceName();
        } else {
            /* This might be incorrect to assume the default route of the box */
            defaultRoute = settings.getDefaultRoute();
            netmask = primary.getNetmask();
            if ( !settings.getDns1().isEmpty()) dnsServerList.add( settings.getDns1());
            if ( !settings.getDns2().isEmpty()) dnsServerList.add( settings.getDns2());

            /* Don't bind to an interface */
            interfaceName = null;
        }

        return ServicesInternalSettings.
            makeInstance( server, defaultRoute, netmask, dnsServerList, interfaceName );

    }
    
    NetworkingConfiguration toConfiguration( NetworkSpacesInternalSettings settings,
                                             RemoteSettings remoteSettings )
    {
        NetworkingConfiguration configuration = new NetworkingConfigurationImpl();
        
        NetworkSpaceInternal primary = settings.getNetworkSpaceList().get( 0 );

        /* Grab the stuff from the primary space */
        configuration.isDhcpEnabled( primary.getIsDhcpEnabled());
        IPNetwork primaryNetwork = primary.getPrimaryAddress();
        
        configuration.host( primaryNetwork.getNetwork());
        configuration.netmask( primaryNetwork.getNetmask());

        /* Get the aliases */
        List<InterfaceAlias> aliasList = new LinkedList<InterfaceAlias>();
        for ( IPNetwork network : primary.getNetworkList()) {
            if ( network.equals( primaryNetwork )) continue;

            aliasList.add( new InterfaceAlias( network.getNetwork(), network.getNetmask()));
        }
        configuration.setAliasList( aliasList );

        /* Grab the basic parameters */
        configuration.dns1( settings.getDns1());
        configuration.dns2( settings.getDns2());
        configuration.gateway( settings.getDefaultRoute());
        configuration.setHostname( remoteSettings.getHostname());
        configuration.setPublicAddress( remoteSettings.getPublicAddress());
        configuration.isSshEnabled( remoteSettings.isSshEnabled());
        configuration.isExceptionReportingEnabled( remoteSettings.isExceptionReportingEnabled());
        configuration.isTcpWindowScalingEnabled( remoteSettings.isTcpWindowScalingEnabled());
        configuration.isInsideInsecureEnabled( remoteSettings.isInsideInsecureEnabled());
        configuration.isOutsideAccessEnabled( remoteSettings.isOutsideAccessEnabled());
        configuration.isOutsideAccessRestricted( remoteSettings.isOutsideAccessRestricted());
        configuration.outsideNetwork( remoteSettings.outsideNetwork());
        configuration.outsideNetmask( remoteSettings.outsideNetmask());
        configuration.httpsPort( remoteSettings.httpsPort());
        return configuration;
    }

    /* Return the impl so this can go into a database */
    NetworkSpacesSettingsImpl toSettings( NetworkSpacesInternalSettings internalSettings )
    {
        NetworkSpacesSettingsImpl settings = new NetworkSpacesSettingsImpl();
        
        /* Generate the list network spaces and a map from internal -> normal. */
        List<NetworkSpace> networkSpaceList = new LinkedList<NetworkSpace>();

        settings.setIsEnabled( internalSettings.getIsEnabled());
        
        Map<NetworkSpaceInternal,NetworkSpace> networkSpaceMap = 
            new HashMap<NetworkSpaceInternal,NetworkSpace>();

        NetworkSpace primary = null;

        for ( NetworkSpaceInternal si : internalSettings.getNetworkSpaceList()) {
            NetworkSpace space = si.toNetworkSpace();
            
            if ( primary == null ) primary = space;

            /* Placed into both in order to maintain the order of the items */
            networkSpaceMap.put( si, space );
            networkSpaceList.add( space );
            space.setIsPrimary( false );
        }

        /* Assuming there is at least one space, otherwise primary would be null. */
        primary.setIsPrimary( true );
        
        /* Update the nat space in the ones where this is needed. */
        for ( Map.Entry<NetworkSpaceInternal,NetworkSpace> entry : networkSpaceMap.entrySet()) {
            NetworkSpace space = entry.getValue();
            NetworkSpaceInternal si = entry.getKey();

            int natSpaceIndex = si.getNatSpaceIndex();
            
            if ( natSpaceIndex > 0 && ( natSpaceIndex <= networkSpaceList.size())) {
                space.setNatSpace( networkSpaceList.get( natSpaceIndex ));
            } else {
                space.setNatSpace( null );
            }
        }
                   
        /* Generate the interfaces, wire them up to the correct network space.
         * always wire settings up as if they were enabled. */
        List<Interface> intfList = new LinkedList<Interface>();
        for ( InterfaceInternal intfInternal : internalSettings.getEnabledList()) {
            Interface i = intfInternal.toInterface();
            
            NetworkSpace space = networkSpaceMap.get( intfInternal.getNetworkSpace());
            i.setNetworkSpace(( space == null ) ? primary : space );
            intfList.add( i );
        }

        /* Generate the routing table. */
        List<Route> routingTable = new LinkedList<Route>();
        for( RouteInternal r : internalSettings.getRoutingTable()) routingTable.add( r.toRoute());
        
        /* Set all of the simple settings (eg defaultRoute) */
        settings.setInterfaceList( intfList );
        settings.setNetworkSpaceList( networkSpaceList );
        settings.setRoutingTable( routingTable );
        settings.setDefaultRoute( internalSettings.getDefaultRoute());
        settings.setDns1( internalSettings.getDns1());
        settings.setDns2( internalSettings.getDns2());

        settings.setRedirectList( internalSettings.getRedirectRuleList());

        return settings;
    }

    /************* PRIVATE **********/
    private SpaceInfo makeBasicNetworkSpace( BasicNetworkSettings basicNetworkSettings, 
                                             NetworkSpacesInternalSettings internalSettings )
    {
        List<Interface> interfaceList = new LinkedList<Interface>();

        /* The list of interfaces in this network space are defined by the internal settings */
        throw new IllegalStateException( "Implement me" );
    }
    

    private IPNetwork getPrimaryAddress( NetworkSpace networkSpace, int index )
    {
        IPNetwork primaryAddress = IPNetwork.getEmptyNetwork();
            
        if ( networkSpace.getIsDhcpEnabled()) {
            DhcpStatus status = networkSpace.getDhcpStatus();
            primaryAddress = IPNetwork.makeInstance( status.getAddress(), status.getNetmask());
        } else {
            for ( IPNetworkRule rule : (List<IPNetworkRule>)networkSpace.getNetworkList()) {
                if ( rule.isUnicast()) {
                    primaryAddress = rule.getIPNetwork();
                    break;
                }
            }
        }
        
        if ( primaryAddress == null || primaryAddress.equals( IPNetwork.getEmptyNetwork())) {
            /* XXX This is where it would handle the empty ip network */
            logger.error( "Network space " + index + " doesn't have a primary address" );
        }

        return ( primaryAddress == null ) ? IPNetwork.getEmptyNetwork() : primaryAddress;
    }

    private void setNatAddress( SpaceInfo info, Map<NetworkSpace,SpaceInfo> spaceToInfoMap )
        throws NetworkException
    {
        NetworkSpace space = info.getNetworkSpace();
        
        if ( !space.getIsNatEnabled()) return;
        
        NetworkSpace natSpace = space.getNatSpace();
        int natSpaceIndex = -1;
        IPaddr natAddress = NetworkUtil.EMPTY_IPADDR;

        if ( natSpace == space ) {
            throw new NetworkException( "Network space " + info.getIndex() + " is natted to itself" );
        }
        
        if ( natSpace == null ) natAddress = space.getNatAddress();
        else {
            if ( space.isLive() && !natSpace.isLive()) {
                throw new NetworkException( "An enabled space cannot NAT to a disabled space." );
            }

            if ( spaceToInfoMap.get( natSpace ) == null ) {
                throw new NetworkException( "Network space " + info.getIndex() + " is not nattd to an " + 
                                            "unlisted network space" );
            }
            
            SpaceInfo i   = spaceToInfoMap.get( natSpace );
            natAddress    = i.getPrimaryAddress().getNetwork();
            natSpaceIndex = i.getIndex();
        }
        
        if ( natAddress == null || natAddress.isEmpty()) {
            logger.error( "Requesting NAT on a space that doesn't have an IP address" );
            /* !!!!!!!! Handle this */
        }

        info.setNatAddress( natAddress );
        info.setNatSpaceIndex( natSpaceIndex );
    }
    
    private NetworkSpaceInternal makeNetworkSpaceInternal( SpaceInfo info ) throws ValidateException
    {        
        return NetworkSpaceInternal.
            makeInstance( info.getNetworkSpace(), info.getInterfaceList(), info.getPrimaryAddress(), 
                          info.getDeviceName(), info.getIndex(), info.getNatAddress(), 
                          info.getNatSpaceIndex());
    }

    List<IPaddr> getDnsServers()
    {
        List<IPaddr> dnsServers = new LinkedList<IPaddr>();
        
        BufferedReader in = null;
        
        /* Open up the interfaces file */
        try {
            in = new BufferedReader( new FileReader( NetworkManagerImpl.ETC_RESOLV_FILE ));
            String str;
            while (( str = in.readLine()) != null ) {
                str = str.trim();
                if ( str.startsWith( ResolvScriptWriter.NS_PARAM )) {
                    dnsServers.add( IPaddr.parse( str.substring( ResolvScriptWriter.NS_PARAM.length())));
                }
            }
        } catch ( Exception ex ) {
            logger.error( "Error reading file: ", ex );
        }

        try {
            if ( in != null ) in.close();
        } catch ( Exception ex ) {
            logger.error( "Unable to close file", ex );
        }

        return dnsServers;
    }


    static NetworkUtilPriv getPrivInstance()
    {
        return INSTANCE;
    }
    
}


class SpaceInfo
{
    private final NetworkSpace space;
    private final List<Interface> intfList;
    private final String deviceName;
    private final int index;
    private final IPNetwork primaryAddress;
    private IPaddr natAddress;
    private int natSpaceIndex;

    SpaceInfo( NetworkSpace space, String deviceName, int index, List<Interface> intfList,
               IPNetwork primaryAddress )
    {
        this.space = space;
        this.deviceName = deviceName;
        this.index = index;
        this.intfList = intfList;
        this.natAddress = NetworkUtil.EMPTY_IPADDR;
        this.primaryAddress = primaryAddress;
    }

    NetworkSpace getNetworkSpace()
    {
        return this.space;
    }

    List<Interface> getInterfaceList()
    {
        return this.intfList;
    }

    String getDeviceName()
    {
        return deviceName;
    }
    
    int getIndex()
    {
        return this.index;
    }
    
    IPNetwork getPrimaryAddress()
    {
        return this.primaryAddress;
    }

    IPaddr getNatAddress()
    {
        return this.natAddress;
    }

    void setNatAddress( IPaddr newValue )
    {
        this.natAddress = newValue;
    }

    int getNatSpaceIndex()
    {
        return this.natSpaceIndex;
    }
    
        void setNatSpaceIndex( int newValue )
    {
        this.natSpaceIndex = newValue;
    }
}