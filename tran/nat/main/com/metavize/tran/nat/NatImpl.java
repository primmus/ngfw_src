/*
 * Copyright (c) 2004, 2005, 2006 Metavize Inc.
 * All rights reserved.
 *
 * This software is the confidential and proprietary information of
 * Metavize Inc. ("Confidential Information").  You shall
 * not disclose such Confidential Information.
 *
 * $Id$
 */
package com.metavize.tran.nat;

import java.util.Iterator;
import java.util.LinkedList;
import java.util.List;
import java.util.Set;

import org.apache.log4j.Logger;

import com.metavize.mvvm.MvvmContextFactory;
import com.metavize.mvvm.MvvmLocalContext;

import com.metavize.mvvm.networking.NetworkManagerImpl;
import com.metavize.mvvm.networking.NetworkException;
import com.metavize.mvvm.networking.RedirectRule;
import com.metavize.mvvm.networking.SetupState;
import com.metavize.mvvm.networking.NetworkSpacesSettings;
import com.metavize.mvvm.networking.ServicesSettings;
import com.metavize.mvvm.networking.NetworkSettingsListener;
import com.metavize.mvvm.networking.internal.NetworkSpacesInternalSettings;
import com.metavize.mvvm.networking.internal.ServicesInternalSettings;
import com.metavize.mvvm.argon.SessionMatcher;
import com.metavize.mvvm.argon.SessionMatcherFactory;
import com.metavize.mvvm.logging.EventLogger;
import com.metavize.mvvm.logging.EventLoggerFactory;
import com.metavize.mvvm.logging.EventManager;
import com.metavize.mvvm.logging.LogEvent;
import com.metavize.mvvm.logging.SimpleEventFilter;
import com.metavize.mvvm.tapi.AbstractTransform;
import com.metavize.mvvm.tapi.Affinity;
import com.metavize.mvvm.tapi.Fitting;
import com.metavize.mvvm.tapi.MPipe;
import com.metavize.mvvm.tapi.PipeSpec;
import com.metavize.mvvm.tapi.SoloPipeSpec;
import com.metavize.mvvm.tran.IPaddr;
import com.metavize.mvvm.tran.TransformContext;
import com.metavize.mvvm.tran.TransformException;
import com.metavize.mvvm.tran.ParseException;
import com.metavize.mvvm.tran.TransformStartException;
import com.metavize.mvvm.tran.TransformState;
import com.metavize.mvvm.tran.TransformStopException;
import com.metavize.mvvm.tran.TransformContextSwitcher;

import com.metavize.mvvm.util.DataSaver;
import com.metavize.mvvm.util.DataLoader;

import com.metavize.tran.token.TokenAdaptor;

public class NatImpl extends AbstractTransform implements Nat
{
    private final NatEventHandler handler;
    private final NatSessionManager sessionManager;
    private final SettingsManager settingsManager;
    final NatStatisticManager statisticManager;
    private final DhcpMonitor dhcpMonitor;
    /* Done with an inner class so the GUI doesn't freak out about not
     * having the NetworkSettingsListener class */
    private final SettingsListener listener;

    /* Indicate whether or not the transform is starting */

    private final SoloPipeSpec natPipeSpec;
    private final SoloPipeSpec natFtpPipeSpec;

    private final PipeSpec[] pipeSpecs;

    private final EventLogger<LogEvent> eventLogger;

    /** Used to turn on network spaces if the appliances is on, otherwise, network
     * spaces are not turned on at startup. */
    private boolean isUpgrade = false;

    private final Logger logger = Logger.getLogger( NatImpl.class );

    public NatImpl()
    {
        this.handler          = new NatEventHandler(this);
        this.sessionManager   = new NatSessionManager(this);
        this.statisticManager = new NatStatisticManager(getTransformContext());
        this.settingsManager  = new SettingsManager();
        this.dhcpMonitor      = new DhcpMonitor( this, MvvmContextFactory.context());
        this.listener         = new SettingsListener();

        /* Have to figure out pipeline ordering, this should always next
         * to towards the outside */
        natPipeSpec = new SoloPipeSpec
            ("nat", this, this.handler, Fitting.OCTET_STREAM, Affinity.OUTSIDE,
             SoloPipeSpec.MAX_STRENGTH - 1);

        /* This subscription has to evaluate after NAT */
        natFtpPipeSpec = new SoloPipeSpec
            ("nat-ftp", this, new TokenAdaptor(this, new NatFtpFactory(this)),
             Fitting.FTP_TOKENS, Affinity.SERVER, 0);

        pipeSpecs = new SoloPipeSpec[] { natPipeSpec, natFtpPipeSpec };

        TransformContext tctx = getTransformContext();
        eventLogger = EventLoggerFactory.factory().getEventLogger(tctx);

        SimpleEventFilter ef = new NatRedirectFilter();
        eventLogger.addSimpleEventFilter(ef);
    }

