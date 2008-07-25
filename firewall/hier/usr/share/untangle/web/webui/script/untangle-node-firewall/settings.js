if (!Ung.hasResource["Ung.Firewall"]) {
    Ung.hasResource["Ung.Firewall"] = true;
    Ung.Settings.registerClassName('untangle-node-firewall', 'Ung.Firewall');

    Ung.Firewall = Ext.extend(Ung.Settings, {
        gridRules : null,
        gridEventLog : null,
        // called when the component is rendered
        onRender : function(container, position) {
            // call superclass renderer first
            Ung.Firewall.superclass.onRender.call(this, container, position);
            // builds the tabs
            this.buildRules();
            this.buildEventLog();
            // builds the tab panel with the tabs
            this.buildTabPanel([this.panelRules, this.gridEventLog]);

            var ddrowTarget = new Ext.dd.DropTarget(this.gridRules.container, {
                ddGroup: "GridDD",
                // copy:false,
                notifyDrop : function(dd, e, data){
                    var sm = this.gridRules.getSelectionModel();
                    var rows = sm.getSelections();
                    var cindex = dd.getDragData(e).rowIndex;    // Here is need
        
                    var dsGrid = this.gridRules.getStore();
                    
                    for(i = 0; i < rows.length; i++) {
                        rowData = dsGrid.getById(rows[i].id);
                        dsGrid.remove(dsGrid.getById(rows[i].id));
                        dsGrid.insert(cindex, rowData);
                    };
        
                    this.gridRules.getView().refresh();
        
                    // put the cursor focus on the row of the gridRules which we just draged
                    this.gridRules.getSelectionModel().selectRow(cindex); 
                }.createDelegate(this)
            });            
        },
        // Rules Panel
        buildRules : function() {
            // enable is a check column
            var liveColumn = new Ext.grid.CheckColumn({
                header : this.i18n._("Enable"),
                dataIndex : 'live',
                fixed : true
            });

            var actionData = [[false, this.i18n._('Pass')],[true, this.i18n._('Block')]];

            this.panelRules = new Ext.Panel({
                name : 'panelRules',
                // private fields
                gridRulesList : null,
                parentId : this.getId(),
                title : this.i18n._('Rules'),
                autoScroll : true,
                border : false,
                bodyStyle : 'padding:5px 5px 0px 5px;',
                items : [this.gridRules = new Ung.EditorGrid({
                        name : 'Rules',
                        settingsCmp : this,
                        height : 500,
                        totalRecords : this.getBaseSettings().firewallRulesLength,
                        paginated : false,
                        hasReorder : true,
                        
                        enableDragDrop : true,
                        selModel: new Ext.grid.RowSelectionModel({singleSelect:true}),
				        dropConfig: {
				            appendOnly:true
				        },
                        
                        emptyRow : {
                            "live" : true,
                            "action" : this.i18n._('Block'),
                            "log" : false,
                            "protocol" : this.i18n._("[no protocol]"),
                            "srcIntf" : this.i18n._("[no source interface]"),
                            "dstIntf" : this.i18n._("[no destination interface]"),
                            "srcAddress" : this.i18n._("[no source address]"),
                            "dstAddress" : this.i18n._("[no destination address]"),
                            "srcPort" : this.i18n._("[no source port]"),
                            "dstPort" : this.i18n._("[no destionation port]"),
                            "name" : this.i18n._("[no name]"),
                            "category" : this.i18n._("[no category]"),
                            "description" : this.i18n._("[no description]")
                        },
                        title : this.i18n._("Rules"),
                        recordJavaClass : "com.untangle.node.firewall.FirewallRule",
                        proxyRpcFn : this.getRpcNode().getFirewallRuleList,
                        fields : [{
                            name : 'id'
                        }, {
                            name : 'live'
                        }, {
                            name : 'action'
                        }, {
                            name : 'log'
                        }, {
                            name : 'protocol'
                        }, {
                            name : 'srcIntf'
                        }, {
                            name : 'dstIntf'
                        }, {
                            name : 'srcAddress'
                        }, {
                            name : 'dstAddress'
                        }, {
                            name : 'srcPort'
                        }, {
                            name : 'dstPort'
                        }, {
                            name : 'name'
                        }, {
                            name : 'category'
                        }, {
                            name : 'description'
                        }, {
                            name : 'javaClass'
                        }],
                        columns : [liveColumn, {
                            id : 'description',
                            header : this.i18n._("Description"),
                            width : 200,
                            dataIndex : 'description'
                        }],
                        sortField : 'description',
                        columnsDefaultSortable : true,
                        autoExpandColumn : 'description',
                        plugins : [liveColumn],
                        rowEditorInputLines : [new Ext.form.Checkbox({
                            name : "Enable Rule",
                            dataIndex: "live",
                            fieldLabel : this.i18n._("Enable Rule")
                        }), new Ext.form.ComboBox({
                            name : "Action",
                            dataIndex: "action",
                            fieldLabel : this.i18n._("Action"),
	                        store : new Ext.data.SimpleStore({
	                            fields : ['key', 'name'],
	                            data : actionData
	                        }),
	                        displayField : 'name',
	                        valueField : 'key',
                            forceSelection : true,
	                        typeAhead : true,
	                        mode : 'local',
	                        triggerAction : 'all',
	                        listClass : 'x-combo-list-small',
	                        selectOnFocus : true
                        }), new Ext.form.Checkbox({
                            name : "Log",
                            dataIndex: "log",
                            fieldLabel : this.i18n._("Log")
                        }), new Ung.Util.ProtocolCombo({
                            name : "Traffic Type",
                            dataIndex: "protocol",
                            fieldLabel : this.i18n._("Traffic Type"),
                            width : 100
                        }), new Ung.Util.InterfaceCombo({
                            name : "Source Interface",
                            dataIndex: "srcIntf",
                            fieldLabel : this.i18n._("Source Interface"),
                            width : 150
                        }), new Ung.Util.InterfaceCombo({
                            name : "Destination Interface",
                            dataIndex: "dstIntf",
                            fieldLabel : this.i18n._("Destination Interface"),
                            width : 150
                        }), new Ext.form.TextField({
                            name : "Source Address",
                            dataIndex: "srcAddress",
                            fieldLabel : this.i18n._("Source Address"),
                            allowBlank : false,
                            width : 150
                        }), new Ext.form.TextField({
                            name : "Destination Address",
                            dataIndex: "dstAddress",
                            fieldLabel : this.i18n._("Destination Address"),
                            allowBlank : false,
                            width : 150
                        }), new Ext.form.TextField({
                            name : "Source Port",
                            dataIndex: "srcPort",
                            fieldLabel : this.i18n._("Source Port"),
                            width : 150,
                            allowBlank : false
                        }), new Ext.form.TextField({
                            name : "Destination Port",
                            dataIndex: "dstPort",
                            fieldLabel : this.i18n._("Destination Port"),
                            allowBlank : false,
                            width : 150
                        }), new Ext.form.TextField({
                            name : "Category",
                            dataIndex: "category",
                            fieldLabel : this.i18n._("Category"),
                            width : 150
                        }), new Ext.form.TextField({
                            name : "Description",
                            dataIndex: "description",
                            fieldLabel : this.i18n._("Description"),
                            width : 400
                        })]
                    })
                ]
//                ,
//                onManagePassedRules : function() {
//                    if (!this.gridRulesList) {
//                        var settingsCmp = Ext.getCmp(this.parentId);
//                        settingsCmp.buildRules();
//                        this.gridRulesList = new Ung.ManageListWindow({
//                            breadcrumbs : [{
//                                title : i18n._(rpc.currentPolicy.name),
//                                action : function() {
//                                    this.panelRules.gridRulesList.cancelAction();
//                                    this.cancelAction();
//                                }.createDelegate(settingsCmp)
//                            }, {
//                                title : settingsCmp.node.md.displayName,
//                                action : function() {
//                                    this.panelRules.gridRulesList.cancelAction();
//                                }.createDelegate(settingsCmp)
//                            }, {
//                                title : settingsCmp.i18n._("Rules")
//                            }],
//                            grid : settingsCmp.gridRules
//                        });
//                    }
//                    this.gridRulesList.show();
//                }
            });
        },
        // Event Log
        buildEventLog : function() {
            this.gridEventLog = new Ung.GridEventLog({
                settingsCmp : this,
                fields : [{
                    name : 'id'
                }, {
                    name : 'timeStamp'
                }, {
                    name : 'ruleIndex'
                }, {
                    name : 'pipelineEndpoints'
                }, {
                    name : 'wasBlocked'
                }],
                columns : [{
                    header : i18n._("timestamp"),
                    width : 150,
                    sortable : true,
                    dataIndex : 'timeStamp',
                    renderer : function(value) {
                        return i18n.timestampFormat(value);
                    }
                }, {
                    header : i18n._("action"),
                    width : 55,
                    sortable : true,
                    dataIndex : 'wasBlocked',
                    renderer : function(value) {
                        switch (value) {
                            case 1 : // BLOCKED
                                return this.i18n._("blocked");
                            default :
                            case 0 : // PASSED
                                return this.i18n._("passed");
                        }
                    }.createDelegate(this)
                }, {
                    header : i18n._("client"),
                    width : 165,
                    sortable : true,
                    dataIndex : 'pipelineEndpoints',
                    renderer : function(value) {
                        return value === null ? "" : value.CClientAddr.hostAddress + ":" + value.CClientPort;
                    }
                }, {
                    header : i18n.sprintf(this.i18n._('reason for%saction'),'<br>'),
                    width : 150,
                    sortable : true,
                    dataIndex : 'ruleIndex',
                    renderer : function(value, metadata, record) {
                           return this.i18n._("rule #") + value;
					}
                }, {
                    header : i18n._("server"),
                    width : 165,
                    sortable : true,
                    dataIndex : 'pipelineEndpoints',
                    renderer : function(value) {
                        return value === null ? "" : value.SServerAddr.hostAddress + ":" + value.SServerPort;
                    }
                }]
                
            });
        },
        validateServer : function() {
            // ipMaddr list must be validated server side
            var passedAddresses = this.gridRules ? this.gridRules.getFullSaveList() : null;
            if (passedAddresses != null) {
                var srcAddrList = [];
                var dstAddrList = [];
                var srcPortList = [];
                var dstPortList = [];
                for (var i = 0; i < passedAddresses.length; i++) {
                    srcAddrList.push(passedAddresses[i]["srcAddress"]);
                    dstAddrList.push(passedAddresses[i]["dstAddress"]);
                    srcPortList.push(passedAddresses[i]["srcPort"]);
                    dstPortList.push(passedAddresses[i]["dstPort"]);
                }
                if (srcAddrList.length > 0) {
                    try {
                        var result = this.getValidator().validate({
                            map : { "type"      : "IP", 
                                    "values"    : {"javaClass" : "java.util.ArrayList", list : srcAddrList}
                            },
                            "javaClass" : "java.util.HashMap"
                        });
                        if (!result.valid) {
                            //this.panelRules.onManagePassedRules();
                            //this.gridRules.editRowChangedDataByFieldValue("srcAddress", result.cause);
                            Ext.MessageBox.alert(this.i18n._("Validation failed for Source Address"), this.i18n._(result.message) + ": " + result.cause);
                            return false;
                        }
                    } catch (e) {
                        Ext.MessageBox.alert(i18n._("Failed"), e.message);
                        return false;
                    }
                }
                if (dstAddrList.length > 0) {
                    try {
                        var result = this.getValidator().validate({
                            map : { "type"      : "IP", 
                                    "values"    : {"javaClass" : "java.util.ArrayList", list : dstAddrList}
                            },
                            "javaClass" : "java.util.HashMap"
                        });
                        if (!result.valid) {
                            //this.panelRules.onManagePassedRules();
                            //this.gridRules.focusFirstChangedDataByFieldValue("dstAddress", result.cause);
                            Ext.MessageBox.alert(this.i18n._("Validation failed for Destination Address"), this.i18n._(result.message) + ": " + result.cause);
                            return false;
                        }
                    } catch (e) {
                        Ext.MessageBox.alert(i18n._("Failed"), e.message);
                        return false;
                    }
                }
                if (srcPortList.length > 0) {
                    try {
                        var result = this.getValidator().validate({
                            map : { "type"      : "Port", 
                                    "values"    : {"javaClass" : "java.util.ArrayList", list : srcPortList}
                            },
                            "javaClass" : "java.util.HashMap"
                        });
                        if (!result.valid) {
                            //this.panelRules.onManagePassedRules();
                            //this.gridRules.editRowChangedDataByFieldValue("srcAddress", result.cause);
                            Ext.MessageBox.alert(this.i18n._("Validation failed for Source Port"), this.i18n._(result.message) + ": " + result.cause);
                            return false;
                        }
                    } catch (e) {
                        Ext.MessageBox.alert(i18n._("Failed"), e.message);
                        return false;
                    }
                }
                if (dstPortList.length > 0) {
                    try {
                        var result = this.getValidator().validate({
                            map : { "type"      : "Port", 
                                    "values"    : {"javaClass" : "java.util.ArrayList", list : dstPortList}
                            },
                            "javaClass" : "java.util.HashMap"
                        });
                        if (!result.valid) {
                            //this.panelRules.onManagePassedRules();
                            //this.gridRules.focusFirstChangedDataByFieldValue("dstAddress", result.cause);
                            Ext.MessageBox.alert(this.i18n._("Validation failed for Destination Address"), this.i18n._(result.message) + ": " + result.cause);
                            return false;
                        }
                    } catch (e) {
                        Ext.MessageBox.alert(i18n._("Failed"), e.message);
                        return false;
                    }
                }
            }
            return true;
        },
        // save function
        save : function() {
            if (this.validate()) {
                Ext.MessageBox.wait(i18n._("Saving..."), i18n._("Please wait"));
                this.getRpcNode().updateAll(function(result, exception) {
                    Ext.MessageBox.hide();
                    if (exception) {
                        Ext.MessageBox.alert(i18n._("Failed"), exception.message);
                        return;
                    }
                    // exit settings screen
                    this.cancelAction();
                }.createDelegate(this), this.getBaseSettings(), this.gridRules ? {javaClass:"java.util.ArrayList",list:this.gridRules.getFullSaveList()} : null);
            }
        }
    });
}