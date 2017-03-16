Ext.define('Ung.view.reports.Entry', {
    extend: 'Ext.panel.Panel',
    alias: 'widget.reports-entry',

    controller: 'reports-entry',

    viewModel: {
        type: 'reports-entry'
    },

    layout: 'border',

    items: [{
        region: 'center',
        border: false,
        bodyBorder: false,
        itemId: 'chartContainer',
        layout: 'fit',
        items: [], // here the chart will be added

        dockedItems: [{
            xtype: 'toolbar',
            border: false,
            dock: 'top',
            cls: 'report-header',
            height: 53,
            style: {
                background: '#FFF'
            },
            bind: {
                html: '{reportHeading}'
            }
        }],

        bbar: [{
            xtype: 'label',
            margin: '0 5',
            text: 'From'.t() + ':'
        }, {
            xtype: 'datefield',
            format: 'date_fmt'.t(),
            editable: false,
            width: 100,
            bind: {
                value: '{_sd}',
                maxValue: '{_ed}'
            }
        }, {
            xtype: 'timefield',
            increment: 10,
            // format: 'date_fmt'.t(),
            editable: false,
            width: 80,
            bind: {
                value: '{_st}',
                maxValue: '{_ed}'
            }
        }, {
            xtype: 'label',
            margin: '0 5',
            text: 'till'
        }, {
            xtype: 'checkbox',
            boxLabel: 'Present'.t(),
            bind: '{tillNow}'
        }, {
            xtype: 'datefield',
            format: 'date_fmt'.t(),
            editable: false,
            width: 100,
            hidden: true,
            bind: {
                value: '{_ed}',
                hidden: '{tillNow}',
                minValue: '{_sd}'
            },
            maxValue: new Date(Math.floor(rpc.systemManager.getMilliseconds()))
        }, {
            xtype: 'timefield',
            increment: 10,
            // format: 'date_fmt'.t(),
            editable: false,
            width: 80,
            hidden: true,
            bind: {
                value: '{_et}',
                hidden: '{tillNow}',
                minValue: '{_sd}'
            },
            maxValue: new Date(Math.floor(rpc.systemManager.getMilliseconds()))
        }, '-' , {
            text: 'Refresh'.t(),
            iconCls: 'fa fa-refresh fa-lg',
            itemId: 'refreshBtn',
            handler: 'refreshData'
        }, '->', {
            itemId: 'downloadBtn',
            text: 'Download'.t(),
            iconCls: 'fa fa-download fa-lg',
        }, '-', {
            itemId: 'dashboardBtn',
            iconCls: 'fa fa-home fa-lg',
            bind: {
                // text: '{isWidget ? "Remove from Dashboard" : "Add to Dashboard"}'
            }

        }]
    }, {
        region: 'east',
        xtype: 'tabpanel',
        title: 'Data & Settings'.t(),
        width: 400,
        minWidth: 400,
        split: true,
        animCollapse: false,
        // floatable: true,
        // floating: true,
        collapsible: true,
        collapsed: false,
        titleCollapse: true,
        hidden: true,
        bind: {
            hidden: '{!entry}'
        },

        items: [{
            xtype: 'grid',
            itemId: 'currentData',
            // todo: review this store
            store: Ext.create('Ext.data.Store', {
                fields: [],
                data: []
            }),
            title: '<i class="fa fa-list"></i> ' + 'Current Data'.t()
        }, {
            xtype: 'form',
            title: '<i class="fa fa-cog"></i> ' + 'Settings'.t(),
            scrollable: 'y',
            layout: 'anchor',
            bodyPadding: 10,
            items: [{
                xtype: 'textfield',
                fieldLabel: 'Title'.t(),
                bind: '{entry.title}',
                anchor: '100%'
            }, {
                xtype: 'textarea',
                grow: true,
                fieldLabel: 'Description'.t(),
                bind: '{entry.description}',
                anchor: '100%'
            }, {
                xtype: 'checkbox',
                fieldLabel: 'Enabled'.t(),
                bind: '{entry.enabled}'
            }, {
                xtype: 'fieldset',
                title: '<i class="fa fa-paint-brush"></i> ' + 'Style'.t(),
                padding: 10,
                collapsible: true,
                defaults: {
                    labelWidth: 150,
                    labelAlign: 'right'
                },
                items: [{
                    // TIME_GRAPH - chart style
                    xtype: 'combo',
                    fieldLabel: 'Time Chart Style'.t(),
                    anchor: '100%',
                    editable: false,
                    store: [
                        ['LINE', 'Line'.t()],
                        ['AREA', 'Area'.t()],
                        ['AREA_STACKED', 'Stacked Area'.t()],
                        ['BAR', 'Column'.t()],
                        ['BAR_OVERLAPPED', 'Overlapped Columns'.t()],
                        ['BAR_STACKED', 'Stacked Columns'.t()]
                    ],
                    queryMode: 'local',
                    hidden: true,
                    bind: {
                        value: '{entry.timeStyle}',
                        disabled: '{!isTimeGraph}',
                        hidden: '{!isTimeGraph}'
                    },
                }, {
                    // TIME_GRAPH - data interval
                    xtype: 'combo',
                    fieldLabel: 'Time Data Interval'.t(),
                    anchor: '100%',
                    editable: false,
                    store: [
                        ['AUTO', 'Auto'.t()],
                        ['SECOND', 'Second'.t()],
                        ['MINUTE', 'Minute'.t()],
                        ['HOUR', 'Hour'.t()],
                        ['DAY', 'Day'.t()],
                        ['WEEK', 'Week'.t()],
                        ['MONTH', 'Month'.t()]
                    ],
                    queryMode: 'local',
                    hidden: true,
                    bind: {
                        value: '{entry.timeDataInterval}',
                        disabled: '{!isTimeGraph}',
                        hidden: '{!isTimeGraph}'
                    },
                }, {
                    // TIME_GRAPH - data grouping approximation
                    xtype: 'combo',
                    fieldLabel: 'Approximation'.t(),
                    anchor: '100%',
                    editable: false,
                    store: [
                        ['average', 'Average'.t()],
                        ['high', 'High'.t()],
                        ['low', 'Low'.t()],
                        ['sum', 'Sum'.t()] // default
                    ],
                    queryMode: 'local',
                    hidden: true,
                    bind: {
                        value: '{_approximation}',
                        disabled: '{!isTimeGraph}',
                        hidden: '{!isTimeGraph}'
                    },
                }, {
                    // PIE_GRAPH - chart style
                    xtype: 'combo',
                    fieldLabel: 'Style'.t(),
                    anchor: '100%',
                    editable: false,
                    store: [
                        ['PIE', 'Pie'.t()],
                        ['PIE_3D', 'Pie 3D'.t()],
                        ['DONUT', 'Donut'.t()],
                        ['DONUT_3D', 'Donut 3D'.t()],
                        ['COLUMN', 'Column'.t()],
                        ['COLUMN_3D', 'Column 3D'.t()]
                    ],
                    queryMode: 'local',
                    hidden: true,
                    bind: {
                        value: '{entry.pieStyle}',
                        disabled: '{!isPieGraph}',
                        hidden: '{!isPieGraph}'
                    },
                }, {
                    // PIE_GRAPH - number of pie slices
                    xtype: 'numberfield',
                    fieldLabel: 'Pie Slices Number'.t(),
                    labelWidth: 150,
                    maxWidth: 200,
                    labelAlign: 'right',
                    minValue: 1,
                    maxValue: 25,
                    allowBlank: false,
                    hidden: true,
                    bind: {
                        value: '{entry.pieNumSlices}',
                        disabled: '{!isPieGraph}',
                        hidden: '{!isPieGraph}'
                    }
                }, {
                    xtype: 'checkbox',
                    reference: 'defaultColors',
                    fieldLabel: 'Colors'.t(),
                    boxLabel: 'Default'.t(),
                    bind: '{_defaultColors}'
                }, {
                    xtype: 'container',
                    margin: '0 0 0 155',
                    itemId: 'colors',
                    // layout: 'hbox',
                    bind: {
                        hidden: '{defaultColors.checked}'
                    }
                }]
            }, {
                xtype: 'fieldset',
                title: '<i class="fa fa-sliders"></i> ' + 'Advanced'.t(),
                padding: 10,
                collapsible: true,
                collapsed: true,
                defaults: {
                    labelWidth: 150,
                    labelAlign: 'right'
                },
                items: [{
                    xtype: 'textfield',
                    fieldLabel: 'Units'.t(),
                    anchor: '100%',
                    bind: '{entry.units}'
                }, {
                    xtype: 'combo',
                    fieldLabel: 'Table'.t(),
                    anchor: '100%',
                    bind: '{entry.table}',
                    editable: false,
                    queryMode: 'local'
                }, {
                    xtype: 'textarea',
                    anchor: '100%',
                    fieldLabel: 'Time Data Columns'.t(),
                    grow: true,
                    bind: '{entry.timeDataColumns}'
                }, {
                    xtype: 'textfield',
                    anchor: '100%',
                    fieldLabel: 'Series Renderer'.t(),
                    bind: '{entry.seriesRenderer}'
                }, {
                    xtype: 'textfield',
                    anchor: '100%',
                    fieldLabel: 'Order By Column'.t(),
                    bind: '{entry.orderByColumn}'
                }, {
                    xtype: 'segmentedbutton',
                    margin: '0 0 5 155',
                    bind: '{entry.orderDesc}',
                    items: [
                        { text: 'Ascending'.t(), iconCls: 'fa fa-sort-amount-asc', value: true },
                        { text: 'Descending'.t(), iconCls: 'fa fa-sort-amount-desc' , value: false }
                    ]
                }, {
                    // ALL - display order
                    xtype: 'numberfield',
                    fieldLabel: 'Display Order'.t(),
                    anchor: '70%',
                    bind: '{entry.displayOrder}'
                }]
            }, {
                xtype: 'fieldset',
                bind: {
                    title: '<i class="fa fa-database"></i> ' + 'Sql Conditions:'.t() + ' ({_sqlConditions.length})',
                    collapsed: '{!entry.conditions}'
                },
                padding: 10,
                collapsible: true,
                collapsed: true,
                items: [{
                    xtype: 'grid',
                    border: false,
                    trackMouseOver: false,
                    sortableColumns: false,
                    enableColumnResize: false,
                    enableColumnMove: false,
                    enableColumnHide: false,
                    hideHeaders: true,
                    disableSelection: true,
                    viewConfig: {
                        emptyText: '<p style="text-align: center; margin: 0; line-height: 2;"><i class="fa fa-info-circle fa-2x"></i> <br/>No Conditions!</p>',
                        stripeRows: false,
                    },
                    bind: '{conditions}',
                    columns: [{
                        header: 'Column'.t(),
                        dataIndex: 'column',
                        flex: 1
                    }, {
                        header: 'Operator'.t(),
                        xtype: 'widgetcolumn',
                        width: 80,
                        widget: {
                            xtype: 'combo',
                            bind: '{record.operator}',
                            store: ['=', '!=', '>', '<', '>=', '<=', 'like', 'not like', 'is', 'is not', 'in', 'not in'],
                            editable: false,
                            queryMode: 'local'
                        }

                    }, {
                        header: 'Value'.t(),
                        xtype: 'widgetcolumn',
                        widget: {
                            xtype: 'textfield',
                            bind: '{record.value}'
                        }
                    }, {
                        xtype: 'actioncolumn',
                        width: 20,
                        align: 'center',
                        iconCls: 'fa fa-minus-circle'
                    }]
                }]
            }],
            bbar: [{
                text: 'Remove'.t(),
                iconCls: 'fa fa-minus-circle',
                disabled: true,
                bind: {
                    disabled: '{entry.readOnly}'
                }
            }, {
                text: 'Update'.t(),
                iconCls: 'fa fa-save',
                // formBind: true,
                disabled: true,
                bind: {
                    disabled: '{entry.readOnly}'
                },
                handler: 'updateReport'
            }, {
                text: 'Save as New Report'.t(),
                iconCls: 'fa fa-plus-circle',
                itemId: 'saveNewBtn',
                handler: 'saveNewReport'
                // formBind: true
            }]
        }]
    }, {
        region: 'south',
        xtype: 'grid',
        height: 280,
        title: 'Filters'.t(),
        itemId: 'filters',
        collapsible: true,
        collapsed: true,
        animCollapse: false,
        titleCollapse: true,
        split: true,
        hidden: true,
        bind: {
            hidden: '{!entry}'
        },
        emptyText: 'To Do!',
        store: { data: [] },
        bbar: [{
            text: 'Add Condition'.t(),
            itemId: 'filtersBtn'
        }],
        columns: [{
            dataIndex: 'condition'
        }, {
            dataIndex: 'operator'
        }, {
            dataIndex: 'value'
        }]
    }]

});