    public NatCommonSettings getNatSettings()
    {
        /* Get the settings from Network Spaces (The only state in the transform is the setup state) */
        NetworkManagerImpl nm = getNetworkManager();
        
        SetupState state = getSetupState();

        NetworkSpacesSettings network = nm.getNetworkSettings();
        NetworkSpacesInternalSettings networkInternal = nm.getNetworkInternalSettings();
        ServicesInternalSettings servicesInternal = nm.getServicesInternalSettings();
        
        if ( state.equals( SetupState.BASIC )) {
            return settingsManager.toBasicSettings( this.getTid(), networkInternal, servicesInternal );
        } else if ( state.equals( SetupState.ADVANCED )) {
            return settingsManager.toAdvancedSettings( network, servicesInternal );
        }
        
        logger.error( "Invalid state: [" + state + "] using basic" );

        return settingsManager.toBasicSettings( this.getTid(), networkInternal, servicesInternal );
    }
        
    public void setNatSettings( NatCommonSettings settings ) throws Exception
    {        
        /* Remove all of the non-static addresses before saving */
        // !!!! Pushed into the networking package
        // dhcpManager.fleeceLeases( settings );
        
        /* Validate the settings */
        try {
            settings.validate();
        }
        catch ( Exception e ) {
            logger.error("Invalid NAT settings", e);
            throw e;
        }

        NetworkManagerImpl networkManager = getNetworkManager();
        
        /* Integrate the settings from the internal network and the ones from the user */
        NetworkSpacesSettings networkSettings = networkManager.getNetworkSettings();
        
        NetworkSpacesSettings newNetworkSettings = null;
        
        try {
            SetupState state = settings.getSetupState();
            if ( state.equals( SetupState.BASIC )) {
                newNetworkSettings = this.settingsManager.
                    toNetworkSettings( networkSettings, (NatBasicSettings)settings );
            } else if ( state.equals( SetupState.ADVANCED )) {
                newNetworkSettings = this.settingsManager.
                    toNetworkSettings( networkSettings, (NatAdvancedSettings)settings );
            } else {
                throw new Exception( "Illegal setup state: " + state );
            }
            
        } catch ( Exception e ) {
            logger.error( "Unable to convert the settings objects.", e );
            throw e;
        }

        /* This isn't necessary, (the state should carry over), but just in case. */
        newNetworkSettings.setIsEnabled( getRunState() == TransformState.RUNNING );
        
        try {
            /* Have to reconfigure the network before configure the services settings */
            networkManager.setNetworkSettings( newNetworkSettings );
            networkManager.setServicesSettings( settings );
        } catch ( Exception e ) {
            logger.error( "Could not reconfigure the network", e );
            throw e;
        }
    }
    
    /* Reinitialize the settings to basic nat */
    public void resetBasic() throws Exception
    {
        /* This shouldn't fail */

        /* Get the settings from Network Spaces (The only state in the transform is the setup state) */
        NetworkManagerImpl nm = getNetworkManager();
        
        NetworkSpacesSettings newSettings = 
            this.settingsManager.resetToBasic( getTid(), nm.getNetworkSettings());
        
        nm.setNetworkSettings( newSettings );
    }
    
    /* Convert the basic settings to advanced Network Spaces */
    public void switchToAdvanced() throws Exception
    {
        /* Get the settings from Network Spaces (The only state in the transform is the setup state) */
        NetworkManagerImpl nm = getNetworkManager();
        
        NetworkSpacesSettings newSettings = this.settingsManager.basicToAdvanced( nm.getNetworkSettings());
        
        nm.setNetworkSettings( newSettings );
    }
    
    public SetupState getSetupState()
    {
        SetupState state = getNetworkSettings().getSetupState();
        if ( state == null ) {
            logger.error( "NULL State" );
            state = SetupState.BASIC;
        }

        return state;
    }

    public EventManager<LogEvent> getEventManager()
    {
        return eventLogger;
    }

    // package protected methods ----------------------------------------------

