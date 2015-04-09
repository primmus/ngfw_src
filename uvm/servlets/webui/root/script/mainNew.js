Ext.Loader.setConfig({
    enabled: true,
    disableCaching: false,
    paths: {
        'Ext.ux': '/ext5/examples/ux',
        'Webui': 'script'
    }
});

var rpc = {}; // the main json rpc object
var testMode = false;

// Main object class
Ext.define("Ung.Main", {
    singleton: true,
    debugMode: false,
    buildStamp: null,
    disableThreads: false, // in development environment is useful to disable threads.
    apps: [],
    nodePreviews: {},
    config: null,
    totalMemoryMb: 2000,
    nodes: null,
    // the Ext.Viewport object for the application
    viewport: null,
    contentLeftWidth: null,
    iframeWin: null,
    initialScreenAlreadyShown: false,

    init: function(config) {
        Ext.apply(this, config);
        if (Ext.isGecko) {
            document.onkeypress = function(e) {
                if (e.keyCode==27) {
                    return false;
                }
                return true;
            };
        }
        JSONRpcClient.toplevel_ex_handler = Ung.Util.rpcExHandler;
        JSONRpcClient.max_req_active = 25;

        // get JSONRpcClient
        rpc.jsonrpc = new JSONRpcClient("/webui/JSON-RPC");
        rpc.jsonrpc.UvmContext.getWebuiStartupInfo(Ext.bind(function (result, exception) {
            if(Ung.Util.handleException(exception)) return;
            Ext.applyIf(rpc, result);
            rpc.nodeManager.node(Ext.bind(function (result, exception) {
                if(Ung.Util.handleException(exception)) return;
                rpc.policyManager = result;
                this.startApplication();
            }, this), "untangle-node-policy");
        }, this));
    },
    startApplication: function() {
        if(Ext.supports.LocalStorage) {
            Ext.state.Manager.setProvider(Ext.create('Ext.state.LocalStorageProvider'));
        }
        this.target = Ung.Util.getQueryStringParam("target");
        i18n = Ext.create('Ung.I18N',{
            map: rpc.translations,
            timeoffset: (new Date().getTimezoneOffset()*60000)+rpc.timeZoneOffset
        });
        Ext.MessageBox.wait(i18n._("Starting..."), i18n._("Please wait"));
        Ung.Util.loadCss("/skins/"+rpc.skinSettings.skinName+"/css/adminNew.css");
        if (rpc.skinSettings.outOfDate) {
            var win = Ext.create('Ext.Window', {
                layout: 'fit',
                width: 300,
                height: 200,
                closeAction: 'hide',
                plain: true,
                html: i18n._('The current custom skin is no longer compatible and has been disabled. The Default skin is temporarily being used. To disable this message change the skin settings under Config Administration. To get more information on how to fix the custom skin: <a href="http://wiki.untangle.com/index.php/Skins" target="_blank">Where can I find updated skins and new skins?</a>'),
                title: i18n._('Skin Out of Date'),
                buttons: [ {
                    text: i18n._('Ok'),
                    handler: function() {
                        win.hide();
                    }
                }]
            });
            win.show();
        }
        document.title = rpc.companyName + (rpc.hostname ? " - " + rpc.hostname : "");
        if(rpc.languageSettings.language) {
            Ung.Util.loadScript('/ext5/packages/ext-locale/build/ext-locale-' + rpc.languageSettings.language + '.js');
        }
        Ung.VTypes.init(i18n);
        Ext.tip.QuickTipManager.init();
        Ext.on("resize", Ung.Util.resizeWindows);
        // initialize viewport object
        var contentRightArr=[
            '<div id="content-right">',
                '<div id="racks" style="">',
                    '<div id="rack-list"><div id="rack-select-container"></div><div id="parent-rack-container"></div><div id="alert-container" style="display:none;"></div><div id="no-ie-container" style="display:none;"></div>',
                    '</div>',
                    '<div id="rack-nodes">',
                        '<div id="filter_nodes"></div>',
                        '<div id="nodes-separator" style="display:none;"><div id="nodes-separator-text"></div></div>',
                        '<div id="service_nodes"></div>',
                    '</div>',
                '</div>',
            '</div>'];

        var cssRule = Ext.util.CSS.getRule(".content-left",true);
        this.contentLeftWidth = ( cssRule ) ? parseInt( cssRule.style.width, 10 ): 215;
        this.viewport = Ext.create('Ext.container.Viewport',{
            layout:'border',
            items:[{
                region: 'west',
                id: 'west',
                cls: "content-left",
                xtype: 'container',
                width: this.contentLeftWidth,
                layout: { type: 'vbox', align: 'stretch' },
                items: [{
                    xtype: 'container',
                    cls: "logo",
                    html: '<img src="/images/BrandingLogo.png?'+(new Date()).getTime()+'" border="0"/>',
                    height: 141,
                    flex: 0
                }, {
                    xtype: 'tabpanel',
                    activeTab: 0,
                    deferredRender: false,
                    border: false,
                    plain: true,
                    flex: 1,
                    bodyStyle: 'background-color: transparent;',
                    defaults: {
                        autoScroll: true,
                        border: false,
                        bodyStyle: 'background-color: transparent;'
                    },
                    items:[{
                        xtype: 'panel',
                        title: i18n._('Apps'),
                        id: 'leftTabApps',
                        html:'<div id="appsItems"></div>',
                        name:'Apps'
                    },{
                        xtype: 'panel',
                        title: i18n._('Config'),
                        id: 'leftTabConfig',
                        html: '<div id="configItems"></div>',
                        name: 'Config'
                    }],
                    bbar: [{
                        xtype: 'button',
                        name: 'Help',
                        iconCls: 'icon-help',
                        text: i18n._('Help'),
                        handler: function() {
                            Ung.Main.openHelp(null);
                        }
                    }, {
                        name: 'MyAccount',
                        iconCls: 'icon-myaccount',
                        text: i18n._('My Account'),
                        tooltip: i18n._('You can access your online account and reinstall apps you already purchased, redeem vouchers, or buy new ones.'),
                        handler: function() {
                            Ung.Main.openMyAccountScreen();
                        }
                    }, {
                        xtype: 'button',
                        name: 'Logout',
                        iconCls: 'icon-logout',
                        text: i18n._('Logout'),
                        handler: function() {
                            window.location.href = '/auth/logout?url=/webui&realm=Administrator';
                        }
                    }]
                }
            ]}, {
                region:'center',
                id: 'center',
                xtype: 'container',
                html: contentRightArr.join(""),
                cls: 'center-region',
                autoScroll: true
            }
        ]});
        Ext.QuickTips.init();

        Ung.Main.systemStats = Ext.create('Ung.SystemStats',{});
        this.buildConfig();
        this.loadPolicies();
    },
    about: function (forceReload) {
        if(forceReload || rpc.about === undefined) {
            var serverUID, fullVersion, language;
            try {
                serverUID = rpc.jsonrpc.UvmContext.getServerUID();
                fullVersion = rpc.jsonrpc.UvmContext.getFullVersion();
                language = rpc.languageManager.getLanguageSettings()['language'];
            } catch (e) {
                Ung.Util.rpcExHandler(e);
            }
            var query = "";
            query = query + "uid=" + serverUID;
            query = query + "&" + "version=" + fullVersion;
            query = query + "&" + "webui=true";
            query = query + "&" + "lang=" + language;

            rpc.about = query;
        }
        return rpc.about;
    },
    openLegal: function( topic ) {
        var baseUrl;
        try {
            baseUrl = rpc.jsonrpc.UvmContext.getLegalUrl();
        } catch (e) {
            Ung.Util.rpcExHandler(e);
        }
        var url = baseUrl + "?" + this.about();

        console.log("Open Url   :", url);
        window.open(url); // open a new window
    },
    openHelp: function( topic ) {
        var baseUrl;
        try {
            baseUrl = rpc.jsonrpc.UvmContext.getHelpUrl();
        } catch (e) {
            Ung.Util.rpcExHandler(e);
        }
        var url = baseUrl + "?" + "source=" + topic + "&" + this.about();

        console.log("Open Url   :", url);
        window.open(url); // open a new window
    },
    openSupportScreen: function() {
        var url = rpc.storeUrl + "?" + "action=support" + "&" + this.about();
        window.open(url); // open a new window
    },
    openRegistrationScreen: function() {
        var url = rpc.storeUrl + "?" + "action=register" + "&" + this.about();
        this.openIFrame( url, i18n._("Register"));
    },
    openMyAccountScreen: function() {
        var url = rpc.storeUrl + "?" + "action=my_account" + "&" + this.about();
        window.open(url); // open a new window
    },
    openLibItemStore: function (libItemName, title) {
        var url = rpc.storeUrl + "?" + "action=buy" + "&" + "libitem=" + libItemName + "&" + this.about() ;

        console.log("Open Url   :", url);
        window.open(url); // open a new window
    },
    openSetupWizardScreen: function() {
        var url = "/setup";
        window.open(url);
    },
    upgrade: function () {
        Ung.MetricManager.stop();

        console.log("Applying Upgrades...");

        Ext.MessageBox.wait({
            title: i18n._("Please wait"),
            msg: i18n._("Applying Upgrades...")
        });

        var doneFn = Ext.bind( function() {
        }, this);

        rpc.systemManager.upgrade(Ext.bind(function(result, exception) {
            // the upgrade will shut down the untangle-vm so often this returns an exception
            // either way show a wait dialog...

            Ext.MessageBox.hide();
            var applyingUpgradesWindow=Ext.create('Ext.window.MessageBox', {
                minProgressWidth: 360
            });

            // the untangle-vm is shutdown, just show a message dialog box for 45 seconds so the user won't poke at things.
            // then refresh browser.
            applyingUpgradesWindow.wait(i18n._("Applying Upgrades..."), i18n._("Please wait"), {
                interval: 500,
                increment: 120,
                duration: 45000,
                scope: this,
                fn: function() {
                    console.log("Upgrade in Progress. Press ok to go to the Start Page...");
                    if(Ung.Main.configWin!=null && Ung.Main.configWin.isVisible()) {
                        Ung.Main.configWin.closeWindow();
                    }
                    applyingUpgradesWindow.hide();
                    Ext.MessageBox.hide();
                    Ext.MessageBox.alert(
                        i18n._("Upgrade in Progress"),
                        i18n._("The upgrades have been downloaded and are now being applied.") + "<br/>" +
                            "<strong>" + i18n._("DO NOT REBOOT AT THIS TIME.") + "</strong>" + "<br/>" +
                            i18n._("Please be patient this process will take a few minutes.") + "<br/>" +
                            i18n._("After the upgrade is complete you will be able to log in again."),
                        Ung.Util.goToStartPage);
                }
            });
        }, this));
    },

    getNetworkManager: function(forceReload) {
        if (forceReload || rpc.networkManager === undefined) {
            try {
                rpc.networkManager = rpc.jsonrpc.UvmContext.networkManager();
            } catch (e) {
                Ung.Util.rpcExHandler(e);
            }
        }
        return rpc.networkManager;
    },

    getLoggingManager: function(forceReload) {
        if (forceReload || rpc.loggingManager === undefined) {
            try {
                rpc.loggingManager = rpc.jsonrpc.UvmContext.loggingManager();
            } catch (e) {
                Ung.Util.rpcExHandler(e);
            }
        }
        return rpc.loggingManager;
    },

    getCertificateManager: function(forceReload) {
        if (forceReload || rpc.certificateManager === undefined) {
            try {
                rpc.certificateManager = rpc.jsonrpc.UvmContext.certificateManager();
            } catch (e) {
                Ung.Util.rpcExHandler(e);
            }
        }
        return rpc.certificateManager;
    },

    getBrandingManager: function(forceReload) {
        if (forceReload || rpc.brandingManager === undefined) {
            try {
                rpc.brandingManager = rpc.jsonrpc.UvmContext.brandingManager();
            } catch (e) {
                Ung.Util.rpcExHandler(e);
            }
        }
        return rpc.brandingManager;
    },

    getOemManager: function(forceReload) {
        if (forceReload || rpc.oemManager === undefined) {
            try {
                rpc.oemManager = rpc.jsonrpc.UvmContext.oemManager();
            } catch (e) {
                Ung.Util.rpcExHandler(e);
            }
        }
        return rpc.oemManager;
    },

    getLicenseManager: function(forceReload) {
        // default functionality is to reload license manager as it might change in uvm
        if (typeof forceReload === 'undefined') {
            forceReload = true;
        }
        if (forceReload || rpc.licenseManager === undefined) {
            try {
              rpc.licenseManager = rpc.jsonrpc.UvmContext.licenseManager();
            } catch (e) {
                Ung.Util.rpcExHandler(e);
            }
        }
        return rpc.licenseManager;
    },
    getExecManager: function(forceReload) {
        if (forceReload || rpc.execManager === undefined) {
            try {
                rpc.execManager = rpc.jsonrpc.UvmContext.execManager();
            } catch (e) {
                Ung.Util.rpcExHandler(e);
            }

        }
        return rpc.execManager;
    },
    getLocalDirectory: function(forceReload) {
        if (forceReload || rpc.localDirectory === undefined) {
            try {
                rpc.localDirectory = rpc.jsonrpc.UvmContext.localDirectory();
            } catch (e) {
                Ung.Util.rpcExHandler(e);
            }
        }
        return rpc.localDirectory;
    },

    getMailSender: function(forceReload) {
        if (forceReload || rpc.mailSender === undefined) {
            try {
                rpc.mailSender = rpc.jsonrpc.UvmContext.mailSender();
            } catch (e) {
            Ung.Util.rpcExHandler(e);
            }
        }
        return rpc.mailSender;
    },

    getNetworkSettings: function(forceReload) {
        if (forceReload || rpc.networkSettings === undefined) {
            try {
                rpc.networkSettings = Ung.Main.getNetworkManager().getNetworkSettings();
            } catch (e) {
                Ung.Util.rpcExHandler(e);
            }
        }
        return rpc.networkSettings;
    },

    // load policies list
    loadPolicies: function() {
        Ext.MessageBox.wait(i18n._("Loading Apps..."), i18n._("Please wait"));
        if (rpc.policyManager != null) {
            rpc.policyManager.getSettings(Ext.bind(function (result, exception) {
                if(Ung.Util.handleException(exception)) return;
                rpc.policies=result.policies.list;
                this.buildPolicies();
            }, this));
        } else {
            // no policy manager, just one policy (Default Rack)
            rpc.policies = [{
                javaClass: "com.untangle.node.policy.PolicySettings",
                policyId: "1",
                name: i18n._("Default Rack"),
                description: i18n._("The Default Rack/Policy")
            }];
            this.buildPolicies();
        }
    },
    getNodePackageDesc: function(nodeSettings) {
        var i;
        if(this.myApps!==null) {
            for(i=0;i<this.myApps.length;i++) {
                if(this.myApps[i].name==nodeSettings.nodeName) {
                    return this.myApps[i];
                }
            }
        }
        return null;
    },
    createNode: function (nodeProperties, nodeSettings, nodeMetrics, license, runState) {
        var node = {
            nodeId: nodeSettings.id,
            nodeSettings: nodeSettings,
            type: nodeProperties.type,
            hasPowerButton: nodeProperties.hasPowerButton,
            name: nodeProperties.name,
            displayName: nodeProperties.displayName,
            license: license,
            image: 'chiclet?name='+nodeProperties.name,
            metrics: nodeMetrics,
            runState: runState,
            viewPosition: nodeProperties.viewPosition
        };
        return node;
    },
    buildApps: function () {
        //destroy Apps
        var i;
        for(i=0; i<Ung.Main.apps.length; i++) {
            Ext.destroy(Ung.Main.apps[i]);
        }
        //build Apps
        Ung.Main.apps=[];
        for(i=0;i<rpc.rackView.installable.list.length;i++) {
            Ung.Main.apps.push(Ext.create("Ung.AppItem", {nodeProperties: rpc.rackView.installable.list[i]}));
        }
    },
    buildNodes: function() {
        //build nodes
        Ung.MetricManager.stop();
        Ext.getCmp('policyManagerMenuItem').disable();
        var nodePreviews = Ext.clone(Ung.Main.nodePreviews);
        this.destoyNodes();
        this.nodes=[];
        var i, node;

        for(i=0;i<rpc.rackView.instances.list.length;i++) {
            var nodeSettings=rpc.rackView.instances.list[i];
            var nodeProperties=rpc.rackView.nodeProperties.list[i];

            node = this.createNode(nodeProperties,
                     nodeSettings,
                     rpc.rackView.nodeMetrics.map[nodeSettings.id],
                     rpc.rackView.licenseMap.map[nodeProperties.name],
                     rpc.rackView.runStates.map[nodeSettings.id]);
            this.nodes.push(node);
        }
        if(!rpc.isRegistered) {
            this.showWelcomeScreen();
        }
        this.updateSeparator();
        for(i=0; i<this.nodes.length; i++) {
            node=this.nodes[i];
            this.addNode(node, nodePreviews[node.name]);
        }
        if(!Ung.Main.disableThreads) {
            Ung.MetricManager.start(true);
        }
        if(this.target) {
            //Open target if specified
            //target usage in the query string:
            //config.<configItemName>(.<tabName>(.subtabNane or .buttonName))
            //node.<nodeName>(.<tabName>(.subtabNane or .buttonName))
            //monitor.[sessions|hosts](.<tabName>)
            var targetTokens = this.target.split(".");
            if(targetTokens.length >= 2) {
                var firstToken = targetTokens[0].toLowerCase();
                if(firstToken == "config" ) {
                    var configItem =this.configMap[targetTokens[1]];
                    if(configItem) {
                        Ung.Main.openConfig(configItem);
                    }
                } else if(firstToken == "node") {
                    var nodeName = targetTokens[1].toLowerCase();
                    for( i=0 ; i<Ung.Main.nodes.length ; i++) {
                        if(Ung.Main.nodes[i].name == nodeName) {
                            var nodeCmp = Ung.Node.getCmp(Ung.Main.nodes[i].nodeId);
                            if (nodeCmp != null) {
                                nodeCmp.loadSettings();
                            }
                            break;
                        }
                    }
                } else if(firstToken == "monitor") {
                    var secondToken = targetTokens[1].toLowerCase();
                    if(secondToken == 'sessions') {
                        Ung.Main.showSessions();
                    } else if(secondToken == 'hosts') {
                        Ung.Main.showHosts();
                    }
                }
            } else {
                this.target = null;
            }
            // remove target in max 10 seconds to prevent using it again
            Ext.Function.defer(function() {
                Ung.Main.target = null;
            }, 10000, this);
        }
        if(Ext.MessageBox.isVisible() && Ext.MessageBox.title==i18n._("Please wait")) {
            Ext.Function.defer(Ext.MessageBox.hide,30,Ext.MessageBox);
        }
    },
    // load the rack view for current policy
    loadRackView: function() {
        var callback = Ext.bind(function (result, exception) {
            if(Ung.Util.handleException(exception)) return;
            rpc.rackView=result;
            var parentRackName = this.getParentName( rpc.currentPolicy.parentId );
            var parentRackDisplay = Ext.get('parent-rack-container');

            if (parentRackName == null) {
                parentRackDisplay.dom.innerHTML = "";
                parentRackDisplay.hide();
            } else {
                parentRackDisplay.show();
                parentRackDisplay.dom.innerHTML = i18n._("Parent Rack")+":<br/>" + parentRackName;
            }

            Ung.Main.buildApps();
            Ung.Main.buildNodes();
        }, this);
        Ung.Util.RetryHandler.retry( rpc.rackManager.getRackView, rpc.rackManager, [ rpc.currentPolicy.policyId ], callback, 1500, 10 );
    },
    updateRackView: function() {
        var callback = Ext.bind(function(result,exception) {
            if(Ung.Util.handleException(exception)) return;
            rpc.rackView=result;
            var i=0, j=0; installableNodes=rpc.rackView.installable.list;
            var updatedApps = [];
            while(i<installableNodes.length || j<Ung.Main.apps.length) {
                var appCmp;
                if(i==installableNodes.length) {
                    Ext.destroy(Ung.Main.apps[j]);
                    Ung.Main.apps[j]=null;
                    j++;
                } else if(j == Ung.Main.apps.length) {
                    appCmp = Ext.create("Ung.AppItem", {nodeProperties: installableNodes[i], renderPosition: updatedApps.length});
                    updatedApps.push(appCmp);
                    i++;
                } else if(installableNodes[i].name == Ung.Main.apps[j].nodeProperties.name) {
                    updatedApps.push(Ung.Main.apps[j]);
                    i++;
                    j++;
                } else if(installableNodes[i].viewPosition < Ung.Main.apps[j].nodeProperties.viewPosition) {
                    appCmp = Ext.create("Ung.AppItem", {nodeProperties: installableNodes[i], renderPosition: updatedApps.length});
                    updatedApps.push(appCmp);
                    i++;
                } else if(installableNodes[i].viewPosition >= Ung.Main.apps[j].nodeProperties.viewPosition){
                    Ext.destroy(Ung.Main.apps[j]);
                    Ung.Main.apps[j]=null;
                    j++;
                }
            }
            Ung.Main.apps=updatedApps;
            Ung.Main.buildNodes();
        }, this);
        Ung.Util.RetryHandler.retry( rpc.rackManager.getRackView, rpc.rackManager, [ rpc.currentPolicy.policyId ], callback, 1500, 10 );
    },
    reloadLicenses: function() {
        Ung.Main.getLicenseManager().reloadLicenses(Ext.bind(function(result,exception) {
            // do not pop-up license managerexceptions because they happen when offline
            // if(Ung.Util.handleException(exception)) return;
            if (exception) return;

            var callback = Ext.bind(function(result,exception) {
                if(Ung.Util.handleException(exception)) return;
                rpc.rackView=result;
                for (var i = 0; i < Ung.Main.nodes.length; i++) {
                    var nodeCmp = Ung.Node.getCmp(Ung.Main.nodes[i].nodeId);
                    if (nodeCmp && nodeCmp.license) {
                        nodeCmp.updateLicense(rpc.rackView.licenseMap.map[nodeCmp.name]);
                    }
                }
            }, this);

            Ung.Util.RetryHandler.retry( rpc.rackManager.getRackView, rpc.rackManager, [ rpc.currentPolicy.policyId ], callback, 1500, 10 );
        }, this));
    },

    installNode: function(nodeProperties, appItem, completeFn) {
        if(!rpc.isRegistered) {
            Ung.Main.openRegistrationScreen();
            return;
        }
        if( nodeProperties === null ) {
            return;
        }
        // Sanity check to see if the node is already installed.
        var node = Ung.Main.getNode( nodeProperties.name );
        if (( node !== null ) && ( node.nodeSettings.policyId == rpc.currentPolicy.policyId )) {
            appItem.hide();
            return;
        }

        Ung.AppItem.setLoading(nodeProperties.name, true);
        Ung.Main.addNodePreview( nodeProperties );
        rpc.nodeManager.instantiate(Ext.bind(function (result, exception) {
            if (exception) {
                Ung.AppItem.setLoading(nodeProperties.name, false);
                Ung.Main.removeNodePreview( nodeProperties.name );
                Ung.Main.updateRackView();
                Ung.Util.handleException(exception);
                return;
            }
            Ung.Main.updateRackView();
            if (completeFn)
                completeFn();
        }, this), nodeProperties.name, rpc.currentPolicy.policyId);
    },
    // build Config
    buildConfig: function() {
        this.config =[{
            name: 'network',
            displayName: i18n._('Network'),
            iconClass: 'icon-config-network',
            helpSource: 'network',
            className: 'Webui.config.network'
        }, {
            name: 'administration',
            displayName: i18n._('Administration'),
            iconClass: 'icon-config-admin',
            helpSource: 'administration',
            className: 'Webui.config.administration'
        }, {
            name: 'email',
            displayName: i18n._('Email'),
            iconClass: 'icon-config-email',
            helpSource: 'email',
            className: 'Webui.config.email'
        }, {
            name: 'localDirectory',
            displayName: i18n._('Local Directory'),
            iconClass: 'icon-config-directory',
            helpSource: 'local_directory',
            className: 'Webui.config.localDirectory'
        }, {
            name: 'upgrade',
            displayName: i18n._('Upgrade'),
            iconClass: 'icon-config-upgrade',
            helpSource: 'upgrade',
            className: 'Webui.config.upgrade'
        }, {
            name: 'system',
            displayName: i18n._('System'),
            iconClass: 'icon-config-setup',
            helpSource: 'system',
            className: 'Webui.config.system'
        }, {
            name: 'about',
            displayName: i18n._('About'),
            iconClass: 'icon-config-support',
            helpSource: 'about',
            className: 'Webui.config.about'
        }];
        this.configMap = Ung.Util.createRecordsMap(this.config, "name");
        for(var i=0;i<this.config.length;i++) {
            Ext.create('Ung.ConfigItem', {
                item: this.config[i]
            });
        }
    },
    checkForIE: function (handler) {
        if (Ext.isIE) {
            var noIEDisplay = Ext.get('no-ie-container');
            noIEDisplay.show();

            this.noIEToolTip= new Ext.ToolTip({
                target: document.getElementById("no-ie-container"),
                dismissDelay: 0,
                hideDelay: 1500,
                width: 500,
                cls: 'extended-stats',
                html: i18n._("For an optimal experience use Google Chrome or Mozilla Firefox.")
            });
            this.noIEToolTip.render(Ext.getBody());
        }
        if (Ext.isIE6 || Ext.isIE7 || Ext.isIE8 ) {
            Ext.MessageBox.alert( i18n._("Warning"),
                                  i18n._("Internet Explorer 8 and prior are not supported for administration.") + "<br/>" +
                                  i18n._("Please upgrade to a newer browser.") );
        }
    },
    checkForAlerts: function (handler) {
        //check for upgrades
        rpc.alertManager.getAlerts(Ext.bind(function( result, exception, opt, handler ) {
            var alertDisplay = Ext.get('alert-container');
            var alertArr=[];

            if (result != null && result.list.length > 0) {
                alertDisplay.show();
                alertArr.push('<div class="title">'+i18n._("Alerts:")+'</div>');
                for (var i = 0; i < result.list.length; i++) {
                    alertArr.push('<div class="values">&middot;&nbsp;'+i18n._(result.list[i])+'</div>');
                }
            } else {
                alertDisplay.hide();
            }

            this.alertToolTip= new Ext.ToolTip({
                target: document.getElementById("alert-container"),
                dismissDelay: 0,
                hideDelay: 1500,
                width: 500,
                cls: 'extended-stats',
                items: [{
                    xtype: 'container',
                    html: alertArr.join('')
                },{
                    xtype: 'container',
                    html: '<br/>' + '<b>' + i18n._('Press Help for more information') + "</b>"
                },{
                    xtype: 'button',
                    name: 'Help',
                    iconCls: 'icon-help',
                    text: i18n._('Help with Administration Alerts'),
                    handler: function() {
                        //helpSource: 'admin_alerts'
                        Ung.Main.openHelp('admin_alerts');
                    }
                }]
            });
            this.alertToolTip.render(Ext.getBody());
        }, this,[handler],true));
    },
    openConfig: function(configItem) {
        Ext.MessageBox.wait(i18n._("Loading Config..."), i18n._("Please wait"));
        var createWinFn= function(config) {
            Ung.Main.configWin = Ext.create(config.className, config);
            Ung.Main.configWin.show();
            Ext.MessageBox.hide();
        };
        Ext.Function.defer(function() {
            Ext.require([this.className], function() {
                var configClass = Ext.ClassManager.get(this.className);
                if( configClass != null && Ext.isFunction( configClass.preload ) ) {
                    configClass.preload(this, createWinFn);
                } else {
                    createWinFn(this);
                }
            }, this);
        }, 10, configItem);
    },
    destoyNodes: function () {
        if(this.nodes!==null) {
            for(var i=0;i<this.nodes.length;i++) {
                Ext.destroy(Ung.Node.getCmp(this.nodes[i].nodeId));
            }
        }
        for(var nodeName in this.nodePreviews) {
            Ung.Main.removeNodePreview(nodeName);
        }
    },
    getNodePosition: function(place, viewPosition) {
        var placeEl=document.getElementById(place);
        var position=0;
        if(placeEl.hasChildNodes()) {
            for(var i=0;i<placeEl.childNodes.length;i++) {
                if(placeEl.childNodes[i].getAttribute('viewPosition')-viewPosition<0) {
                    position=i+1;
                } else {
                    break;
                }
            }
        }
        return position;
    },
    addNode: function (node, fadeIn) {
        var nodeCmp = Ext.create('Ung.Node', node);
        nodeCmp.fadeIn=fadeIn;
        var place=(node.type=="FILTER")?'filter_nodes':'service_nodes';
        var position=this.getNodePosition(place, node.viewPosition);
        nodeCmp.render(place, position);
        Ung.AppItem.setLoading(node.name, false);
        if ( node.name == 'untangle-node-policy') {
            // refresh rpc.policyManager to properly handle the case when the policy manager is removed and then re-added to the application list
            rpc.jsonrpc.UvmContext.nodeManager().node(Ext.bind(function(result, exception) {
                if(Ung.Util.handleException(exception)) return;
                Ext.getCmp('policyManagerMenuItem').enable();
            }, this),"untangle-node-policy");
        }
    },
    addNodePreview: function ( nodeProperties ) {
        var nodeCmp = Ext.create('Ung.NodePreview', nodeProperties );
        var place = ( nodeProperties.viewPosition < 1000) ? 'filter_nodes' : 'service_nodes';
        var position = this.getNodePosition( place, nodeProperties.viewPosition );
        nodeCmp.render(place, position);
        Ung.Main.nodePreviews[nodeProperties.name] = true;
    },
    removeNodePreview: function(nodeName) {
        if(Ung.Main.nodePreviews[nodeName] !== undefined) {
            delete Ung.Main.nodePreviews[nodeName];
        }
        Ext.destroy(Ext.getCmp("node_preview_"+nodeName));
    },
    removeNode: function(index) {
        var nodeId = Ung.Main.nodes[index].nodeId;
        var nodeCmp = (nodeId != null) ? Ext.getCmp('node_'+nodeId): null;
        Ung.Main.nodes.splice(index, 1);
        if(nodeCmp) {
            Ext.destroy(nodeCmp);
            return true;
        }
        return false;
    },
    getNode: function(nodeName) {
        if(Ung.Main.nodes) {
            var nodePolicyId;
            for (var i = 0; i < Ung.Main.nodes.length; i++) {
                nodePolicyId = Ung.Main.nodes[i].nodeSettings.policyId;
                if (nodeName == Ung.Main.nodes[i].name && (nodePolicyId == null || nodePolicyId == rpc.currentPolicy.policyId)) {
                    return Ung.Main.nodes[i];
                }
            }
        }
        return null;
    },
    // Show - hide Services header in the rack
    updateSeparator: function() {
        var hasService=false;
        for(var i=0;i<this.nodes.length;i++) {
            if(this.nodes[i].type != "FILTER") {
                hasService=true;
                break;
            }
        }
        document.getElementById("nodes-separator-text").innerHTML=hasService ? i18n._("Services") : "";
        document.getElementById("nodes-separator").style.display= hasService ? "" : "none";
        document.getElementById("racks").style.backgroundPosition = hasService ? "0px 100px" : "0px 50px";
    },
    // build policies select box
    buildPolicies: function () {
        if(Ung.Main.rackSelect!=null) {
            Ext.destroy(Ung.Main.rackSelect);
            Ext.get('rack-select-container').dom.innerHTML = '';
        }
        var items=[];
        var selVirtualRackIndex = 0;
        rpc.policyNamesMap = {};
        rpc.policyNamesMap[0] = i18n._("No Rack");
        for( var i=0 ; i<rpc.policies.length ; i++ ) {
            var policy = rpc.policies[i];
            rpc.policyNamesMap[policy.policyId] = policy.name;
            items.push({
                text: policy.name,
                value: policy.policyId,
                index: i,
                handler: Ung.Main.changeRack,
                hideDelay: 0
            });
            if( policy.policyId == 1 ) {
                rpc.currentPolicy = policy;
                selVirtualRackIndex = i;
            }
        }
        items.push('-');
        items.push({text: i18n._('Show Policy Manager'), value: 'SHOW_POLICY_MANAGER', handler: Ung.Main.showPolicyManager, id:'policyManagerMenuItem', disabled: true, hideDelay: 0});
        items.push('-');
        items.push({text: i18n._('Show Sessions'), value: 'SHOW_SESSIONS', handler: Ung.Main.showSessions, hideDelay: 0});
        items.push({text: i18n._('Show Hosts'), value: 'SHOW_HOSTS', handler: Ung.Main.showHosts, hideDelay: 0});
        Ung.Main.rackSelect = Ext.create('Ext.SplitButton', {
            renderTo: 'rack-select-container', // the container id
            text: items[selVirtualRackIndex].text,
            id:'rack-select',
            menu: new Ext.menu.Menu({
                hideDelay: 0,
                items: items
            })
        });
        this.checkForAlerts();
        this.checkForIE();

        Ung.Main.loadRackView();
    },
    getPolicyName: function(policyId) {
        if (Ext.isEmpty(policyId)){
            return i18n._( "Services" );
        }
        if (rpc.policyNamesMap[policyId] !== undefined) {
            return rpc.policyNamesMap[policyId];
        } else {
            return i18n._( "Unknown Rack" );
        }
    },
    showHosts: function() {
        Ext.require(['Webui.config.hostMonitor'], function() {
            if ( Ung.Main.hostMonitorWin == null) {
                Ung.Main.hostMonitorWin=Ext.create('Webui.config.hostMonitor', {"name":"hostMonitor", "helpSource":"host_viewer"});
            }
            Ung.Main.hostMonitorWin.show();
            Ext.MessageBox.wait(i18n._("Loading..."), i18n._("Please wait"));
            Ext.Function.defer(function() {
                Ung.Main.hostMonitorWin.gridCurrentHosts.reload();
                Ext.MessageBox.hide();
            }, 10, this);
        }, this);
    },
    showSessions: function() {
        Ung.Main.showNodeSessions(0);
    },
    showNodeSessions: function(nodeIdArg) {
        Ext.require(['Webui.config.sessionMonitor'], function() {
            if ( Ung.Main.sessionMonitorWin == null) {
                Ung.Main.sessionMonitorWin = Ext.create('Webui.config.sessionMonitor', {"name":"sessionMonitor", "helpSource":"session_viewer"});
            }
            Ung.Main.sessionMonitorWin.show();
            Ext.MessageBox.wait(i18n._("Loading..."), i18n._("Please wait"));
            Ext.Function.defer(function() {
                Ung.Main.sessionMonitorWin.gridCurrentSessions.setSelectedApp(nodeIdArg);
                Ext.MessageBox.hide();
            }, 10, this);
        }, this);
    },
    showPolicyManager: function() {
        var node = Ung.Main.getNode("untangle-node-policy");
        if (node != null) {
            var nodeCmp = Ung.Node.getCmp(node.nodeId);
            if (nodeCmp != null) {
                nodeCmp.loadSettings();
            }
        }
    },
    // change current policy
    changeRack: function () {
        Ung.Main.rackSelect.setText(this.text);
        rpc.currentPolicy = rpc.policies[this.index];
        Ung.Main.loadRackView();
    },
    getParentName: function( parentId ) {
        if( parentId == null || rpc.policies === null) {
            return null;
        }
        for ( var c = 0 ; c < rpc.policies.length ; c++ ) {
            if ( rpc.policies[c].policyId == parentId ) {
                return rpc.policies[c].name;
            }
        }
        return null;
    },
    // Opens a link in a iframe pop-up window in the middle of the rack
    openIFrame: function( url, title ) {
        console.log("Open IFrame:", url);
        if ( url == null ) {
            alert("can not open window to null URL");
        }
        if(!this.iframeWin) {
            this.iframeWin = Ext.create("Ung.Window",{
                id: 'iframeWin',
                layout: 'fit',
                defaults: {},
                items: {
                    html: '<iframe id="iframeWin_iframe" name="iframeWin_iframe" width="100%" height="100%" frameborder="0"/>'
                },
                closeWindow: function() {
                    this.setTitle('');
                    this.hide();
                    window.frames["iframeWin_iframe"].location.href="/webui/blank.html";
                    Ung.Main.reloadLicenses();
                },
                doSize: function() {
                    var objSize = Ung.Main.viewport.getSize();
                    objSize.width = objSize.width - Ung.Main.contentLeftWidth;
                    
                    if(objSize.width < 850 || objSize.height < 470) {
                        this.setPosition(Ung.Main.contentLeftWidth, 0);
                    } else {
                        var scale = 0.9;
                        this.setPosition(Ung.Main.contentLeftWidth + Math.round(objSize.width*(1-scale)/2), Math.round(objSize.height*(1-scale)/2));
                        objSize.width = Math.round(objSize.width * scale);
                        objSize.height = Math.round(objSize.height * scale);
                        
                    }
                    this.setSize(objSize);
                }
            });
        }
        this.iframeWin.setTitle(title);
        this.iframeWin.show();
        window.frames["iframeWin_iframe"].location.href = url;
    },
    closeIframe: function() {
        if(this.iframeWin!=null && this.iframeWin.isVisible() ) {
            this.iframeWin.closeWindow();
        }
        this.reloadLicenses();
    },
    openFailureScreen: function () {
        var url = "/webui/offline.jsp";
        this.openIFrame( url, i18n._("Warning") );
    },
    // Prepares the uvm to display the welcome screen
    showWelcomeScreen: function () {
        if(this.welcomeScreenAlreadShown) {
            return;
        }
        this.welcomeScreenAlreadShown = true;
        //Test if box is online (store is available)
        Ext.MessageBox.wait(i18n._("Determining Connectivity..."), i18n._("Please wait"));

        rpc.jsonrpc.UvmContext.isStoreAvailable(Ext.bind(function(result, exception) {
            if(Ung.Util.handleException(exception)) return;
            Ext.MessageBox.hide();
            // If box is not online - show error message.
            // Otherwise show registration screen
            if(!result) {
                Ung.Main.openFailureScreen();
            } else {
                Ung.Main.openRegistrationScreen();
                Ung.CheckStoreRegistration.start();
            }
        }, this));
    },
    showPostRegistrationPopup: function() {
        if (this.nodes.length != 0) {
            // do not show anything if apps already installed
            return;
        }

        var popup = Ext.create('Ext.window.MessageBox', {
            buttons: [{
                name: 'Yes',
                text: i18n._("Yes, install the recommended apps."),
                handler: Ext.bind(function() {
                    var apps = [
                        { displayName: "Web Filter", name: 'untangle-node-sitefilter'},
                        //{ displayName: "Web Filter Lite", name: 'untangle-node-webfilter'},
                        { displayName: "Virus Blocker", name: 'untangle-node-virusblocker'},
                        //{ displayName: "Virus Blocker Lite", name: 'untangle-node-clam'},
                        { displayName: "Spam Blocker", name: 'untangle-node-spamblocker'},
                        //{ displayName: "Spam Blocker Lite", name: 'untangle-node-spamassassin'},
                        //{ displayName: "Phish Blocker", name: 'untangle-node-phish'},
                        //{ displayName: "Web Cache", name: 'untangle-node-webcache'},
                        { displayName: "Bandwidth Control", name: 'untangle-node-bandwidth'},
                        { displayName: "HTTPS Inspector", name: 'untangle-casing-https'},
                        { displayName: "Application Control", name: 'untangle-node-classd'},
                        //{ displayName: "Application Control Lite", name: 'untangle-node-protofilter'},
                        { displayName: "Captive Portal", name: 'untangle-node-capture'},
                        { displayName: "Firewall", name: 'untangle-node-firewall'},
                        //{ displayName: "Intrusion Prevention", name: 'untangle-node-ips'},
                        //{ displayName: "Ad Blocker", name: 'untangle-node-adblocker'},
                        { displayName: "Reports", name: 'untangle-node-reporting'},
                        { displayName: "Policy Manager", name: 'untangle-node-policy'},
                        { displayName: "Directory Connector", name: 'untangle-node-adconnector'},
                        { displayName: "WAN Failover", name: 'untangle-node-faild'},
                        { displayName: "WAN Balancer", name: 'untangle-node-splitd'},
                        { displayName: "IPsec VPN", name: 'untangle-node-ipsec'},
                        { displayName: "OpenVPN", name: 'untangle-node-openvpn'},
                        { displayName: "Configuration Backup", name: 'untangle-node-boxbackup'},
                        { displayName: "Branding Manager", name: 'untangle-node-branding'},
                        { displayName: "Live Support", name: 'untangle-node-support'}];

                    // only install this on 1gig+ machines
                    if ( Ung.Main.totalMemoryMb > 900 ) {
                        apps.splice(4,0,{ displayName: "Phish Blocker", name: 'untangle-node-phish'});
                        apps.splice(2,0,{ displayName: "Virus Blocker Lite", name: 'untangle-node-clam'});
                    }

                    var fn = function( appsToInstall ) {
                        // if there are no more apps left to install we are done
                        if ( appsToInstall.length == 0 ) {
                            Ext.MessageBox.alert(i18n._("Installation Complete!"), i18n._("Thank you for using Untangle!"));
                            return;
                        }
                        var name = appsToInstall[0].name;
                        appsToInstall.shift();
                        var completeFn = Ext.bind( fn, this, [appsToInstall] ); // function to install remaining apps
                        var app = Ung.AppItem.getApp(name);
                        if ( app ) {
                            app.installNode( completeFn );
                        } else {
                            completeFn();
                        }
                    };
                    fn( apps );
                    popup.close();
                }, this)
            },{
                name: 'No',
                text: i18n._("No, I will install the apps manually."),
                handler: Ext.bind(function() {
                    popup.close();
                }, this)
            }]
        });
        popup.show({
            title: i18n._("Registration complete."),
            width: 470,
            msg: i18n._("Thank you for using Untangle!") + "<br/>" + "<br/>" +
                i18n._("Applications can now be installed and configured.") + "<br/>" +
                i18n._("Would you like to install the recommended applications now?"),
            icon: Ext.MessageBox.QUESTION
        });
    }
});