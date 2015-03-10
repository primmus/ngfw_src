// Editor Grid class
Ext.define('Ung.EditorGrid', {
    extend:'Ext.grid.Panel',
    statics: {
        maxRowCount: 2147483647
    },
    selType: 'rowmodel',
    //reserveScrollbar: true,
    // record per page
    recordsPerPage: 25,
    // the minimum number of records for pagination
    minPaginateCount: 65,
    // the total number of records
    totalRecords: null,
    // settings component
    settingsCmp: null,
    // the list of fields used to by the Store
    fields: null,
    // has Add button
    hasAdd: true,
    // should add add rows at top or bottom
    addAtTop: true,
    configAdd: null,
    // has Import Export buttons
    hasImportExport: null,
    // has Edit buton on each record
    hasEdit: true,
    configEdit: null,
    // has Delete buton on each record
    hasDelete: true,
    configDelete: null,
    // the default Empty record for a new row
    hasReorder: false,
    hasInlineEditor:true,
    configReorder: null,
    // the default Empty record for a new row
    emptyRow: null,
    // implements readOnly rows feaure
    hasReadOnly: null,
    // input lines used by the row editor
    rowEditorInputLines: null,
    // label width for row editor input lines
    rowEditorLabelWidth: null,
    //size row editor to component
    rowEditorConfig: null,
    // the default sort field
    sortField: null,
    // the default sort order
    sortOrder: null,
    // the default group field
    groupField: null,
    // the columns are sortable by default, if sortable is not specified
    columnsDefaultSortable: null,
    // is the column header dropdown disabled
    columnMenuDisabled: true,
    // paginate the grid by default
    paginated: true,
    // javaClass of the record, used in save function to create correct json-rpc
    // object
    recordJavaClass: null,
    async: false,
    // the map of changed data in the grid
    dataLoaded: false,
    dataInitialized: false,
    // used by rendering functions and by save
    importSettingsWindow: null,
    enableColumnHide: false,
    enableColumnMove: false,
    dirtyFlag: false,
    addedId: 0,
    generatedId: 1,
    useServerIds: false,
    sortingDisabled:false,
    features: [{ftype: "grouping"}],
    constructor: function(config) {
        var defaults = {
            storeData: [],
            plugins: [],
            viewConfig: {
                enableTextSelection: true,
                stripeRows: true,
                listeners: {
                    "drop": {
                        fn: Ext.bind(function() {
                            this.markDirty();
                        }, this)
                    }
                },
                loadMask:{
                    msg: i18n._("Loading...")
                }
            },
            changedData: {},
            subCmps:[]
        };
        Ext.applyIf(config, defaults);
        this.callParent(arguments);
    },
    initComponent: function() {
        var grid=this;
        if(!this.data) {
            this.data = [];
        }
        if(this.hasInlineEditor) {
            this.inlineEditor=Ext.create('Ext.grid.plugin.CellEditing', {
                clicksToEdit: 1
            });
            this.plugins.push(this.inlineEditor);
        }
        if (this.hasReorder) {
            this.paginated=false;
            var reorderColumn = Ext.create('Ung.grid.ReorderColumn', this.configReorder || {
                header: i18n._("Reorder")
            });
            this.columns.push(reorderColumn);
            this.viewConfig.plugins= {
                ptype: 'gridviewdragdrop',
                dragText: i18n._('Drag and drop to reorganize')
            };
            this.columnsDefaultSortable = false;
        }
        for (var i = 0; i < this.columns.length; i++) {
            var col=this.columns[i];
            if( col.menuDisabled == null) {
                col.menuDisabled = this.columnMenuDisabled;
            }
            if( col.sortable == null) {
                col.sortable = this.columnsDefaultSortable;
            }
            if(this.hasReadOnly && col.dataIndex != 'enabled') {
                if(col.xtype == "checkcolumn") {
                    if (!col.listeners) {
                        col.listeners = {};
                    }
                    col.listeners["beforecheckchange"] = {
                        fn: function(elem, rowIndex, checked, eOpts) {
                            var record = grid.getStore().getAt(rowIndex);
                            if (record.get('readOnly') == true) {
                                return false;
                            }
                        }
                    };
                }
            }
        }
        if (this.hasEdit) {
            var editColumn = Ext.create('Ung.grid.EditColumn', this.configEdit || {hasReadOnly: this.hasReadOnly});
            this.plugins.push(editColumn);
            this.columns.push(editColumn);
        }
        if (this.hasDelete) {
            var deleteColumn = Ext.create('Ung.grid.DeleteColumn', this.configDelete || {hasReadOnly: this.hasReadOnly});
            this.plugins.push(deleteColumn);
            this.columns.push(deleteColumn);
        }
        //Use internal ids for all operations
        this.fields.push({
            name: 'internalId',
            mapping: null
        });
        if(this.dataFn) {
            if(this.dataRoot === undefined) {
                this.dataRoot="list";
            }
        } else {
            this.async=false;
        }
        this.totalRecords = this.data.length;
        this.modelName = 'Ung.Model'+this.getId();
        var model = Ext.define(this.modelName , {
            extend: 'Ext.data.Model',
            fields: this.fields
        });
        this.subCmps.push(model);
        
        this.store=Ext.create('Ext.data.Store',{
            data: [],
            model: this.modelName,
            pageSize: this.paginated?this.recordsPerPage:0,
            proxy: {
                type: 'memory',
                enablePaging: this.paginated,
                reader: {
                    type: 'json'
                }
            },
            autoLoad: false,
            sorters: this.sortField ? {
                property: this.sortField,
                direction: this.sortOrder ? this.sortOrder: "ASC"
            }: undefined,
            groupField: this.groupField,
            remoteSort: this.paginated,
            remoteFilter: this.paginated,
            listeners: {
                "update": {
                    fn: Ext.bind(function(store, record, operation) {
                        this.updateChangedData(record, "modified");
                    }, this)
                },
                "load": {
                    fn: Ext.bind(function(store, records, successful, options, eOpts) {
                        this.updateFromChangedData(store,records);
                    }, this)
                }
            }
        });
        if(!this.dockedItems)  {
            this.dockedItems = [];
        }
        if(this.paginated) {
            this.dockedItems.push({
                dock: 'bottom',
                xtype: 'pagingtoolbar',
                store: this.getStore(),
                displayInfo: true,
                displayMsg: i18n._('Displaying topics {0} - {1} of {2}'),
                emptyMsg: i18n._("No topics to display")
            });
        }
        if (this.tbar == null) {
            this.tbar=[];
        }
        if(this.hasImportExport===null) {
            this.hasImportExport=this.hasAdd;
        }
        if (this.hasAdd) {
            this.tbar.push(Ext.applyIf(this.configAdd || {}, {
                text: i18n._('Add'),
                tooltip: i18n._('Add New Row'),
                iconCls: 'icon-add-row',
                name: 'Add',
                parentId: this.getId(),
                handler: Ext.bind(this.addHandler, this)
            }));
        }
        if (this.hasImportExport) {
            this.tbar.push('->', {
                text: i18n._('Import'),
                tooltip: i18n._('Import From File'),
                iconCls: 'icon-import',
                name: 'Import',
                parentId: this.getId(),
                handler: Ext.bind(this.importHandler, this)
            }, {
                text: i18n._('Export'),
                tooltip: i18n._('Export To File'),
                iconCls: 'icon-export',
                name: 'export',
                parentId: this.getId(),
                handler: Ext.bind(this.exportHandler, this)
            },'-');
        }
        if(this.hasReadOnly) {
            this.on('beforeedit', function(editor, e) {
                if (e.record.get('readOnly') == true) return false;
            });
        }
        this.callParent(arguments);
    },
    afterRender: function() {
        this.callParent(arguments);
        var grid=this;
        this.getView().getRowClass = function(record, index, rowParams, store) {
            var id = record.get("internalId");
            if (id == null || id < 0) {
                return "grid-row-added";
            } else {
                var d = grid.changedData[id];
                if (d) {
                    if (d.op == "deleted") {
                        return "grid-row-deleted";
                    } else {
                        return "grid-row-modified";
                    }
                }
            }
            return "";
        };

        if (this.rowEditor==null) {
            if(this.rowEditorInputLines != null) {
                this.rowEditor = Ext.create('Ung.RowEditorWindow', {
                    grid: this,
                    inputLines: this.rowEditorInputLines,
                    rowEditorLabelWidth: this.rowEditorLabelWidth,
                    helpSource: this.rowEditorHelpSource
                });
            } else if (this.rowEditorConfig != null) {
                this.rowEditor = Ext.create('Ung.RowEditorWindow', Ext.applyIf( this.rowEditorConfig, {grid: this}));
            }
        }
        if(this.rowEditor!=null) {
            this.subCmps.push(this.rowEditor);
        }
        if ( (undefined !== this.tooltip) && (undefined !== this.header) && ( undefined !== this.header.dom ) ) {
            Ext.QuickTips.register({
                target: this.header.dom,
                title: '',
                text: this.tooltip,
                enabled: true,
                showDelay: 20
            });
        }
        this.initialLoad();
    },
    initialLoad: function() {
        // load first page initialy
        this.getView().setLoading(false);  //set to false to prevent showing load mask on inital load.
        Ext.defer(function(){
            this.buildData(Ext.bind(function() {
                this.getStore().loadPage(1, {
                    limit:this.isPaginated() ? this.recordsPerPage: Ung.EditorGrid.maxRowCount,
                    callback: function() {
                        this.dataLoaded=true;
                        //must call this even when setLoading was not set to true, or prevent reload error
                        this.getView().setLoading(false);
                    },
                    scope: this
                });
            }, this));
        },10, this);
    },
    getTestRecord:function(index) {
        var rec= {};
        var property;
        for (var i=0; i<this.fields.length ; i++) {
            property = (this.fields[i].mapping != null)?this.fields[i].mapping:this.fields[i].name;
            rec[property]=
                (property=='id')?index+1:
                (property=='time_stamp')?{javaClass:"java.util.Date", time: (new Date(i*10000)).getTime()}:
            property+"_"+(i*(index+1))+"_"+Math.floor((Math.random()*10));
        }
        return rec;
    },
    getData: function(data) {
        if(!data) {
            if(this.dataFn) {
                if (this.dataFnArg !== undefined && this.dataFnArg != null) {
                    data = this.dataFn(this.dataFnArg);
                } else {
                    data = this.dataFn();
                }
                this.data = (this.dataRoot!=null && this.dataRoot.length>0) ? data[this.dataRoot]:data;
            } else if(this.dataProperty) {
                this.data=this.settingsCmp.settings[this.dataProperty].list;
            } else if(this.dataExpression) {
                    this.data=eval("this.settingsCmp."+this.dataExpression);
            }
        } else {
            this.data=data;
        }

        if(!this.data) {
            this.data=[];
        }
        if(testMode && this.data.length === 0) {
            if(this.testData) {
                this.data.concat(this.testData);
            } else if(this.testDataFn) {
                this.data.concat(this.testDataFn);
            } else if(this.data.length === 0) {
                var emptyRec={};
                var length = Math.floor((Math.random()*5));
                for(var t=0; t<length; t++) {
                    this.data.push(this.getTestRecord(t));
                }
            }
        }
        for(var i=0; i<this.data.length; i++) {
            this.data[i]["internalId"]=i+1;
            //prevent using ids from server
            if(!this.useServerIds) {
                delete this.data[i]["id"];
            }
        }
        this.dataInitialized=true;
        return this.data;
    },
    buildData: function(handler) {
        if(this.async) {
            if (this.dataFnArg !== undefined && this.dataFnArg != null) {
                this.dataFn(Ext.bind(function(result, exception) {
                    if(Ung.Util.handleException(exception)) return;
                    this.getData(result);
                    this.afterDataBuild(handler);
                }, this),this.dataFnArg);
            } else {
                this.dataFn(Ext.bind(function(result, exception) {
                    if(Ung.Util.handleException(exception)) return;
                    this.getData(result);
                    this.afterDataBuild(handler);
                }, this));
            }
        } else {
            this.getData();
            this.afterDataBuild(handler);
        }

    },
    afterDataBuild: function(handler) {
        this.getStore().getProxy().data = this.data;
        this.setTotalRecords(this.data.length);
        if(handler) {
            handler();
        }
    },
    stopEditing: function() {
        if(this.inlineEditor) {
            this.inlineEditor.completeEdit();
        }
    },
    addHandler: function() {
        var record = Ext.create(this.modelName, Ext.decode(Ext.encode(this.emptyRow)));
        record.set("internalId", this.genAddedId());
        this.stopEditing();
        if (this.rowEditor) {
            this.rowEditor.populate(record, true);
            this.rowEditor.show();
        } else {
            if (this.addAtTop)
                this.getStore().insert(0, [record]);
            else
                this.getStore().add([record]);
            this.updateChangedData(record, "added");
        }
    },
    editHandler: function(record) {
        this.stopEditing();
        // populate row editor
        this.rowEditor.populate(record);
        this.rowEditor.show();
    },
    deleteHandler: function(record) {
        this.stopEditing();
        this.updateChangedData(record, "deleted");
    },
    importHandler: function() {
        if(this.importSettingsWindow == null) {
            this.importSettingsWindow = Ext.create('Ung.ImportSettingsWindow',{
                grid: this
            });
            this.subCmps.push(this.importSettingsWindow);
        }
        this.stopEditing();
        this.importSettingsWindow.show();
    },
    onImport: function (importMode, importedRows) {
        this.stopEditing();
        this.removePagination(Ext.bind(function() {
            Ext.Function.defer(this.onImportContinue, 1, this, [importMode, importedRows]);
        }, this));
    },
    onImportContinue: function (importMode, importedRows) {
        var invalidRecords=0;
        if(importedRows == null) {
            importedRows=[];
        }
        var records=[];
        for (var i = 0; i < importedRows.length; i++) {
            try {
                var record= Ext.create(Ext.ClassManager.getName(this.getStore().getProxy().getModel()), importedRows[i]);
                if(importedRows[i].javaClass == this.recordJavaClass) {
                    record.set("internalId", this.genAddedId());
                    records.push(record);
                } else {
                    invalidRecords++;
                }
            } catch(e) {
                invalidRecords++;
            }
        }
        var validRecords=records.length;
        if(validRecords > 0) {
            if(importMode=='replace' ) {
                this.deleteAllRecords();
                this.getStore().insert(0, records);
                this.updateChangedDataOnImport(records, "added");
            } else {
                if(importMode=='append') {
                    this.getStore().add(records);
                } else if(importMode=='prepend') { //replace or prepend mode
                    this.getStore().insert(0, records);
                }
                this.updateChangedDataOnImport(records, "added");
            }
        }
        if(validRecords > 0) {
            if(invalidRecords==0) {
                Ext.MessageBox.alert(i18n._('Import successful'), Ext.String.format(i18n._("Imported file contains {0} valid records."), validRecords));
            } else {
                Ext.MessageBox.alert(i18n._('Import successful'), Ext.String.format(i18n._("Imported file contains {0} valid records and {1} invalid records."), validRecords, invalidRecords));
            }
        } else {
            if(invalidRecords==0) {
                Ext.MessageBox.alert(i18n._('Warning'), i18n._("Import failed. Imported file has no records."));
            } else {
                Ext.MessageBox.alert(i18n._('Warning'), Ext.String.format(i18n._("Import failed. Imported file contains {0} invalid records and no valid records."), invalidRecords));
            }
        }
    },
    deleteAllRecords: function () {
        var records=this.getStore().getRange();
        this.updateChangedDataOnImport(records, "deleted");
    },
    exportHandler: function() {
        Ext.MessageBox.wait(i18n._("Exporting Settings..."), i18n._("Please wait"));
        this.removePagination(Ext.bind(function() {
            var gridName=(this.name!=null)?this.name:this.recordJavaClass;
            gridName=gridName.trim().replace(/ /g,"_");
            var exportForm = document.getElementById('exportGridSettings');
            exportForm["gridName"].value=gridName;
            exportForm["gridData"].value="";
            exportForm["gridData"].value=Ext.encode(this.getPageList(true));
            exportForm.submit();
            Ext.MessageBox.hide();
        }, this ));
    },
    removePagination: function (handler) {
        if(this.isPaginated()) {
            //to remove bottom pagination bar
            this.minPaginateCount = Ung.EditorGrid.maxRowCount;
            this.setTotalRecords(this.totalRecords);
            //make all cahnged data apear in first page
            for (var id in this.changedData) {
                var cd = this.changedData[id];
                cd.page=1;
            }
            //reload grid
            this.getStore().loadPage(1, {
                limit: Ung.EditorGrid.maxRowCount,
                callback: handler,
                scope: this
            });
        } else {
            if(handler) {
                handler.call(this);
                }
        }
    },
    genAddedId: function() {
        this.addedId--;
        return this.addedId;
    },
    // is grid paginated
    isPaginated: function() {
        return  this.paginated && (this.totalRecords != null && this.totalRecords >= this.minPaginateCount);
    },
    beforeDestroy: function() {
        Ext.destroy(this.subCmps);
        this.callParent(arguments);
    },
    // load a page
    loadPage: function(page, callback, scope, arg) {
        this.getStore().loadPage(page, {
            limit:this.isPaginated() ? this.recordsPerPage: Ung.EditorGrid.maxRowCount,
            callback: callback,
            scope: scope,
            arg: arg
        });
    },
    // when a page is rendered load the changedData for it
    updateFromChangedData: function(store, records) {
        var page = store.currentPage;
        for (var id in this.changedData) {
            var cd = this.changedData[id];
            if (page == cd.page) {
                if ("added" == cd.op) {
                    var record = Ext.create(Ext.ClassManager.getName(store.getProxy().getModel()), cd.recData);
                    store.insert(0, [record]);
                } else if ("modified" == cd.op) {
                    var recIndex = store.findExact("internalId", parseInt(id, 10));
                    if (recIndex >= 0) {
                        var rec = store.getAt(recIndex);
                        rec.data = cd.recData;
                        rec.commit();
                    }
                }
            }
        }
    },
    isDirty: function() {
        // Test if there are changed data
        return this.dirtyFlag || Ung.Util.hasData(this.changedData);
    },
    markDirty: function() {
        this.dirtyFlag=true;
    },
    clearDirty: function() {
        this.changedData = {};
        this.dirtyFlag=false;
        this.getView().setLoading(true);
        //never use defer here because it has unexpected behaviour!
        this.buildData(Ext.bind(function() {
            this.getStore().loadPage(this.getStore().currentPage, {
                limit:this.isPaginated() ? this.recordsPerPage: Ung.EditorGrid.maxRowCount,
                callback: function() {
                    this.enableSorting();
                    this.getView().setLoading(false);
                },
                scope: this
            });
        }, this));
    },
    reload: function(options) {
        if(options && options.data) {
            this.data = options.data;
        }
        this.clearDirty();
    },
    disableSorting: function () {
        if (!this.sortingDisabled) {
            var cmConfig = this.columns;
            for (var i in cmConfig) {
                cmConfig[i].initalSortable = cmConfig[i].sortable;
                cmConfig[i].sortable = false;
            }
            this.sortingDisabled=true;
        }
    },
    enableSorting: function () {
        if (this.sortingDisabled) {
            var cmConfig = this.columns;
            for (var i in cmConfig) {
                cmConfig[i].sortable=cmConfig[i].initalSortable;
            }
            this.sortingDisabled=false;
        }
    },
    // Update Changed data after an import
    updateChangedDataOnImport: function(records, currentOp) {
        this.disableSorting();
        var recLength=records.length;
        var i, record;
        if(currentOp == "added") {
            for (i=0; i < recLength; i++) {
                record=records[i];
                this.changedData[record.get("internalId")] = {
                    op: currentOp,
                    recData: record.data,
                    page: 1
                };
            }
        } else if (currentOp == "deleted") {
            for(i=0; i<recLength; i++) {
                this.getStore().suspendEvents();
                record=records[i];
                var id = record.get("internalId");
                var cd = this.changedData[id];
                if (cd == null) {
                    this.changedData[id] = {
                        op: currentOp,
                        recData: record.data,
                        page: 1
                    };
                } else {
                    if ("added" == cd.op) {
                        this.getStore().remove(record);
                        this.changedData[id] = null;
                        delete this.changedData[id];
                    } else {
                        this.changedData[id] = {
                            op: currentOp,
                            recData: record.data,
                            page: 1
                        };
                    }
                }
                this.getStore().resumeEvents();
            }
            if(records.length > 0) {
                this.getView().refresh(false);
            }
        }
    },
    // Update Changed data after an operation (modifyed, deleted, added)
    updateChangedData: function(record, currentOp) {
        this.disableSorting();
        var id = record.get("internalId");
        var cd = this.changedData[id];
        var index;
        if (cd == null) {
            this.changedData[id] = {
                op: currentOp,
                recData: record.data,
                page: this.getStore().currentPage
            };
            if ("deleted" == currentOp) {
                index = this.getStore().indexOf(record);
                this.getView().refreshNode(index);
            }
        } else {
            if ("deleted" == currentOp) {
                if ("added" == cd.op) {
                    this.getStore().remove(record);
                    this.changedData[id] = null;
                    delete this.changedData[id];
                } else {
                    this.changedData[id] = {
                        op: currentOp,
                        recData: record.data,
                        page: this.getStore().currentPage
                    };
                    index = this.getStore().indexOf(record);
                    this.getView().refreshNode(index);
                }
            } else {
                if ("added" == cd.op) {
                    this.changedData[id].recData = record.data;
                } else {
                    this.changedData[id] = {
                        op: currentOp,
                        recData: record.data,
                        page: this.getStore().currentPage
                    };
                }
            }
        }
    },
    // Set the total number of records
    setTotalRecords: function(totalRecords) {
        this.totalRecords = totalRecords;
        if(this.paginated) {
            var isPaginated=this.isPaginated();
            this.getStore().pageSize=isPaginated?this.recordsPerPage:Ung.EditorGrid.maxRowCount;
            if(!isPaginated) {
                //Needs to set currentPage to 1 when not using pagination toolbar.
                this.getStore().currentPage=1;
            }
            var bbar=this.getDockedItems('toolbar[dock="bottom"]')[0];
            // Had to disable show/hide pagination feature for grids inside a window for Chrome browser because of the right scrollbar incorrect rendering issue.
            // Fixing this is more important than hiding the unnecesary pagination toolbar
            if(Ext.isChrome && this.up().xtype=="window") {
                if (isPaginated) {
                    bbar.enable();
                } else {
                    bbar.disable();
                }
            } else {
                if (isPaginated) {
                    bbar.show();
                    bbar.enable();
                } else {
                    bbar.hide();
                    bbar.disable();
                }
                if(this.rendered) {
                    this.setSize();
                }
            }
        }
    },
    setRowEditor: function(rowEditor) {
        this.rowEditor = rowEditor;
        this.rowEditor.grid=this;
        this.subCmps.push(this.rowEditor);
    },
    findFirstChangedDataByFieldValue: function(field, value) {
        for (var id in this.changedData) {
            var cd = this.changedData[id];
            if (cd.op != "deleted" && cd.recData[field] == value) {
                return cd;
            }
        }
        return null;
    },

    focusChangedDataField: function(cd, field) {
        var recIndex = this.getStore().findExact("internalId", parseInt(cd.recData["internalId"], 10));
        if (recIndex >= 0) {
            this.getView().focusRow(recIndex);
        }
    },
    // focus the first changed row matching a field value
    // used by validation functions
    focusFirstChangedDataByFieldValue: function(field, value) {
        var cd = this.findFirstChangedDataByFieldValue(field, value);
        if (cd != null) {
            this.getStore().loadPage(cd.page,{
                callback:Ext.bind(function(r, options, success) {
                    if (success) {
                        this.focusChangedDataField(options.arg, field);
                    }
                }, this),
                scope: this,
                arg: cd
            });
        }
    },
    getAddedDeletedModifiedLists: function() {
        var added = [];
        var deleted = [];
        var modified = [];
        for (var id in this.changedData) {
            var cd = this.changedData[id];
            if ("deleted" == cd.op) {
                if (id > 0) {
                    deleted.push(parseInt(id, 10));
                }
            } else {
                if (this.recordJavaClass != null) {
                    cd.recData["javaClass"] = this.recordJavaClass;
                }
                if (id < 0) {
                    added.push(cd.recData);
                } else {
                    modified.push(cd.recData);
                }
            }
        }
        return [{
            list: added,
            "javaClass": "java.util.ArrayList"
        }, {
            list: deleted,
            "javaClass": "java.util.ArrayList"
        }, {
            list: modified,
            "javaClass": "java.util.ArrayList"
        }];
    },
    // Get the page list
    // for the unpaginated grids, that send all the records on save
    //Attention this only gets the records from the current page!
        //It can't be used for grids that may have pagination.
    //Can be used only for grids that have explicitly set: paginated: false
    getPageList: function(useId, useInternalId) {
        var list=[];
        if(!this.dataLoaded) {
            //This code should never be called
            if(!this.dataInitialized) {
                this.getData();
            }
            //NOT Working fine with mapping fields
            this.getStore().loadData(this.data);
            this.dataLoaded=true;
        }
        var records=this.getStore().getRange();
        for(var i=0; i<records.length;i++) {
            var id = records[i].get("internalId");
            if (id != null && id >= 0) {
                var d = this.changedData[id];
                if (d) {
                    if (d.op == "deleted") {
                        continue;
                    }
                }
            }
            if (this.recordJavaClass != null) {
                records[i].data["javaClass"] = this.recordJavaClass;
            }
            var recData=Ext.decode(Ext.encode(records[i].data));
            if(!useInternalId) {
                delete recData["internalId"];
            }
            if(!useId) {
                delete recData["id"];
            } else if(!this.useServerIds) {
                recData["id"]=i+1;
            }

            list.push(recData);
        }
        return list;
    },
    // Get the entire list from all pages, and the result is returned in the callback handler function.
    // This is why it cannot be used synchronusly. it have to be used in an async way.
    // First it remove pagination the grid then it gets the list
    getList: function(handler, skipRepagination) {
        if(this.isPaginated()) {
            var oldSettings=null;
            if(!skipRepagination) {
                oldSettings = {
                    changedData: Ext.decode(Ext.encode(this.changedData)),
                    minPaginateCount: this.minPaginateCount,
                    page: this.getStore().currentPage
                };
            }
            //to remove bottom pagination bar
            this.minPaginateCount = Ung.EditorGrid.maxRowCount;
            if(skipRepagination) {
                this.setTotalRecords(this.totalRecords);
            }
            //make all cahnged data apear in first page
            for (var id in this.changedData) {
                var cd = this.changedData[id];
                cd.page=1;
            }
            //reload grid
            this.getStore().loadPage(1, {
                limit:Ung.EditorGrid.maxRowCount,
                callback: Ext.bind(function() {
                    var result=this.getPageList();
                    if(!skipRepagination) {
                        this.changedData = oldSettings.changedData;
                        this.minPaginateCount = oldSettings.minPaginateCount;
                        this.getStore().loadPage(oldSettings.page, {
                            limit:this.isPaginated() ? this.recordsPerPage: Ung.EditorGrid.maxRowCount,
                            callback:Ext.bind(function() {
                                handler({
                                    javaClass: "java.util.LinkedList",
                                    list: result
                                });
                            }, this),
                            scope: this
                        });
                    } else {
                        handler({
                            javaClass: "java.util.LinkedList",
                            list: result
                        });
                    }
                }, this),
                scope: this
            });
        } else {
            var saveList = this.getPageList();
            handler({
                javaClass: "java.util.LinkedList",
                list: saveList
            });
        }
    },
    getDeletedList: function() {
        var list=[];
        var records=this.getStore().getRange();
        for(var i=0; i<records.length;i++) {
            var id = records[i].get("internalId");
            if (id != null && id >= 0) {
                var d = this.changedData[id];
                if (d) {
                    if (d.op == "deleted") {
                        if (this.recordJavaClass != null) {
                            records[i].data["javaClass"] = this.recordJavaClass;
                        }
                        list.push(records[i].data);
                    }
                }
            }
        }
        return list;
    }
});