    NatEventHandler getHandler()
    {
        return handler;
    }

    MPipe getNatMPipe()
    {
        return natPipeSpec.getMPipe();
    }

    MPipe getNatFtpPipeSpec()
    {
        return natFtpPipeSpec.getMPipe();
    }

    // AbstractTransform methods ----------------------------------------------

    @Override
    protected PipeSpec[] getPipeSpecs()
    {
        return pipeSpecs;
    }

    protected void initializeSettings()
    {
        logger.info("Initializing Settings...");

        NatBasicSettings settings = settingsManager.getDefaultSettings( this.getTid());

        /* Disable everything */

        /* deconfigure the event handle and the dhcp manager */
        // !!!! Pushed into the networking package
        // dhcpManager.deconfigure();
        dhcpMonitor.stop();

        try {
            setNatSettings( settings );
            // Handler doesn't need to be deconfigured at initialization.
            // handler.deconfigure();
        } catch( Exception e ) {
            logger.error( "Unable to set Nat Settings", e );
        }

        /* Stop the statistics manager */
        statisticManager.stop();
    }

    @Override
    protected void postInit(String[] args)
    {
        /* Register a listener, this should hang out until the transform is removed dies. */
        getNetworkManager().registerListener( this.listener );

        /* Check if the settings have been upgraded yet */
        DataLoader<NatSettingsImpl> natLoader = new DataLoader<NatSettingsImpl>( "NatSettingsImpl",
                                                                                 getTransformContext());
        
        NatSettingsImpl settings = natLoader.loadData();

        if ( settings == null ) {
            
        } else {
            /* In deprecated, mode, update and save new settings */
            SetupState state = settings.getSetupState();
            if ( state.equals( SetupState.NETWORK_SHARING )) {
                logger.info( "Settings are in the deprecated mode, upgrading settings" );

                /* Change to basic mode */
                settings.setSetupState( SetupState.BASIC );
                
                /* Save the new Settings */
                try {
                    setNatSettings( settings );
                } catch ( Exception e ) {
                    logger.error( "Unable to set upgrade nat settings", e );
                }

                /* Save the settings to the database */
                DataSaver<NatSettingsImpl> dataSaver = new DataSaver<NatSettingsImpl>( getTransformContext());
                dataSaver.saveData( settings );

                /* Indicate to enable network spaces when then devices powers on */
                isUpgrade = true;
            } else if ( state.equals( SetupState.WIZARD )) {
                logger.info( "Settings are not setup yet, using defaults" );
                try { 
                    setNatSettings( this.settingsManager.getDefaultSettings( this.getTid()));
                } catch ( Exception e ) {
                    logger.error( "Unable to set wizard nat settings", e );
                }
            }  else {
                logger.info( "Settings are in [" + settings.getSetupState() +"]  mode, ignoring." );
                             
            }
        }
    }

    protected void preStart() throws TransformStartException
    {
        eventLogger.start();

        MvvmLocalContext context = MvvmContextFactory.context();
        MvvmLocalContext.MvvmState state = context.state();
        NetworkManagerImpl networkManager = getNetworkManager();

        /* Enable the network settings */
        if ( state.equals( MvvmLocalContext.MvvmState.RUNNING ) || isUpgrade ) {
            logger.debug( "enabling network spaces settings because user powered on nat." );
            
            try {
                networkManager.enableNetworkSpaces();
            } catch ( Exception e ) {
                throw new TransformStartException( "Unable to enable network spaces", e );
            }

            isUpgrade = false;
        } else {
            logger.debug( "not enabling network spaces settings at startup" );
        }
        
        NetworkSpacesInternalSettings networkSettings = getNetworkSettings();
        ServicesInternalSettings servicesSettings = getServicesSettings();
        
        try {
            configureDhcpMonitor( servicesSettings.getIsDhcpEnabled());
            this.handler.configure( networkSettings );
            networkManager.startServices();
        } catch( TransformException e ) {
            logger.error( "Could not configure the handler.", e );
            throw new TransformStartException( "Unable to configure the handler" );
        } catch( NetworkException e ) {
            logger.error( "Could not start services.", e );
            throw new TransformStartException( "Unable to configure the handler" );
        }
        
        statisticManager.start();
    }

    protected void postStart()
    {
        /* Kill all active sessions */
        shutdownMatchingSessions();
    }

    protected void postStop() throws TransformStopException
    {
        /* Kill all active sessions */
        shutdownMatchingSessions();
        
        MvvmLocalContext context = MvvmContextFactory.context();
        
        MvvmLocalContext.MvvmState state = context.state();

        NetworkManagerImpl networkManager = (NetworkManagerImpl)context.networkManager();
        
        /* Only stop the services if the box isn't going down (the user turned off the appliance) */
        if ( state.equals( MvvmLocalContext.MvvmState.RUNNING ))  {
            logger.debug( "Disabling services since user turned off network spaces." );
            networkManager.stopServices();
        }
        
        dhcpMonitor.stop();

        statisticManager.stop();

        /* deconfigure the event handle */
        handler.deconfigure();

        /* Deconfigure the network spaces */
        /* Only stop the services if the box isn't going down (the user turned off the appliance) */
        if ( state.equals( MvvmLocalContext.MvvmState.RUNNING )) {
            logger.debug( "Disabling network spaces since user turned off network spaces." );
            try {
                networkManager.disableNetworkSpaces();
            } catch ( Exception e ) {
                logger.error( "Unable to enable network spaces", e );
            }
        }

        eventLogger.stop();
    }

    @Override protected void postDestroy() throws TransformException
    {
        /* Deregister the network settings listener */
        getNetworkManager().unregisterListener( this.listener );
    }

    @Override
    public void reconfigure() throws TransformException
    {
        /* This  has been moved into networkSettingsEvent which is called automatically
         * whenever the network settings change */
    }

    public void networkSettingsEvent( ) throws TransformException
    {
        logger.info("networkSettingsEvent");

        /* ????, what goes here. Configure the handler */
        
        /* Retrieve the new settings from the network manager */
        NetworkManagerImpl nm = getNetworkManager();
        NetworkSpacesInternalSettings networkSettings = nm.getNetworkInternalSettings();
        ServicesInternalSettings servicesSettings = nm.getServicesInternalSettings();
        
        if ( getRunState() == TransformState.RUNNING ) {
            /* Have to configure DHCP before the handler, this automatically starts the dns server */
            configureDhcpMonitor( servicesSettings.getIsDhcpEnabled());
            this.handler.configure( networkSettings );
        } else {
            nm.stopServices();
            this.handler.deconfigure();
        }
    }


    private void updateToCurrent( NatSettings settings )
    {
        if (settings == null) {
            logger.error("NULL Nat Settings");
        } else {
            logger.info( "Update Settings Complete" );
        }
    }

    /* Kill all sessions when starting or stopping this transform */
    protected SessionMatcher sessionMatcher()
    {
        return SessionMatcherFactory.getAllInstance();
    }

    void log(LogEvent le)
    {
        eventLogger.log(le);
    }

    // XXX soon to be deprecated ----------------------------------------------

    public Object getSettings()
    {
        return getNatSettings();
    }

    public void setSettings(Object settings) throws Exception
    {
        setNatSettings((NatCommonSettings)settings);
    }

    private void configureDhcpMonitor( boolean isDhcpEnabled )
    {
        if ( isDhcpEnabled ) dhcpMonitor.start();
        else dhcpMonitor.stop();
    }
    
    private NetworkManagerImpl getNetworkManager()
    {
        return (NetworkManagerImpl)MvvmContextFactory.context().networkManager();
    }
    private NetworkSpacesInternalSettings getNetworkSettings()
    {
        return getNetworkManager().getNetworkInternalSettings();
    }

    private ServicesInternalSettings getServicesSettings()
    {
        return getNetworkManager().getServicesInternalSettings();
    }

    NatSessionManager getSessionManager()
    {
        return sessionManager;
    }

    class SettingsListener implements NetworkSettingsListener
    {
        /* Use this to automatically switch context */
        private final TransformContextSwitcher tl;

        private final Runnable go;
        
        /* This are the settings passed in by the network settings */
        private NetworkSpacesInternalSettings settings;
        
        SettingsListener()
        {
            tl = new TransformContextSwitcher( getTransformContext().getClassLoader());
            go = new Runnable() {
                    public void run()
                    {
                        if ( logger.isDebugEnabled()) logger.debug( "network settings changed:" + settings );
                        try {
                            networkSettingsEvent();
                        } catch( TransformException e ) {
                            logger.error( "Unable to reconfigure the NAT transform" );
                        }
                    }
                };
        }

        public void event( NetworkSpacesInternalSettings settings )
        {
            this.settings = settings;
            tl.run( go );
        }
        
    }
}
